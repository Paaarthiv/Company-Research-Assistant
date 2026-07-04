"use client";
import type { CompanyReport } from "@/lib/types";
import {
  IconDownload, IconGlobe, IconPhone, IconPin, IconSpark,
  IconTarget, IconExternal, IconCheck,
} from "./Icons";

interface Props {
  report: CompanyReport;
  onDownload: () => void;
  downloading: boolean;
  discordStatus: "idle" | "sending" | "sent" | "error";
  discordError?: string;
}

export function ResearchCard({ report, onDownload, downloading, discordStatus, discordError }: Props) {
  return (
    <div className="card overflow-hidden fade-up">
      {/* Header */}
      <div className="px-5 sm:px-7 pt-6 pb-5 border-b" style={{ borderColor: "var(--border-soft)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold tracking-tight truncate">{report.name}</h2>
            <a
              href={report.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[12.5px] mt-1 inline-flex items-center gap-1.5 hover:underline"
              style={{ color: "var(--amber)" }}
            >
              {report.website.replace(/^https?:\/\//, "")}
              <IconExternal width={11} height={11} />
            </a>
          </div>
          <span
            className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] mono tracking-wider"
            style={{ color: "var(--green)", border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.07)" }}
          >
            <IconCheck width={11} height={11} /> COMPLETE
          </span>
        </div>
      </div>

      <div className="px-5 sm:px-7 py-6 space-y-6">
        {/* Contact grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <InfoTile icon={<IconPhone width={13} height={13} />} label="Phone" value={report.phone || "Not publicly listed"} />
          <InfoTile icon={<IconPin width={13} height={13} />} label="Address" value={report.address || "Not publicly listed"} />
        </div>

        {/* Summary */}
        {report.summary && (
          <Section icon={<IconGlobe width={13} height={13} />} title="Overview">
            <p className="text-[14px] leading-relaxed" style={{ color: "#c8cbd2" }}>{report.summary}</p>
          </Section>
        )}

        {/* Products */}
        {report.products.length > 0 && (
          <Section icon={<IconSpark width={13} height={13} />} title="Products & Services">
            <div className="flex flex-wrap gap-2">
              {report.products.map((p, i) => <span key={i} className="chip">{p}</span>)}
            </div>
          </Section>
        )}

        {/* Pain points */}
        {report.painPoints.length > 0 && (
          <Section icon={<IconSpark width={13} height={13} />} title="AI-Generated Pain Points">
            <ul className="space-y-2.5">
              {report.painPoints.map((p, i) => (
                <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed" style={{ color: "#c8cbd2" }}>
                  <span className="mt-2 flex-shrink-0 w-1.5 h-1.5 rounded-full" style={{ background: "var(--amber)" }} />
                  {p}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Competitors */}
        {report.competitors.length > 0 && (
          <Section icon={<IconTarget width={13} height={13} />} title="Competitors">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {report.competitors.map((c, i) => (
                <div key={i} className="rounded-lg p-3 border" style={{ background: "var(--card-2)", borderColor: "var(--border-soft)" }}>
                  <p className="font-medium text-[13.5px]">{c.name}</p>
                  {c.website ? (
                    <a href={c.website} target="_blank" rel="noopener noreferrer" className="mono text-[11px] hover:underline block truncate mt-0.5" style={{ color: "var(--faint)" }}>
                      {c.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="mono text-[11px] mt-0.5 block" style={{ color: "var(--faint)" }}>website n/a</span>
                  )}
                  {c.reason && <p className="text-[11.5px] mt-1.5" style={{ color: "var(--muted)" }}>{c.reason}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button onClick={onDownload} disabled={downloading} className="btn-amber inline-flex items-center gap-2 px-4 py-2.5 text-[13px] disabled:opacity-60">
            <IconDownload width={15} height={15} />
            {downloading ? "Preparing…" : "Download PDF Report"}
          </button>

          {discordStatus === "sending" && <DiscordPill label="Sending to Discord…" tone="pending" />}
          {discordStatus === "sent" && <DiscordPill label="Sent to Discord" tone="success" />}
          {discordStatus === "error" && <DiscordPill label={discordError || "Discord failed"} tone="error" />}
        </div>

        {/* Sources */}
        {report.sources.length > 0 && (
          <details className="pt-1">
            <summary className="eyebrow cursor-pointer select-none hover:text-[var(--muted)]">
              Sources · {report.sources.length}
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              {report.sources.map((s, i) => (
                <a key={i} href={s} target="_blank" rel="noopener noreferrer" className="mono text-[11px] truncate hover:underline" style={{ color: "var(--faint)" }}>{s}</a>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg p-3.5 border" style={{ background: "var(--card-2)", borderColor: "var(--border-soft)" }}>
      <div className="flex items-center gap-1.5 eyebrow mb-1.5" style={{ color: "var(--faint)" }}>
        <span style={{ color: "var(--amber)" }}>{icon}</span>{label}
      </div>
      <p className="text-[13.5px]" style={{ color: "#d4d7dd" }}>{value}</p>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 eyebrow mb-3" style={{ color: "var(--faint)" }}>
        <span style={{ color: "var(--amber)" }}>{icon}</span>{title}
      </div>
      {children}
    </div>
  );
}

function DiscordPill({ label, tone }: { label: string; tone: "pending" | "success" | "error" }) {
  const color = tone === "success" ? "var(--green)" : tone === "error" ? "#f87171" : "var(--indigo)";
  return (
    <span className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px]" style={{ color, border: `1px solid ${color}33`, background: `${color}12` }}>
      {tone === "success" && <IconCheck width={13} height={13} />}
      {tone === "pending" && <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: color }} />}
      {label}
    </span>
  );
}
