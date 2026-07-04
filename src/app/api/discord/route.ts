// Send the generated report + applicant details to a configured Discord channel.
import type { NextRequest } from "next/server";
import { generateReportPdf, reportFileName } from "@/lib/pdf";
import { sendReportToDiscord } from "@/lib/discord";
import type { CompanyReport, ApplicantInfo, DiscordConfig } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  report: CompanyReport;
  applicant: ApplicantInfo;
  discord: DiscordConfig;
}

export async function POST(req: NextRequest) {
  try {
    const { report, applicant, discord } = (await req.json()) as Body;
    const botToken = discord?.botToken?.trim() || process.env.DISCORD_BOT_TOKEN || "";
    const channelId = discord?.channelId?.trim() || process.env.DISCORD_CHANNEL_ID || "";

    if (!botToken || !channelId) {
      return Response.json({ ok: false, error: "Discord bot token and channel ID are required." }, { status: 400 });
    }
    if (!report?.name) {
      return Response.json({ ok: false, error: "No report to send." }, { status: 400 });
    }

    const pdf = generateReportPdf(report);
    const result = await sendReportToDiscord({
      botToken,
      channelId,
      applicant: applicant ?? {},
      report,
      pdf,
      fileName: reportFileName(report),
    });

    return Response.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Discord send failed" }, { status: 500 });
  }
}
