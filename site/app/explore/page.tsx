"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SkillEntry, SkillsTab } from "@/app/api/skills/route";

const TAB_OPTIONS: { id: SkillsTab; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "trending", label: "Trending (24h)" },
  { id: "hot", label: "Hot" },
];

export default function ExplorePage() {
  const [tab, setTab] = useState<SkillsTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/skills?tab=${tab}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setSkills(d.skills ?? []);
        else setError(d.error ?? "Failed to load");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  const filteredSkills = searchQuery
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          `${s.owner}/${s.repo}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : skills;

  const copyInstallCmd = (skill: SkillEntry) => {
    const cmd = `npx skills add https://github.com/${skill.owner}/${skill.repo} --skill ${skill.name}`;
    navigator.clipboard.writeText(cmd);
  };

  return (
    <div className="container space-y-8 px-4 py-8 md:px-6">
      {/* Header */}
      <div>
        <h1
          className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl"
          style={{ fontFamily: "var(--font-playfair-display), serif" }}
        >
          Agent Skills
        </h1>
        <p className="mt-2 text-muted-foreground">
          Reusable capabilities for AI agents. Install them with a single command.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 font-mono text-sm">
          <code className="flex-1">npx skills add</code>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => {
              navigator.clipboard.writeText("npx skills add");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {TAB_OPTIONS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary md:w-64"
          />
        </div>
      </div>

      {/* Leaderboard table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden rounded-lg border border-border"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-destructive">{error}</div>
        ) : filteredSkills.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No skills found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Skill</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Provider</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Installs</th>
                  <th className="w-10 px-2 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredSkills.map((skill) => (
                  <tr
                    key={skill.url}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-muted-foreground">{skill.rank}</td>
                    <td className="px-4 py-3 font-mono font-medium">{skill.name}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {skill.owner}/{skill.repo}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{skill.installs}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => copyInstallCmd(skill)}
                          title="Copy install command"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <a
                          href={skill.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                          title="View on skills.sh"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      <p className="text-center text-xs text-muted-foreground">
        Data from{" "}
        <a
          href="https://skills.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          skills.sh
        </a>
        {" "}— the open agent skills ecosystem.
      </p>
    </div>
  );
}
