// Proxy OpenRouter's model catalogue for the sidebar model selector.
import type { NextRequest } from "next/server";
import { listModels } from "@/lib/openrouter";
import { resolveKeys } from "@/lib/keys";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { keys?: { openrouter?: string; serper?: string } };
    const { openrouter } = resolveKeys(body.keys);
    if (!openrouter) {
      return Response.json({ models: [], error: "No OpenRouter key" }, { status: 200 });
    }
    const models = await listModels(openrouter);
    // Trim to the fields the UI needs; sort by name.
    const slim = models
      .map((m) => ({ id: m.id, name: m.name || m.id }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return Response.json({ models: slim });
  } catch (e) {
    return Response.json(
      { models: [], error: e instanceof Error ? e.message : "Failed to load models" },
      { status: 200 },
    );
  }
}
