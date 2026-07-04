"use client";
// Signature element: a live agent trace. Each research stage is a node on a
// vertical line — pulsing amber while active, solid checkmark once done.
import { IconCheck } from "./Icons";

export interface Stage {
  id: string;
  label: string;
  status: "active" | "done";
  detail?: string;
}

export function ProgressTimeline({ stages, finished }: { stages: Stage[]; finished: boolean }) {
  return (
    <div className="card p-5 fade-up">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-1.5 h-1.5 rounded-full ${finished ? "" : "live-dot"}`} style={{ background: finished ? "var(--green)" : "var(--amber)" }} />
        <span className="eyebrow" style={{ color: finished ? "var(--green)" : "var(--amber)" }}>
          {finished ? "Research complete" : "Researching"}
        </span>
      </div>

      <ol className="relative">
        {stages.map((s, i) => {
          const isLast = i === stages.length - 1;
          const active = s.status === "active";
          return (
            <li key={s.id + i} className="relative flex gap-3.5 pb-4 last:pb-0">
              {/* connector line */}
              {!isLast && (
                <span
                  className="absolute left-[9px] top-5 bottom-0 w-px"
                  style={{ background: "var(--border)" }}
                />
              )}
              {/* node */}
              <span
                className={`relative z-10 flex-shrink-0 mt-0.5 grid place-items-center rounded-full ${active ? "node-active" : ""}`}
                style={{
                  width: 19,
                  height: 19,
                  background: active ? "transparent" : "var(--amber)",
                  border: active ? "2px solid var(--amber)" : "none",
                }}
              >
                {!active && <IconCheck width={11} height={11} style={{ color: "#1a1204" }} strokeWidth={3} />}
              </span>
              {/* text */}
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] leading-snug" style={{ color: active ? "var(--text)" : "var(--muted)" }}>
                  {s.label}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
