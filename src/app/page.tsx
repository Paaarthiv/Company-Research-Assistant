"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar, type Config, type ModelOption } from "@/components/Sidebar";
import { ProgressTimeline, type Stage } from "@/components/ProgressTimeline";
import { ResearchCard } from "@/components/ResearchCard";
import { IconSend } from "@/components/Icons";
import { useLocalStorage } from "@/lib/useLocalStorage";
import type { CompanyReport, ResearchEvent } from "@/lib/types";

const DEFAULT_MODEL = "google/gemini-2.5-flash";
const EXAMPLES = ["stripe.com", "Tesla", "Microsoft", "OpenAI"];

type Msg =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "progress"; stages: Stage[]; finished: boolean }
  | { id: string; role: "report"; report: CompanyReport; discordStatus: "idle" | "sending" | "sent" | "error"; discordError?: string; downloading: boolean }
  | { id: string; role: "assistant"; text: string; loading?: boolean }
  | { id: string; role: "error"; text: string };

const uid = () => Math.random().toString(36).slice(2);

export default function Home() {
  const [config, setConfig] = useLocalStorage<Config>("relu-config", {
    openrouterKey: "", serperKey: "", model: DEFAULT_MODEL,
    discordToken: "", discordChannel: "", applicantName: "", applicantEmail: "",
  });
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"research" | "chat">("research");
  const [reportCache, setReportCache] = useState<Record<string, CompanyReport>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [serverConfig, setServerConfig] = useState<{ discordConfigured: boolean }>({ discordConfigured: false });

  const currentReport = useRef<CompanyReport | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const patchConfig = (patch: Partial<Config>) => setConfig({ ...configRef.current, ...patch });

  const updateMsg = useCallback((id: string, fn: (m: Msg) => Msg) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  // Load OpenRouter models
  const loadModels = useCallback(async () => {
    const key = configRef.current.openrouterKey;
    if (!key) return;
    setModelsLoading(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: { openrouter: key } }),
      });
      const data = (await res.json()) as { models: ModelOption[] };
      setModels(data.models ?? []);
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadModels(), 400);
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => setServerConfig({ discordConfigured: Boolean(c.discordConfigured) }))
      .catch(() => {});
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const keys = () => ({ openrouter: config.openrouterKey, serper: config.serperKey });

  // ---- Research pipeline (SSE) ----
  async function runResearch(query: string) {
    setBusy(true);
    const progressId = uid();
    setMessages((prev) => [...prev, { id: progressId, role: "progress", stages: [], finished: false }]);

    const upsertStage = (s: Stage) => {
      updateMsg(progressId, (m) => {
        if (m.role !== "progress") return m;
        const stages = [...m.stages];
        const idx = stages.findIndex((x) => x.id === s.id);
        if (idx >= 0) stages[idx] = s;
        else stages.push(s);
        return { ...m, stages };
      });
    };

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: query, model: config.model, keys: keys() }),
      });
      if (!res.body) throw new Error("No response stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5).trim()) as ResearchEvent;

          if (evt.type === "stage") {
            upsertStage({ id: evt.id, label: evt.label, status: evt.status, detail: evt.detail });
          } else if (evt.type === "done") {
            updateMsg(progressId, (m) => (m.role === "progress" ? { ...m, finished: true } : m));
            currentReport.current = evt.data;
            setReportCache((c) => ({ ...c, [query.toLowerCase()]: evt.data }));
            setMessages((prev) => [...prev, { id: uid(), role: "report", report: evt.data, discordStatus: "idle", downloading: false }]);
            setMode("chat");
            maybeSendDiscord(evt.data);
          } else if (evt.type === "error") {
            updateMsg(progressId, (m) => (m.role === "progress" ? { ...m, finished: true } : m));
            setMessages((prev) => [...prev, { id: uid(), role: "error", text: evt.message }]);
          }
        }
      }
    } catch (e) {
      setMessages((prev) => [...prev, { id: uid(), role: "error", text: e instanceof Error ? e.message : "Research failed." }]);
    } finally {
      setBusy(false);
    }
  }

  // ---- Follow-up chat ----
  async function runChat(question: string) {
    if (!currentReport.current) return;
    setBusy(true);
    const aId = uid();
    setMessages((prev) => [...prev, { id: aId, role: "assistant", text: "", loading: true }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, report: currentReport.current, model: config.model, keys: keys() }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      updateMsg(aId, () => ({ id: aId, role: "assistant", text: data.answer || data.error || "No answer.", loading: false }));
    } catch {
      updateMsg(aId, () => ({ id: aId, role: "assistant", text: "Something went wrong answering that.", loading: false }));
    } finally {
      setBusy(false);
    }
  }

  // ---- Discord auto-send ----
  async function maybeSendDiscord(report: CompanyReport) {
    const { discordToken, discordChannel, applicantName, applicantEmail } = configRef.current;
    const sidebarConfigured = Boolean(discordToken && discordChannel);
    if (!sidebarConfigured && !serverConfig.discordConfigured) return;
    setMessages((prev) => prev.map((m) => (m.role === "report" && m.report === report ? { ...m, discordStatus: "sending" } : m)));
    try {
      const res = await fetch("/api/discord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report,
          applicant: { name: applicantName, email: applicantEmail },
          discord: { botToken: discordToken, channelId: discordChannel },
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      setMessages((prev) => prev.map((m) =>
        m.role === "report" && m.report === report
          ? { ...m, discordStatus: data.ok ? "sent" : "error", discordError: data.error }
          : m));
    } catch {
      setMessages((prev) => prev.map((m) => (m.role === "report" && m.report === report ? { ...m, discordStatus: "error", discordError: "Network error" } : m)));
    }
  }

  // ---- PDF download ----
  async function downloadPdf(msgId: string, report: CompanyReport) {
    updateMsg(msgId, (m) => (m.role === "report" ? { ...m, downloading: true } : m));
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(report.name || "company").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-research-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setMessages((prev) => [...prev, { id: uid(), role: "error", text: "PDF generation failed. Please try again." }]);
    } finally {
      updateMsg(msgId, (m) => (m.role === "report" ? { ...m, downloading: false } : m));
    }
  }

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((prev) => [...prev, { id: uid(), role: "user", text }]);

    if (mode === "chat" && currentReport.current) {
      runChat(text);
    } else {
      // Serve from cache if we've researched this exact query before
      const cached = reportCache[text.toLowerCase()];
      if (cached) {
        currentReport.current = cached;
        setMessages((prev) => [...prev, { id: uid(), role: "report", report: cached, discordStatus: "idle", downloading: false }]);
        setMode("chat");
      } else {
        runResearch(text);
      }
    }
  }

  function newResearch() {
    setMessages([]);
    setMode("research");
    currentReport.current = null;
    setInput("");
    setSidebarOpen(false);
  }

  const empty = messages.length === 0;
  const placeholder = mode === "chat"
    ? `Ask a follow-up about ${currentReport.current?.name ?? "this company"}…`
    : "Enter a company name (e.g. Stripe) or website URL (e.g. https://stripe.com)…";

  return (
    <div className="ambient flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar config={config} onChange={patchConfig} models={models} modelsLoading={modelsLoading} onSave={loadModels} onNewResearch={newResearch} />
      </div>

      {/* Mobile sidebar drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full">
            <Sidebar config={config} onChange={patchConfig} models={models} modelsLoading={modelsLoading} onSave={loadModels} onNewResearch={newResearch} />
          </div>
        </div>
      )}

      {/* Main column */}
      <main className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 sm:px-6 h-14 border-b flex-shrink-0" style={{ borderColor: "var(--border)" }}>
          <button className="md:hidden p-1.5 rounded-md border" style={{ borderColor: "var(--border)" }} onClick={() => setSidebarOpen(true)} aria-label="Open settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>
          <h1 className="font-semibold text-[15px] tracking-tight">Company Research</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9.5px] mono tracking-wider" style={{ color: "var(--green)", border: "1px solid rgba(52,211,153,0.3)" }}>
            <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: "var(--green)" }} /> LIVE
          </span>
        </header>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
            {empty ? (
              <Hero onExample={(ex) => { setInput(ex); }} />
            ) : (
              <div className="space-y-5">
                {messages.map((m) => (
                  <MessageRow key={m.id} m={m} onDownload={downloadPdf} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 border-t px-4 sm:px-6 py-4" style={{ borderColor: "var(--border)" }}>
          <div className="max-w-3xl mx-auto">
            <div className="flex items-end gap-2 rounded-xl border p-2 pl-4" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
                placeholder={placeholder}
                rows={1}
                className="flex-1 resize-none bg-transparent outline-none text-[14px] py-1.5 max-h-32"
                style={{ color: "var(--text)" }}
              />
              <button onClick={submit} disabled={busy || !input.trim()} className="btn-amber flex items-center gap-1.5 px-3.5 py-2 text-[13px]">
                {busy ? <span className="w-1.5 h-1.5 rounded-full live-dot bg-current" /> : <IconSend width={14} height={14} />}
                <span className="hidden sm:inline">{mode === "chat" ? "Ask" : "Research"}</span>
              </button>
            </div>
            <p className="text-center mt-2 eyebrow" style={{ color: "var(--faint)" }}>
              Enter to {mode === "chat" ? "ask" : "research"} · Shift+Enter for new line
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function Hero({ onExample }: { onExample: (ex: string) => void }) {
  return (
    <div className="flex flex-col items-center text-center pt-16 sm:pt-24">
      <p className="eyebrow mb-4" style={{ color: "var(--amber)" }}>AI-Powered Intelligence</p>
      <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05]">
        Know any company<br />in minutes.
      </h2>
      <p className="mt-5 max-w-md text-[14.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
        Enter a company name or website URL to get AI-generated insights, competitor analysis, pain points, and a professional PDF report.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => onExample(ex)} className="chip mono hover:border-[var(--amber-dim)] transition-colors" style={{ cursor: "pointer" }}>
            {ex}
          </button>
        ))}
      </div>
      <p className="mt-8 eyebrow" style={{ color: "var(--faint)" }}>Configure API keys in the sidebar to get started</p>
    </div>
  );
}

