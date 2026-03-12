/**
 * Fetches live report data from the deployed seo-agent and investor-finder.
 * Used by the /live page to show real agent output.
 */

const SEO_AGENT_BASE =
  process.env.SEO_AGENT_URL ?? "https://seo-agent-rouge-five.vercel.app";
const INVESTOR_FINDER_BASE =
  process.env.INVESTOR_FINDER_URL_PUBLIC ?? "https://investor-finder-three.vercel.app";
const COMPETITOR_ANALYSER_BASE =
  process.env.COMPETITOR_ANALYSER_URL ?? "https://competitor-analyser.vercel.app";

export interface SEOReportSummary {
  runId: string;
  status: "analyzing" | "completed" | "failed";
  userUrl: string;
  targetKeyword?: string;
  focCid?: string;
  focListingId?: string | null;
  enrichmentRunId?: string;
  createdAt: string;
  reportUrl: string;
}

export interface CompetitorReportSummary {
  runId: string;
  status: "analyzing" | "completed" | "failed";
  url: string;
  focus: string;
  focCid?: string;
  focListingId?: string | null;
  createdAt: string;
  reportUrl: string;
}

export interface InvestorReportSummary {
  runId: string;
  status: "analyzing" | "completed" | "failed";
  space: string;
  idea: string;
  focCid?: string;
  focListingId?: string | null;
  createdAt: string;
  reportUrl: string;
}

async function safeFetch(url: string, timeout = 8000): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchRecentSEOReports(limit = 5): Promise<SEOReportSummary[]> {
  const list = (await safeFetch(`${SEO_AGENT_BASE}/api/debug/reports`)) as {
    reports?: Array<{ runId: string; status: string; userUrl: string; createdAt: string }>;
  } | null;

  if (!list?.reports) return [];

  const completed = list.reports
    .filter((r) => r.status === "completed")
    .slice(0, limit);

  const full = await Promise.all(
    completed.map(async (r) => {
      const detail = (await safeFetch(`${SEO_AGENT_BASE}/api/report/${r.runId}`)) as {
        targetKeyword?: string;
        focCid?: string;
        focListingId?: string | null;
        enrichmentRunId?: string;
      } | null;
      return {
        runId: r.runId,
        status: r.status as SEOReportSummary["status"],
        userUrl: r.userUrl,
        targetKeyword: detail?.targetKeyword,
        focCid: detail?.focCid,
        focListingId: detail?.focListingId,
        enrichmentRunId: detail?.enrichmentRunId,
        createdAt: r.createdAt,
        reportUrl: `${SEO_AGENT_BASE}/report/${r.runId}`,
      };
    })
  );

  return full;
}

export async function fetchRecentInvestorReports(limit = 5): Promise<InvestorReportSummary[]> {
  const list = (await safeFetch(`${INVESTOR_FINDER_BASE}/api/debug/reports`)) as {
    reports?: Array<{ runId: string; status: string; space: string; idea: string; createdAt: string }>;
  } | null;

  if (!list?.reports) return [];

  const completed = list.reports
    .filter((r) => r.status === "completed")
    .slice(0, limit);

  const full = await Promise.all(
    completed.map(async (r) => {
      const detail = (await safeFetch(`${INVESTOR_FINDER_BASE}/api/report/${r.runId}`)) as {
        focCid?: string;
        focListingId?: string | null;
      } | null;
      return {
        runId: r.runId,
        status: r.status as InvestorReportSummary["status"],
        space: r.space,
        idea: r.idea,
        focCid: detail?.focCid,
        focListingId: detail?.focListingId,
        createdAt: r.createdAt,
        reportUrl: `${INVESTOR_FINDER_BASE}/report/${r.runId}`,
      };
    })
  );

  return full;
}

export async function fetchRecentCompetitorReports(limit = 5): Promise<CompetitorReportSummary[]> {
  const list = (await safeFetch(`${COMPETITOR_ANALYSER_BASE}/api/debug/reports`)) as {
    reports?: Array<{ runId: string; status: string; url: string; focus: string; createdAt: string }>;
  } | null;

  if (!list?.reports) return [];

  const completed = list.reports
    .filter((r) => r.status === "completed")
    .slice(0, limit);

  const full = await Promise.all(
    completed.map(async (r) => {
      const detail = (await safeFetch(`${COMPETITOR_ANALYSER_BASE}/api/report/${r.runId}`)) as {
        focCid?: string;
        focListingId?: string | null;
      } | null;
      return {
        runId: r.runId,
        status: r.status as CompetitorReportSummary["status"],
        url: r.url,
        focus: r.focus,
        focCid: detail?.focCid,
        focListingId: detail?.focListingId,
        createdAt: r.createdAt,
        reportUrl: `${COMPETITOR_ANALYSER_BASE}/report/${r.runId}`,
      };
    })
  );

  return full;
}
