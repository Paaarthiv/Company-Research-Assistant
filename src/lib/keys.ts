// Resolve API keys: request-body override (sidebar) first, then server env.
import type { ApiKeys } from "./types";

export function resolveKeys(bodyKeys?: ApiKeys): { openrouter: string; serper: string } {
  return {
    openrouter: bodyKeys?.openrouter?.trim() || process.env.OPENROUTER_API_KEY || "",
    serper: bodyKeys?.serper?.trim() || process.env.SERPER_API_KEY || "",
  };
}
