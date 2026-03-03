"use client";

import Link from "next/link";
import type { Memory, MemoryTag } from "@/lib/data";
import { Button } from "@/components/ui/button";

interface MemoryCardProps {
  memory: Memory;
  onBuyClick?: (memory: Memory) => void;
  compact?: boolean;
}

const BOOK_PALETTES: Record<MemoryTag, { cover: string; spine: string; text: string; dim: string; border: string }> = {
  reasoning: {
    cover:  "linear-gradient(160deg, #1a2744 0%, #243358 50%, #1a2744 100%)",
    spine:  "#0e1928",
    text:   "#d4af5a",
    dim:    "#a08840",
    border: "rgba(212,175,90,0.25)",
  },
  memory: {
    cover:  "linear-gradient(160deg, #420f0f 0%, #581818 50%, #420f0f 100%)",
    spine:  "#280a0a",
    text:   "#d4a85a",
    dim:    "#a07840",
    border: "rgba(212,168,90,0.25)",
  },
  coding: {
    cover:  "linear-gradient(160deg, #0f2b1c 0%, #183826 50%, #0f2b1c 100%)",
    spine:  "#091a10",
    text:   "#7ecfa0",
    dim:    "#559e72",
    border: "rgba(126,207,160,0.2)",
  },
  vision: {
    cover:  "linear-gradient(160deg, #26133d 0%, #341a54 50%, #26133d 100%)",
    spine:  "#160a26",
    text:   "#c4a0e8",
    dim:    "#9470c0",
    border: "rgba(196,160,232,0.2)",
  },
  planning: {
    cover:  "linear-gradient(160deg, #0f2828 0%, #183838 50%, #0f2828 100%)",
    spine:  "#091818",
    text:   "#6ecfc0",
    dim:    "#489e90",
    border: "rgba(110,207,192,0.2)",
  },
  "tool-use": {
    cover:  "linear-gradient(160deg, #2e1808 0%, #3d2410 50%, #2e1808 100%)",
    spine:  "#1c0e04",
    text:   "#d4a85a",
    dim:    "#a07840",
    border: "rgba(212,168,90,0.25)",
  },
};

const FALLBACK = BOOK_PALETTES.reasoning;

export function MemoryCard({ memory, onBuyClick }: MemoryCardProps) {
  const primaryTag = memory.tags[0] as MemoryTag;
  const p = BOOK_PALETTES[primaryTag] ?? FALLBACK;

  return (
    <div
      className="group relative flex overflow-hidden rounded-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
      style={{
        background: p.cover,
        boxShadow: `
          -3px 0 0 ${p.spine},
          3px 6px 20px rgba(0,0,0,0.45),
          6px 12px 40px rgba(0,0,0,0.2)
        `,
        minHeight: "260px",
      }}
    >
      {/* Book spine */}
      <div
        className="shrink-0 w-5 flex flex-col items-center justify-center gap-1 relative"
        style={{ background: `linear-gradient(90deg, ${p.spine} 0%, rgba(255,255,255,0.04) 60%, ${p.spine} 100%)` }}
      >
        <div className="w-px flex-1 max-h-16" style={{ background: p.border }} />
        <div className="h-px w-3" style={{ background: p.text, opacity: 0.5 }} />
        <div className="h-px w-3" style={{ background: p.text, opacity: 0.3 }} />
        <div className="w-px flex-1 max-h-16" style={{ background: p.border }} />
      </div>

      {/* Cover content */}
      <div className="flex flex-1 flex-col p-5 pl-4">
        {/* Top ornamental line */}
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${p.text}, transparent)`, opacity: 0.4 }} />
          <div className="h-1 w-1 rounded-full" style={{ background: p.text, opacity: 0.4 }} />
        </div>

        {/* Title */}
        <Link href={`/memory/${memory.id}`} className="block mb-2">
          <h3
            className="font-bold leading-snug tracking-wide group-hover:opacity-90 transition-opacity"
            style={{
              fontFamily: "var(--font-playfair-display), serif",
              color: p.text,
              fontSize: "1.05rem",
              textShadow: `0 1px 4px rgba(0,0,0,0.5)`,
            }}
          >
            {memory.name}
          </h3>
        </Link>

        {/* Description */}
        <p
          className="text-xs leading-relaxed line-clamp-3 flex-1"
          style={{ color: p.dim }}
        >
          {memory.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {memory.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full border font-medium tracking-wide"
              style={{ color: p.dim, borderColor: p.border, background: "rgba(0,0,0,0.2)" }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Bottom ornamental divider */}
        <div className="flex items-center gap-2 my-4">
          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${p.text}, transparent)`, opacity: 0.25 }} />
          <div className="h-px w-4" style={{ background: p.text, opacity: 0.25 }} />
          <div className="h-px flex-1 rotate-180" style={{ background: `linear-gradient(90deg, ${p.text}, transparent)`, opacity: 0.25 }} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] font-medium" style={{ color: p.dim }}>{memory.author}</span>
            <span className="text-[11px]" style={{ color: p.dim, opacity: 0.7 }}>{memory.price} FIL</span>
          </div>
          <Button
            size="sm"
            className="rounded-full text-xs border"
            style={{
              background: "transparent",
              color: p.text,
              borderColor: p.border,
            }}
            onClick={() => onBuyClick?.(memory)}
          >
            Buy & Install
          </Button>
        </div>
      </div>
    </div>
  );
}
