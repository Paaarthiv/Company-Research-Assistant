// Streaming research orchestrator. Emits Server-Sent Events for each stage so
// the UI can render a live progress timeline, then a final report payload.

import type { NextRequest } from "next/server";
import { resolveKeys } from "@/lib/keys";
import {
  serperSearch,
  resolveWebsite,
  extractContactFromSerper,
  verifyCompetitorWebsite,
  normalizeUrl,
  isUrl,
} from "@/lib/serper";
import { crawlSite, isSafePublicUrl } from "@/lib/crawler";
import { analyzeCompany } from "@/lib/openrouter";
import type { ApiKeys, CompanyReport, ResearchEvent } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  input: string;
  model?: string;
  keys?: ApiKeys;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  const { openrouter, serper } = resolveKeys(body.keys);
  const model = body.model?.trim() || "google/gemini-2.5-flash";
  const input = (body.input ?? "").trim().slice(0, 200);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ResearchEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const stage = (id: string, label: string, status: "active" | "done", detail?: string) =>
        send({ type: "stage", id, label, status, detail });

      try {
        if (!input) throw new Error("Please enter a company name or website URL.");
        if (!serper) throw new Error("Serper.dev API key is missing. Add it in the sidebar or server env.");
        if (!openrouter) throw new Error("OpenRouter API key is missing. Add it in the sidebar or server env.");

        // 1. Classify input
        stage("classify", "Understanding your request", "active");
        const inputIsUrl = isUrl(input);
        stage("classify", inputIsUrl ? "Detected a website URL" : "Detected a company name", "done");

        // 2. Resolve official website
        let website: string;
        const serperContextParts: string[] = [];
        if (inputIsUrl) {
          website = normalizeUrl(input);
          if (!isSafePublicUrl(website)) {
            throw new Error("That URL points to a private or unsupported address. Please enter a public company website.");
          }
          stage("resolve", `Using ${website}`, "done");
        } else {
          stage("resolve", `Finding official website for "${input}"`, "active");
          const found = await resolveWebsite(input, serper);
          if (!found) throw new Error(`Could not find an official website for "${input}".`);
          website = found;
          stage("resolve", `Official website: ${website}`, "done");
        }

        // 3. Serper enrichment (knowledge graph + contact + competitors)
        stage("search", "Searching public sources with Serper.dev", "active");
        const nameForSearch = inputIsUrl ? new URL(website).hostname.replace(/^www\./, "") : input;
        const [kgSearch, contactSearch, compSearch] = await Promise.all([
          serperSearch(`${nameForSearch} company`, serper, 8).catch(() => ({})),
          serperSearch(`${nameForSearch} headquarters phone contact`, serper, 5).catch(() => ({})),
          serperSearch(`${nameForSearch} competitors alternatives`, serper, 8).catch(() => ({})),
        ]);
        const contact = extractContactFromSerper(kgSearch);
        for (const r of [kgSearch, contactSearch, compSearch]) {
          const organic = (r as { organic?: { title?: string; snippet?: string }[] }).organic ?? [];
          serperContextParts.push(...organic.map((o) => `${o.title ?? ""}: ${o.snippet ?? ""}`));
        }
        stage("search", "Collected public information", "done");

        // 4. Crawl website
        stage("crawl", "Crawling website pages", "active");
        const crawledUrls: string[] = [];
        const { pages, discovered } = await crawlSite(website, (url) => {
          crawledUrls.push(url);
          stage("crawl", `Reading ${shortenUrl(url)}`, "active");
        });
        if (pages.length === 0) {
          // Graceful degradation: proceed with Serper context only.
          stage("crawl", "Site blocked crawling — using search data instead", "done");
        } else {
          stage("crawl", `Analyzed ${pages.length} pages`, "done");
        }

        // 5. AI analysis
        stage("analyze", `Generating insights with ${model.split("/").pop()}`, "active");
        const analysis = await analyzeCompany({
          apiKey: openrouter,
          model,
          companyHint: input,
          website,
          serperContext: serperContextParts.join("\n"),
          pages,
        });
        stage("analyze", "AI analysis complete", "done");

        // 6. Verify competitor websites via Serper
        stage("verify", "Verifying competitor websites", "active");
        const competitors = await Promise.all(
          (analysis.competitors ?? []).map(async (c) => {
            if (c.website && /^https?:\/\//.test(c.website)) return c;
            const verified = await verifyCompetitorWebsite(c.name, serper);
            return { ...c, website: verified };
          }),
        );
        stage("verify", "Competitors verified", "done");

        // Assemble final report
        const report: CompanyReport = {
          name: analysis.name || nameForSearch,
          website,
          phone: analysis.phone || contact.phone || "",
          address: analysis.address || contact.address || "",
          summary: analysis.summary || contact.description || "",
          products: analysis.products ?? [],
          painPoints: analysis.painPoints ?? [],
          competitors,
          sources: dedupe([...discovered, ...crawledUrls]).slice(0, 12),
          model,
          generatedAt: new Date().toISOString(),
        };

        send({ type: "done", data: report });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Research failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" || u.pathname === "" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
