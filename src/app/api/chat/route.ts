// Follow-up Q&A about an already-researched company (context stuffing, no RAG).
import type { NextRequest } from "next/server";
import { followUpChat } from "@/lib/openrouter";
import { resolveKeys } from "@/lib/keys";
import type { ApiKeys, CompanyReport } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  question: string;
  report: CompanyReport;
  model?: string;
  keys?: ApiKeys;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { openrouter } = resolveKeys(body.keys);
    if (!openrouter) return Response.json({ error: "OpenRouter key missing" }, { status: 400 });
    if (!body.question?.trim() || !body.report?.name) {
      return Response.json({ error: "Missing question or report context" }, { status: 400 });
    }
    const answer = await followUpChat({
      apiKey: openrouter,
      model: body.model?.trim() || "google/gemini-2.5-flash",
      question: body.question,
      report: body.report,
    });
    return Response.json({ answer });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Chat failed" }, { status: 500 });
  }
}
