// Shared data models for the Company Research Assistant.

export interface Competitor {
  name: string;
  website: string;
  reason?: string;
}

export interface CompanyReport {
  name: string;
  website: string;
  phone: string;
  address: string;
  summary: string;
  products: string[];
  painPoints: string[];
  competitors: Competitor[];
  sources: string[];
  model?: string;
  generatedAt?: string;
}

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

// Keys can come from the request body (sidebar override) or server env.
export interface ApiKeys {
  openrouter?: string;
  serper?: string;
}

export interface ApplicantInfo {
  name?: string;
  email?: string;
}

export interface DiscordConfig {
  botToken?: string;
  channelId?: string;
}

// Server-Sent Event payloads streamed from /api/research.
export type ResearchEvent =
  | { type: "stage"; id: string; label: string; status: "active" | "done"; detail?: string }
  | { type: "partial"; data: Partial<CompanyReport> }
  | { type: "done"; data: CompanyReport }
  | { type: "error"; message: string };
