# Relu · AI Company Research Assistant

An AI-powered company research tool. Enter a **company name** or **website URL** and it will:

1. Find the official website (via Serper.dev) if you gave a name
2. Crawl the site's important pages (About, Products, Services, Contact, Pricing…)
3. Enrich with public search data (phone, address, competitors)
4. Generate structured insights with an AI model of your choice (via OpenRouter)
5. Identify and verify competitors
6. Render a live, ChatGPT-style report — with **follow-up chat**, a **downloadable PDF**, and optional **auto-delivery to Discord**

Built for the Relu Consultancy AI & Automation Developer hiring challenge.

> **Live demo:** _add your Vercel URL here after deploying_

---

## ✨ Features

| Requirement | Implementation |
| --- | --- |
| Company name **or** URL input | Auto-detects; resolves official website from a name via Serper |
| Website crawling | `fetch` + `cheerio`, keyword-scored page discovery, dedupe, skips login/legal/irrelevant pages, parallel fetch with timeouts |
| Search integration | **Serper.dev** for website resolution, contact enrichment, competitor discovery + verification |
| AI integration | **OpenRouter** with a live model selector; strict JSON output; retry + model fallback |
| Competitor analysis | Name + verified website + "why they compete" for each |
| ChatGPT-style UI | Streaming progress timeline, result card, follow-up Q&A, responsive (mobile + desktop) |
| PDF report | `jsPDF`, professional branded layout, one-click download |
| Discord (bonus) | Bot token + channel config; auto-sends report PDF + applicant details after research |
| Enhancements (bonus) | Live agent-trace timeline, source citations, in-memory cache, graceful crawl fallback, per-session key override |

## 🧱 Tech stack

- **Next.js 16** (App Router, TypeScript) — single unified project (frontend + API routes)
- **Tailwind CSS v4** — dark "intelligence terminal" UI
- **cheerio** — lightweight, serverless-friendly crawling (no headless browser)
- **jsPDF** — server-side PDF generation
- **Server-Sent Events** — live per-stage research progress
- Deploys to **Vercel** (or any Node platform)

## 🔑 Environment variables

Keys can be provided **two ways**: server-side env vars (below) *or* pasted into the app's sidebar per session. Sidebar keys take precedence, so an evaluator can run the app entirely with their own keys.

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | for AI (or via sidebar) | AI processing via OpenRouter |
| `SERPER_API_KEY` | for search (or via sidebar) | Search & research via Serper.dev |
| `DISCORD_BOT_TOKEN` | optional | Discord bonus — bot auth |
| `DISCORD_CHANNEL_ID` | optional | Discord bonus — target channel |

Get keys: [OpenRouter](https://openrouter.ai/keys) · [Serper.dev](https://serper.dev)

> **Tip:** OpenRouter's **BYOK** lets you route requests through your own Google AI Studio / provider key — the first 1M requests/month carry no platform fee.

## 🚀 Getting started

```bash
npm install
cp .env.example .env.local   # optional — or use the sidebar
npm run dev                  # http://localhost:3000
```

Then either add your keys to `.env.local`, or open the app and paste them into the sidebar → **Save Configuration**.

### Build

```bash
npm run build && npm start
```

## ☁️ Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it at [vercel.com/new](https://vercel.com/new) (framework auto-detected as Next.js).
3. Add the environment variables above in **Project → Settings → Environment Variables** (optional if using sidebar keys).
4. Deploy. The `/api/research` route is configured with `maxDuration = 60` for crawl + AI time.

## 🗺️ How it works

```
Input (name | URL)
      │
      ▼
 Classify ──► Resolve website (Serper) ──► Enrich (Serper: KG, contacts, competitors)
      │
      ▼
 Crawl site (cheerio: score → dedupe → parallel fetch)
      │
      ▼
 AI analysis (OpenRouter, JSON: summary, products, pain points, competitors)
      │
      ▼
 Verify competitor sites (Serper) ──► Report ──► PDF / Discord / Follow-up chat
```

Each stage streams a Server-Sent Event, rendered live as the progress timeline.

## 📁 Project structure

```
src/
├── app/
│   ├── page.tsx              # Chat UI orchestrator (client)
│   ├── layout.tsx
│   ├── globals.css           # Design tokens + utilities
│   └── api/
│       ├── research/route.ts # SSE pipeline orchestrator
│       ├── models/route.ts   # OpenRouter model list
│       ├── pdf/route.ts       # jsPDF report
│       ├── discord/route.ts   # Discord delivery
│       └── chat/route.ts      # Follow-up Q&A
├── components/
│   ├── Sidebar.tsx  ProgressTimeline.tsx  ResearchCard.tsx  Icons.tsx
└── lib/
    ├── serper.ts  crawler.ts  openrouter.ts  pdf.ts  discord.ts
    ├── types.ts  keys.ts  useLocalStorage.ts
```

## 🤖 Discord setup (bonus)

1. Create a bot at the [Discord Developer Portal](https://discord.com/developers/applications) → **Bot** → copy token.
2. Invite it to your server with **Send Messages** + **Attach Files** permissions.
3. Enable Developer Mode in Discord, right-click your channel → **Copy Channel ID**.
4. In the app sidebar → **Discord** tab: paste the token + channel ID, add applicant name/email, **Save**.
5. Run any research — the PDF report and applicant details auto-post to the channel.

## 📝 Notes on robustness

- Malformed AI JSON is repaired and retried on a fallback model.
- Sites that block crawling degrade gracefully to search-only research.
- Per-page fetch timeouts keep the pipeline within serverless limits.
- No database or auth required — nothing is persisted server-side.
