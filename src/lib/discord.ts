// Discord integration — send the generated report + applicant details to a
// channel via the Discord REST API (multipart file upload, no discord.js).

import type { CompanyReport, ApplicantInfo } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

export async function sendReportToDiscord(args: {
  botToken: string;
  channelId: string;
  applicant: ApplicantInfo;
  report: CompanyReport;
  pdf: Uint8Array;
  fileName: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { botToken, channelId, applicant, report, pdf, fileName } = args;

  const embed = {
    title: `📊 Company Research: ${report.name}`,
    color: 0xe6a83f,
    fields: [
      { name: "Applicant", value: applicant.name || "—", inline: true },
      { name: "Email", value: applicant.email || "—", inline: true },
      { name: "​", value: "​", inline: false },
      { name: "Company", value: report.name || "—", inline: true },
      { name: "Website", value: report.website || "—", inline: true },
      {
        name: "Competitors",
        value: report.competitors.map((c) => c.name).join(", ").slice(0, 1000) || "—",
        inline: false,
      },
    ],
    footer: { text: "Relu Company Research Assistant" },
    timestamp: new Date().toISOString(),
  };

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      content: `New company report generated${applicant.name ? ` by **${applicant.name}**` : ""}.`,
      embeds: [embed],
    }),
  );
  const blob = new Blob([pdf as BlobPart], { type: "application/pdf" });
  form.append("files[0]", blob, fileName);

  try {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${botToken}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Discord API ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown Discord error" };
  }
}