function MessageRow({ m, onDownload }: { m: Msg; onDownload: (id: string, r: CompanyReport) => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end fade-up">
        <div className="rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] text-[14px]" style={{ background: "var(--card-2)", border: "1px solid var(--border)" }}>
          {m.text}
        </div>
      </div>
    );
  }
  if (m.role === "progress") {
    return <ProgressTimeline stages={m.stages.length ? m.stages : [{ id: "init", label: "Starting research…", status: "active" }]} finished={m.finished} />;
  }
  if (m.role === "report") {
    return <ResearchCard report={m.report} onDownload={() => onDownload(m.id, m.report)} downloading={m.downloading} discordStatus={m.discordStatus} discordError={m.discordError} />;
  }
  if (m.role === "error") {
    return (
      <div className="card p-4 fade-up" style={{ borderColor: "rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.06)" }}>
        <p className="text-[13.5px]" style={{ color: "#fca5a5" }}>{m.text}</p>
      </div>
    );
  }
  // assistant
  return (
    <div className="fade-up">
      <p className="eyebrow mb-2" style={{ color: "var(--amber)" }}>Assistant</p>
      {m.loading ? (
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full live-dot" style={{ background: "var(--muted)" }} />
          <span className="w-2 h-2 rounded-full live-dot" style={{ background: "var(--muted)", animationDelay: "0.2s" }} />
          <span className="w-2 h-2 rounded-full live-dot" style={{ background: "var(--muted)", animationDelay: "0.4s" }} />
        </div>
      ) : (
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "#d4d7dd" }}>{m.text}</p>
      )}
    </div>
  );
}
