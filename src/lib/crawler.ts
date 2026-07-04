// Lightweight website crawler built on fetch + cheerio.
// Discovers important pages (about / products / services / contact / pricing),
// scores and dedupes links, skips login/legal/irrelevant pages, then extracts
// clean text for AI analysis. No headless browser — serverless-friendly.

import * as cheerio from "cheerio";
import type { CrawledPage } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const PAGE_TIMEOUT_MS = 8000;
const MAX_PAGES = 8;
const MAX_TEXT_PER_PAGE = 6000; // chars, keeps token budget sane

// Higher score = more valuable for company research.
const KEYWORD_WEIGHTS: Record<string, number> = {
  about: 10, "about-us": 10, company: 8, "who-we-are": 8,
  product: 9, products: 9, service: 9, services: 9, solution: 8, solutions: 8,
  platform: 6, features: 6, pricing: 7, plans: 6,
  contact: 7, "contact-us": 7, customers: 5, "case-studies": 4,
  team: 3, mission: 4, "how-it-works": 5,
};

// Never crawl these — auth walls, legal boilerplate, noise.
const SKIP_PATTERNS = [
  "login", "signin", "sign-in", "signup", "sign-up", "register", "auth",
  "privacy", "terms", "legal", "cookie", "gdpr", "sitemap",
  "cart", "checkout", "account", "password", "logout",
  "blog/", "/blog", "news/", "careers", "jobs", "press/",
  ".pdf", ".jpg", ".png", ".zip", ".xml", ".json", "mailto:", "tel:",
  "#", "javascript:",
];

// SSRF guard: only crawl public http(s) hosts — never loopback, private ranges,
// link-local (cloud metadata), or bare IP-less internal names.
export function isSafePublicUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    if (!host.includes(".")) return false; // localhost, intranet single-label names
    if (host === "0.0.0.0" || host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (a === 127 || a === 10 || a === 0) return false;
      if (a === 172 && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
      if (a === 169 && b === 254) return false; // cloud metadata
    }
    if (host.startsWith("[") || host === "::1") return false; // IPv6 literals
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, timeout = PAGE_TIMEOUT_MS): Promise<string | null> {
  if (!isSafePublicUrl(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sameSite(a: string, b: string): boolean {
  try {
    const ha = new URL(a).hostname.replace(/^www\./, "");
    const hb = new URL(b).hostname.replace(/^www\./, "");
    return ha === hb;
  } catch {
    return false;
  }
}

function shouldSkip(url: string): boolean {
  const lower = url.toLowerCase();
  return SKIP_PATTERNS.some((p) => lower.includes(p));
}

function scoreLink(url: string, anchorText: string): number {
  const lower = (url + " " + anchorText).toLowerCase();
  let score = 0;
  for (const [kw, weight] of Object.entries(KEYWORD_WEIGHTS)) {
    if (lower.includes(kw)) score += weight;
  }
  // Prefer shallow paths (fewer segments).
  try {
    const depth = new URL(url).pathname.split("/").filter(Boolean).length;
    score -= depth;
  } catch {
    /* ignore */
  }
  return score;
}

function extractText($: cheerio.CheerioAPI): string {
  $("script, style, noscript, svg, nav, footer, header, form, iframe").remove();
  const text = $("body").text();
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_PER_PAGE);
}

function canonical(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    let path = u.pathname.replace(/\/$/, "");
    if (path === "") path = "/";
    return `${u.protocol}//${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url;
  }
}

export interface CrawlResult {
  pages: CrawledPage[];
  discovered: string[]; // canonical URLs we chose to crawl
}

// Crawl a site starting from its homepage. Returns extracted page content
// plus the list of URLs visited (used for source citations).
export async function crawlSite(
  seedUrl: string,
  onPage?: (url: string) => void,
): Promise<CrawlResult> {
  const homeHtml = await fetchWithTimeout(seedUrl, 10000);
  const pages: CrawledPage[] = [];
  const visited = new Set<string>();

  if (!homeHtml) {
    return { pages, discovered: [] };
  }

  const $home = cheerio.load(homeHtml);
  const homeTitle = $home("title").first().text().trim() || "Home";
  visited.add(canonical(seedUrl));
  onPage?.(seedUrl);
  pages.push({ url: seedUrl, title: homeTitle, text: extractText($home) });

  // Collect and score internal links from the homepage.
  const base = new URL(seedUrl);
  const scored = new Map<string, number>();
  $home("a[href]").each((_, el) => {
    const href = $home(el).attr("href");
    if (!href) return;
    let abs: string;
    try {
      const u = new URL(href, base);
      u.hash = ""; // fragment-only variants are the same page
      abs = u.toString();
    } catch {
      return;
    }
    if (!sameSite(abs, seedUrl)) return;
    if (shouldSkip(abs)) return;
    const canon = canonical(abs);
    if (visited.has(canon) || scored.has(canon)) return;
    const anchor = $home(el).text().trim();
    const s = scoreLink(abs, anchor);
    if (s > 0) scored.set(canon, s);
  });

  // Crawl the top-scoring pages in parallel.
  const targets = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_PAGES - 1)
    .map(([url]) => url);

  const results = await Promise.all(
    targets.map(async (url) => {
      onPage?.(url);
      const html = await fetchWithTimeout(url);
      if (!html) return null;
      const $ = cheerio.load(html);
      const title = $("title").first().text().trim() || url;
      const text = extractText($);
      if (text.length < 120) return null; // skip near-empty pages
      return { url, title, text } as CrawledPage;
    }),
  );

  for (const r of results) {
    if (r) {
      pages.push(r);
      visited.add(canonical(r.url));
    }
  }

  return { pages, discovered: [...visited] };
}
