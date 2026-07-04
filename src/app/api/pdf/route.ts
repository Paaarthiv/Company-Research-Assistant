// Generate a downloadable PDF report from a CompanyReport payload.
import type { NextRequest } from "next/server";
import { generateReportPdf, reportFileName } from "@/lib/pdf";
import type { CompanyReport } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const report = (await req.json()) as CompanyReport;
    if (!report?.name) return new Response("Invalid report", { status: 400 });
    const pdf = generateReportPdf(report);
    return new Response(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${reportFileName(report)}"`,
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "PDF generation failed", { status: 500 });
  }
}
