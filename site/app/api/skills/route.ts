import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export interface SkillEntry {
  rank: number;
  name: string;
  owner: string;
  repo: string;
  installs: string;
  url: string;
}

export type SkillsTab = "all" | "trending" | "hot";

const SKILLS_BASE = "https://skills.sh";
const TAB_URLS: Record<SkillsTab, string> = {
  all: `${SKILLS_BASE}/`,
  trending: `${SKILLS_BASE}/trending`,
  hot: `${SKILLS_BASE}/hot`,
};

/**
 * Parse skills from skills.sh HTML.
 * Looks for patterns: ### skill-name and [Nowner/repoINSTALLS](url)
 * or href="...skills.sh/owner/repo/skill" with nearby rank/installs.
 */
function parseSkillsFromHtml(html: string, tab: SkillsTab): SkillEntry[] {
  const skills: SkillEntry[] = [];
  const seen = new Set<string>();

  // Match markdown-style blocks: ### skill-name followed by [Nowner/repoINSTALLS](url)
  // owner/repo has no digits; installs are digits + optional K/M
  const blockRe = /### ([a-z0-9-]+)\s*\n\s*\[(\d+)([^[\d]+?)([\d.]+[KkMm]?)\]\((https:\/\/skills\.sh\/[^)]+)\)/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const [, name, rankStr, ownerRepo, installs, url] = m;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const [owner = "", repo = ""] = ownerRepo.split("/").filter(Boolean);
    skills.push({
      rank: parseInt(rankStr, 10),
      name: name ?? "",
      owner: owner ?? "",
      repo: repo ?? "",
      installs: installs ?? "",
      url: url ?? "",
    });
  }

  // Fallback: match href to skills.sh/owner/repo/skill and extract from context
  if (skills.length === 0) {
    const linkRe = /href="(https:\/\/skills\.sh\/([^/]+)\/([^/]+)\/([^/"']+))"/gi;
    let rank = 1;
    while ((m = linkRe.exec(html)) !== null) {
      const [, url, owner, repo, name] = m;
      if (!url || url.includes("og.") || url.includes("favicon")) continue;
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Try to find install count nearby - look for pattern like 385.6K after the link
      const after = html.slice(m.index, m.index + 200);
      const installMatch = after.match(/([\d.]+)([KkMm])/);
      const installs = installMatch ? `${installMatch[1]}${installMatch[2].toUpperCase()}` : "—";
      skills.push({ rank: rank++, name: name ?? "", owner: owner ?? "", repo: repo ?? "", installs, url: url ?? "" });
    }
  }

  return skills.sort((a, b) => a.rank - b.rank);
}

async function fetchSkillsForTab(tab: SkillsTab): Promise<SkillEntry[]> {
  const url = TAB_URLS[tab];
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Memfil/1.0 (skills directory)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const skills = parseSkillsFromHtml(html, tab);
    if (skills.length > 0) return skills;
  } catch (e) {
    console.warn(`[Skills API] Fetch failed for ${tab}:`, e);
  }
  return getStaticFallback(tab);
}

/**
 * Static fallback when scraping fails (e.g. skills.sh structure changes).
 */
function getStaticFallback(tab: SkillsTab): SkillEntry[] {
  const fallback: SkillEntry[] = [
    { rank: 1, name: "find-skills", owner: "vercel-labs", repo: "skills", installs: "385.6K", url: "https://skills.sh/vercel-labs/skills/find-skills" },
    { rank: 2, name: "vercel-react-best-practices", owner: "vercel-labs", repo: "agent-skills", installs: "186.0K", url: "https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices" },
    { rank: 3, name: "web-design-guidelines", owner: "vercel-labs", repo: "agent-skills", installs: "143.5K", url: "https://skills.sh/vercel-labs/agent-skills/web-design-guidelines" },
    { rank: 4, name: "remotion-best-practices", owner: "remotion-dev", repo: "skills", installs: "122.1K", url: "https://skills.sh/remotion-dev/skills/remotion-best-practices" },
    { rank: 5, name: "frontend-design", owner: "anthropics", repo: "skills", installs: "117.2K", url: "https://skills.sh/anthropics/skills/frontend-design" },
    { rank: 6, name: "azure-ai", owner: "microsoft", repo: "github-copilot-for-azure", installs: "114.8K", url: "https://skills.sh/microsoft/github-copilot-for-azure/azure-ai" },
    { rank: 7, name: "azure-observability", owner: "microsoft", repo: "github-copilot-for-azure", installs: "114.6K", url: "https://skills.sh/microsoft/github-copilot-for-azure/azure-observability" },
    { rank: 8, name: "agent-tools", owner: "inference-sh-9", repo: "skills", installs: "89.3K", url: "https://skills.sh/inference-sh-9/skills/agent-tools" },
    { rank: 9, name: "remotion-render", owner: "inference-sh-9", repo: "skills", installs: "88.8K", url: "https://skills.sh/inference-sh-9/skills/remotion-render" },
    { rank: 10, name: "agent-browser", owner: "inference-sh-9", repo: "skills", installs: "87.0K", url: "https://skills.sh/inference-sh-9/skills/agent-browser" },
  ];
  return fallback;
}

export async function GET(request: NextRequest) {
  const tab = (request.nextUrl.searchParams.get("tab") || "all") as SkillsTab;
  const validTab = ["all", "trending", "hot"].includes(tab) ? tab : "all";

  const getCached = unstable_cache(
    () => fetchSkillsForTab(validTab),
    ["skills-leaderboard", validTab],
    { revalidate: 3600, tags: ["skills"] }
  );

  try {
    const skills = await getCached();
    return NextResponse.json({ success: true, skills, tab: validTab });
  } catch (error) {
    console.error("[Skills API] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch skills", skills: getStaticFallback(validTab) },
      { status: 500 }
    );
  }
}
