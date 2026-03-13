import { NextRequest, NextResponse } from "next/server";
import {
  fetchRecentSEOReports,
  fetchRecentInvestorReports,
  fetchRecentCompetitorReports,
  type SEOReportSummary,
  type InvestorReportSummary,
  type CompetitorReportSummary,
} from "@/lib/agent-reports";

export const dynamic = "force-dynamic";

const AGENT_ID_TO_FETCHER: Record<
  string,
  () => Promise<SEOReportSummary[] | InvestorReportSummary[] | CompetitorReportSummary[]>
> = {
  "12": () => fetchRecentSEOReports(20),
  "13": () => fetchRecentInvestorReports(20),
  "14": () => fetchRecentCompetitorReports(20),
};

export interface ActivityReport {
  runId: string;
  status: string;
  createdAt: string;
  reportUrl: string;
  summary: string;
  focCid?: string;
}

// GET /api/agents/[id]/activity
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fetcher = AGENT_ID_TO_FETCHER[id];
  if (!fetcher) {
    return NextResponse.json({ reports: [] });
  }

  const raw = await fetcher();
  const reports: ActivityReport[] = raw.map((r) => {
    const base = r as { runId: string; status: string; createdAt: string; reportUrl: string; focCid?: string };
    let summary = "";
    if ("userUrl" in r && "targetKeyword" in r) {
      summary = `${(r as SEOReportSummary).targetKeyword || (r as SEOReportSummary).userUrl}`;
    } else if ("space" in r && "idea" in r) {
      const ir = r as InvestorReportSummary;
      summary = `${ir.space}: ${ir.idea.slice(0, 80)}${ir.idea.length > 80 ? "…" : ""}`;
    } else if ("url" in r && "focus" in r) {
      const cr = r as CompetitorReportSummary;
      summary = `${cr.url} — ${cr.focus}`;
    }
    return {
      runId: base.runId,
      status: base.status,
      createdAt: base.createdAt,
      reportUrl: base.reportUrl,
      summary,
      focCid: base.focCid,
    };
  });

  return NextResponse.json({ reports });
}
