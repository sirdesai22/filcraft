/**
 * /live — Real-time agent output feed
 *
 * Shows the most recent completed runs from seo-agent and investor-finder,
 * including Filecoin CIDs and A2A enrichment links.
 */

import Link from "next/link";
import { ExternalLink, Search, TrendingUp, Database, ArrowRight } from "lucide-react";
import {
  fetchRecentSEOReports,
  fetchRecentInvestorReports,
  fetchRecentCompetitorReports,
  type SEOReportSummary,
  type InvestorReportSummary,
  type CompetitorReportSummary,
} from "@/lib/agent-reports";

export const dynamic = "force-dynamic";

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CidBadge({ cid }: { cid?: string }) {
  if (!cid) return null;
  const display = cid.startsWith("bafyDRYRUN") ? cid : `${cid.slice(0, 16)}…`;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
      <Database className="h-2.5 w-2.5" />
      {display}
    </span>
  );
}

function SEOCard({ report }: { report: SEOReportSummary }) {
  let host = report.userUrl;
  try {
    host = new URL(report.userUrl).hostname.replace("www.", "");
  } catch {}

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-semibold truncate">{host}</span>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(report.createdAt)}</span>
      </div>

      {report.targetKeyword && (
        <p className="text-xs text-muted-foreground">
          keyword: <span className="font-mono text-foreground">{report.targetKeyword}</span>
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <CidBadge cid={report.focCid} />
        {report.enrichmentRunId && (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono text-blue-600 dark:text-blue-400">
            <ArrowRight className="h-2.5 w-2.5" />
            A2A → investor
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-3 pt-1">
        <a
          href={report.reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View report <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-[10px] font-mono text-muted-foreground truncate">{report.runId}</span>
      </div>
    </div>
  );
}

function CompetitorCard({ report }: { report: CompetitorReportSummary }) {
  let host = report.url;
  try {
    host = new URL(report.url).hostname.replace("www.", "");
  } catch {}

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-semibold truncate">{host}</span>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(report.createdAt)}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        focus: <span className="font-mono text-foreground">{report.focus}</span>
      </p>

      <div className="flex flex-wrap gap-1.5">
        <CidBadge cid={report.focCid} />
      </div>

      <div className="mt-auto flex items-center gap-3 pt-1">
        <a
          href={report.reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View report <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-[10px] font-mono text-muted-foreground truncate">{report.runId}</span>
      </div>
    </div>
  );
}

function InvestorCard({ report }: { report: InvestorReportSummary }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-semibold truncate">{report.space}</span>
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(report.createdAt)}</span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2">{report.idea}</p>

      <div className="flex flex-wrap gap-1.5">
        <CidBadge cid={report.focCid} />
      </div>

      <div className="mt-auto flex items-center gap-3 pt-1">
        <a
          href={report.reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          View report <ExternalLink className="h-3 w-3" />
        </a>
        <span className="text-[10px] font-mono text-muted-foreground truncate">{report.runId}</span>
      </div>
    </div>
  );
}

export default async function LivePage() {
  const [seoReports, investorReports, competitorReports] = await Promise.all([
    fetchRecentSEOReports(6),
    fetchRecentInvestorReports(6),
    fetchRecentCompetitorReports(6),
  ]);

  const seoBase = process.env.SEO_AGENT_URL ?? "https://seo-agent-rouge-five.vercel.app";
  const invBase = process.env.INVESTOR_FINDER_URL_PUBLIC ?? "https://investor-finder-three.vercel.app";
  const cmpBase = process.env.COMPETITOR_ANALYSER_URL ?? "https://competitor-analyser.vercel.app";

  return (
    <div className="container px-4 py-16 md:px-6 max-w-6xl mx-auto space-y-16">
      {/* Hero */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        </div>
        <h1
          className="text-4xl font-bold tracking-tight text-foreground md:text-5xl"
          style={{ fontFamily: "var(--font-playfair-display), serif" }}
        >
          Agent Runs
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Real completed analyses from deployed agents. Each run stores its output on Filecoin
          (CID shown), and SEO analyses automatically trigger investor discovery via A2A.
        </p>
      </section>

      {/* SEO Agent */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-playfair-display), serif" }}
            >
              SEO Analyses
            </h2>
            <p className="text-sm text-muted-foreground">
              Powered by{" "}
              <a
                href={seoBase}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:underline"
              >
                seo-agent
              </a>
              {" "}· x402 payment gated · Filecoin-stored
            </p>
          </div>
          <Link
            href="/agents/filecoinCalibration/12"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Agent #12 <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {seoReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed runs yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {seoReports.map((r) => (
              <SEOCard key={r.runId} report={r} />
            ))}
          </div>
        )}
      </section>

      {/* Investor Finder */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-playfair-display), serif" }}
            >
              Investor Analyses
            </h2>
            <p className="text-sm text-muted-foreground">
              Powered by{" "}
              <a
                href={invBase}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:underline"
              >
                investor-finder
              </a>
              {" "}· triggered via A2A or direct x402 · Filecoin-stored
            </p>
          </div>
          <Link
            href="/agents/filecoinCalibration/13"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Agent #13 <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {investorReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed runs yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {investorReports.map((r) => (
              <InvestorCard key={r.runId} report={r} />
            ))}
          </div>
        )}
      </section>

      {/* Competitor Analyser */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-playfair-display), serif" }}
            >
              Competitor Analyses
            </h2>
            <p className="text-sm text-muted-foreground">
              Powered by{" "}
              <a
                href={cmpBase}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono hover:underline"
              >
                competitor-analyser
              </a>
              {" "}· x402 payment gated · SWOT analysis · Filecoin-stored
            </p>
          </div>
          <Link
            href="/agents/filecoinCalibration/14"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            Agent #14 <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {competitorReports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed runs yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {competitorReports.map((r) => (
              <CompetitorCard key={r.runId} report={r} />
            ))}
          </div>
        )}
      </section>

      {/* How it connects */}
      <section className="rounded-xl border border-border bg-card p-8 space-y-4 max-w-3xl">
        <h2
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-playfair-display), serif" }}
        >
          The pipeline
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          {[
            {
              step: "01",
              title: "User pays x402",
              body: "Client pays ~$0.01 USDC on Base Sepolia. seo-agent verifies the payment header and starts the workflow.",
            },
            {
              step: "02",
              title: "Agent stores on Filecoin",
              body: "On completion, seo-agent serialises the report JSON and records a CID + listing on DataListingRegistry (Filecoin Calibration).",
            },
            {
              step: "03",
              title: "A2A enrichment",
              body: "seo-agent calls investor-finder via an internal key bypass. investor-finder discovers relevant VCs and stores its own Filecoin artifact.",
            },
          ].map(({ step, title, body }) => (
            <div key={step} className="space-y-2">
              <span className="font-mono text-3xl font-bold text-muted-foreground/25 leading-none block">
                {step}
              </span>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground leading-snug">{body}</p>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-border font-mono text-xs text-muted-foreground space-y-1">
          <p>Network: Filecoin Calibration (chainId 314159)</p>
          <p>DataListingRegistry: 0xdd6c9772e4a3218f8ca7acbaeeea2ce02eb1dbf6</p>
          <p>AgentEconomyRegistry: 0x87ca5e54a3afd16f3ff5101ffbede586bac1292a</p>
        </div>
      </section>
    </div>
  );
}
