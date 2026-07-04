"use client";
import { useState } from "react";
import { IconPlus } from "./Icons";

export interface Config {
  openrouterKey: string;
  serperKey: string;
  model: string;
  discordToken: string;
  discordChannel: string;
  applicantName: string;
  applicantEmail: string;
}

export interface ModelOption {
  id: string;
  name: string;
}

interface Props {
  config: Config;
  onChange: (patch: Partial<Config>) => void;
  models: ModelOption[];
  modelsLoading: boolean;
  onSave: () => void;
  onNewResearch: () => void;
}

const STEPS = [
  "Enter a company name or URL",
  "Serper.dev searches and crawls it",
  "OpenRouter AI generates insights",
  "Download a professional PDF report",
];

export function Sidebar({ config, onChange, models, modelsLoading, onSave, onNewResearch }: Props) {
  const [tab, setTab] = useState<"api" | "discord">("api");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 1600);
  };

  return (
    <aside
      className="flex flex-col h-full w-[300px] flex-shrink-0 border-r"
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
    >
      {/* Brand */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl grid place-items-center flex-shrink-0" style={{ background: "var(--amber)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a1204" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <div className="leading-tight">
          <p className="font-semibold text-[15px]">Relu Consultancy</p>
          <p className="eyebrow">Company Intelligence</p>
        </div>
      </div>

      {/* New research */}
      <div className="px-4">
        <button
          onClick={onNewResearch}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[13px] font-medium border transition-colors hover:bg-[var(--card)]"
          style={{ borderColor: "var(--border)" }}
        >
          <IconPlus width={15} height={15} /> New Research
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg" style={{ background: "var(--card)" }}>
          {(["api", "discord"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="py-1.5 rounded-md text-[11px] mono tracking-wider uppercase transition-colors"
              style={{
                background: tab === t ? "var(--card-2)" : "transparent",
                color: tab === t ? "var(--text)" : "var(--faint)",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {tab === "api" ? (
          <>
            <Labeled label="OpenRouter API Key">
              <input type="password" className="field" placeholder="sk-or-v1-..." value={config.openrouterKey}
                onChange={(e) => onChange({ openrouterKey: e.target.value })} />
            </Labeled>
            <Labeled label="Serper.dev API Key">
              <input type="password" className="field" placeholder="Your Serper key..." value={config.serperKey}
                onChange={(e) => onChange({ serperKey: e.target.value })} />
            </Labeled>
            <Labeled label="AI Model">
              <select className="field cursor-pointer" value={config.model} onChange={(e) => onChange({ model: e.target.value })}>
                {models.length === 0 && <option value={config.model}>{config.model}</option>}
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <p className="mt-1.5 text-[10.5px]" style={{ color: "var(--faint)" }}>
                {modelsLoading ? "Loading models…" : models.length > 0 ? `${models.length} models available` : "Save an OpenRouter key to load models"}
              </p>
            </Labeled>
          </>
        ) : (
          <>
            <div className="rounded-lg p-3 border" style={{ borderColor: "rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.08)" }}>
              <p className="text-[12.5px] font-medium" style={{ color: "#a5b4fc" }}>Discord Bot Integration</p>
              <p className="text-[11.5px] mt-1" style={{ color: "var(--muted)" }}>
                After research completes, the report auto-sends to your configured channel.
              </p>
            </div>
            <Labeled label="Bot Token">
              <input type="password" className="field" placeholder="Bot token..." value={config.discordToken}
                onChange={(e) => onChange({ discordToken: e.target.value })} />
            </Labeled>
            <Labeled label="Channel ID">
              <input className="field" placeholder="000000000000000000" value={config.discordChannel}
                onChange={(e) => onChange({ discordChannel: e.target.value })} />
            </Labeled>
            <div className="pt-1 eyebrow">Applicant Details</div>
            <Labeled label="Full Name">
              <input className="field" style={{ fontFamily: "inherit" }} placeholder="Your full name" value={config.applicantName}
                onChange={(e) => onChange({ applicantName: e.target.value })} />
            </Labeled>
            <Labeled label="Email Address">
              <input className="field" style={{ fontFamily: "inherit" }} placeholder="email@example.com" value={config.applicantEmail}
                onChange={(e) => onChange({ applicantEmail: e.target.value })} />
            </Labeled>
          </>
        )}
      </div>

      {/* Save + how it works */}
      <div className="px-4 pb-4 space-y-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <button onClick={handleSave} className="btn-amber w-full py-2.5 text-[13px]">
          {saved ? "Saved ✓" : tab === "api" ? "Save Configuration" : "Save Discord Config"}
        </button>

        <div>
          <p className="eyebrow mb-2">How it works</p>
          <ol className="space-y-1.5">
            {STEPS.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                <span className="mono flex-shrink-0" style={{ color: "var(--amber)" }}>{i + 1}</span>{s}
              </li>
            ))}
          </ol>
        </div>
        <p className="eyebrow pt-1">Openrouter · Serper · jsPDF</p>
      </div>
    </aside>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="eyebrow block mb-1.5">{label}</span>
      {children}
    </label>
  );
}
