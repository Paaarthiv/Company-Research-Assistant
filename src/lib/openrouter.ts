// OpenRouter integration — model listing + structured company analysis.
// OpenRouter is OpenAI-compatible; we request JSON output and repair/retry
// on malformed responses, with a model fallback for resilience.

import type { CompanyReport, CrawledPage, Competitor } from "./types";

const BASE = "https://openrouter.ai/api/v1";
const FALLBACK_MODEL = "google/gemini-2.0-flash-001";

export interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

export async function listModels(apiKey: string): Promise<OpenRouterModel[]> {
  const res = await fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Failed to list models (${res.status})`);
  const json = (await res.json()) as { data: OpenRouterModel[] };
  return json.data ?? [];
}

interface ChatArgs {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
}

async function chat({ apiKey, model, system, user, json, temperature = 0.4 }: ChatArgs): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://relu-company-research.vercel.app",
      "X-Title": "Relu Company Research Assistant",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter error (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

function extractJson(raw: string): unknown {
  // Strip markdown fences and grab the outermost JSON object.
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object in model output");
  return JSON.parse(cleaned.slice(start, end + 1));
}

const ANALYSIS_SYSTEM = `You are a senior company research analyst. You produce accurate, concise, structured intelligence on companies using only the provided source material and your own reasoning. Never invent phone numbers or addresses — if a field is unknown, use an empty string. Always respond with a single valid JSON object and nothing else.`;

function buildAnalysisPrompt(
  companyHint: string,
  website: string,
  serperContext: string,
  pages: CrawledPage[],
): string {
  const crawlText = pages
    .map((p) => `### PAGE: ${p.title} (${p.url})\n${p.text}`)
    .join("\n\n")
    .slice(0, 24000);

  return `Analyze this company and return a JSON object with EXACTLY this shape:
{
  "name": "official company name",
  "phone": "public phone number or empty string",
  "address": "headquarters location or empty string",
  "summary": "3-4 sentence professional overview of what the company does",
  "products": ["key product or service names, 3-8 items"],
  "painPoints": ["4-6 specific, insightful business/strategic challenges this company likely faces, each a full sentence"],
  "competitors": [{"name": "competitor", "website": "https://... or empty", "reason": "one short phrase why they compete"}]
}

Guidelines:
- Pain points must be specific and analytical (market pressure, scaling, competition, regulation, talent, tech debt) — not generic filler.
- Suggest 3-5 real competitors in the same industry/market and, where possible, the same region.
- Prefer real, well-known competitor websites; leave website empty if unsure (it will be verified separately).

COMPANY (name or URL provided by user): ${companyHint}
RESOLVED WEBSITE: ${website}

SEARCH CONTEXT (from Serper.dev):
${serperContext.slice(0, 4000)}

CRAWLED WEBSITE CONTENT:
${crawlText}`;
}

interface RawAnalysis {
  name?: string;
  phone?: string;
  address?: string;
  summary?: string;
  products?: string[];
  painPoints?: string[];
  competitors?: Competitor[];
}

export async function analyzeCompany(args: {
  apiKey: string;
  model: string;
  companyHint: string;
  website: string;
  serperContext: string;
  pages: CrawledPage[];
}): Promise<Partial<CompanyReport>> {
  const prompt = buildAnalysisPrompt(args.companyHint, args.website, args.serperContext, args.pages);

  const attempt = async (model: string) => {
    const raw = await chat({
      apiKey: args.apiKey,
      model,
      system: ANALYSIS_SYSTEM,
      user: prompt,
      json: true,
    });
    return extractJson(raw) as RawAnalysis;
  };

  let parsed: RawAnalysis;
  try {
    parsed = await attempt(args.model);
  } catch {
    // One retry on the fallback model (handles JSON errors + flaky providers).
    parsed = await attempt(FALLBACK_MODEL);
  }

  return {
    name: parsed.name?.trim() || args.companyHint,
    phone: parsed.phone?.trim() || "",
    address: parsed.address?.trim() || "",
    summary: parsed.summary?.trim() || "",
    products: Array.isArray(parsed.products) ? parsed.products.filter(Boolean).slice(0, 8) : [],
    painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints.filter(Boolean).slice(0, 6) : [],
    competitors: Array.isArray(parsed.competitors)
      ? parsed.competitors
          .filter((c) => c && c.name)
          .slice(0, 5)
          .map((c) => ({ name: c.name.trim(), website: (c.website ?? "").trim(), reason: c.reason?.trim() }))
      : [],
  };
}

// Follow-up chat about an already-researched company (context stuffing, no RAG).
export async function followUpChat(args: {
  apiKey: string;
  model: string;
  question: string;
  report: CompanyReport;
  pages?: CrawledPage[];
}): Promise<string> {
  const context = `You are answering questions about ${args.report.name} (${args.report.website}).

Known report:
- Summary: ${args.report.summary}
- Products/Services: ${args.report.products.join(", ")}
- Pain points: ${args.report.painPoints.join(" | ")}
- Competitors: ${args.report.competitors.map((c) => c.name).join(", ")}
${args.pages?.length ? `\nCrawled content:\n${args.pages.map((p) => p.text).join("\n").slice(0, 12000)}` : ""}`;

  return chat({
    apiKey: args.apiKey,
    model: args.model,
    system:
      "You are a helpful company-research assistant. Answer concisely and specifically using the provided context. If something isn't in the context, say so briefly.",
    user: `${context}\n\nUser question: ${args.question}`,
    temperature: 0.5,
  });
}

export { FALLBACK_MODEL };
