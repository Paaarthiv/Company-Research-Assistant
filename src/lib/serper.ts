// Serper.dev integration — Google search, official-website resolution,
// knowledge-graph enrichment (phone/address), and competitor verification.

const SERPER_URL = "https://google.serper.dev/search";

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperKnowledgeGraph {
  title?: string;
  type?: string;
  website?: string;
  description?: string;
  attributes?: Record<string, string>;
}

export interface SerperResult {
  organic?: SerperOrganic[];
  knowledgeGraph?: SerperKnowledgeGraph;
  answerBox?: { answer?: string; snippet?: string };
}

export async function serperSearch(query: string, apiKey: string, num = 10): Promise<SerperResult> {
  const res = await fetch(SERPER_URL, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Serper request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return (await res.json()) as SerperResult;
}

// Domains that are never a company's own marketing site.
const NON_OFFICIAL = [
  "wikipedia.org", "linkedin.com", "crunchbase.com", "bloomberg.com",
  "facebook.com", "twitter.com", "x.com", "instagram.com", "youtube.com",
  "glassdoor.com", "indeed.com", "zoominfo.com", "pitchbook.com",
  "reddit.com", "medium.com", "github.com", "apps.apple.com", "play.google.com",
  "amazon.com", "tracxn.com", "owler.com", "g2.com", "capterra.com",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isOfficialCandidate(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return !NON_OFFICIAL.some((d) => host === d || host.endsWith(`.${d}`));
}

// Resolve a company name to its most likely official website.
export async function resolveWebsite(name: string, apiKey: string): Promise<string | null> {
  const result = await serperSearch(`${name} official website`, apiKey, 10);

  // Knowledge graph website is the strongest signal.
  const kg = result.knowledgeGraph?.website;
  if (kg && isOfficialCandidate(kg)) return normalizeUrl(kg);

  // Otherwise pick the first organic result that isn't a directory/social site.
  for (const item of result.organic ?? []) {
    if (item.link && isOfficialCandidate(item.link)) {
      return normalizeUrl(item.link);
    }
  }
  return result.organic?.[0]?.link ? normalizeUrl(result.organic[0].link) : null;
}

// Pull phone / address / description from the knowledge graph and answer box.
export function extractContactFromSerper(result: SerperResult): {
  phone: string;
  address: string;
  description: string;
} {
  const attrs = result.knowledgeGraph?.attributes ?? {};
  const findAttr = (keys: string[]) => {
    for (const [k, v] of Object.entries(attrs)) {
      const key = k.toLowerCase();
      if (keys.some((t) => key.includes(t))) return v;
    }
    return "";
  };
  return {
    phone: findAttr(["phone", "customer service", "telephone"]),
    address: findAttr(["headquarters", "address", "location"]),
    description: result.knowledgeGraph?.description ?? result.answerBox?.snippet ?? "",
  };
}

// Verify (or discover) a competitor's website via search.
export async function verifyCompetitorWebsite(name: string, apiKey: string): Promise<string> {
  try {
    const result = await serperSearch(`${name} official website`, apiKey, 5);
    const kg = result.knowledgeGraph?.website;
    if (kg && isOfficialCandidate(kg)) return normalizeUrl(kg);
    for (const item of result.organic ?? []) {
      if (item.link && isOfficialCandidate(item.link)) return normalizeUrl(item.link);
    }
  } catch {
    // Non-fatal — a competitor without a verified site still lists by name.
  }
  return "";
}

export function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    parsed.hash = "";
    // Keep to origin for the crawl seed; drop trailing slash noise.
    return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname);
  } catch {
    return u;
  }
}

export function isUrl(input: string): boolean {
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) return true;
  // Bare domain like "stripe.com" — has a dot, no spaces, a TLD-ish suffix.
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(trimmed) && !trimmed.includes(" ");
}
