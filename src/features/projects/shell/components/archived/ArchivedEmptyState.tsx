'use client';

import React from 'react';

export function ArchivedEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center select-none animate-in fade-in duration-300">
      {/* ── 3D Isometric Briefcase & Stack Illustration (Exact Mockup Match) ── */}
      <div className="mb-6 flex items-center justify-center">
        <svg
          width="200"
          height="140"
          viewBox="0 0 200 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-foreground/80 dark:text-foreground/70"
        >
          {/* Top-left floating card */}
          <g opacity="0.35">
            <rect
              x="28"
              y="26"
              width="36"
              height="22"
              rx="4"
              transform="skewY(-14) skewX(24)"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="transparent"
            />
            {/* Lines inside card */}
            <path
              d="M34 33h12M34 38h18"
              transform="skewY(-14) skewX(24)"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>

          {/* Top-right floating capsule */}
          <g opacity="0.35">
            <rect
              x="130"
              y="16"
              width="24"
              height="12"
              rx="6"
              transform="skewY(14) skewX(-20)"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="transparent"
            />
            <circle
              cx="135"
              cy="22"
              r="1.5"
              transform="skewY(14) skewX(-20)"
              fill="currentColor"
            />
            <path
              d="M141 22h8"
              transform="skewY(14) skewX(-20)"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </g>

          {/* Right floating circular badge */}
          <g opacity="0.35">
            <circle
              cx="165"
              cy="48"
              r="8"
              stroke="currentColor"
              strokeWidth="1.2"
              fill="transparent"
            />
            <path
              d="M162 46h6M162 49h4M162 52h2"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </g>

          {/* ── Base Stacked Trays (Isometric) ── */}
          {/* Layer 1 - Bottom tray */}
          <g opacity="0.18">
            <path
              d="M48 92 C48 88 56 83 66 80 L132 50 C142 46 154 48 160 54 L170 60 C176 66 174 74 164 78 L98 108 C88 112 76 110 70 104 Z"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="transparent"
            />
          </g>

          {/* Layer 2 - Middle tray */}
          <g opacity="0.35">
            <path
              d="M44 82 C44 78 52 73 62 70 L128 40 C138 36 150 38 156 44 L166 50 C172 56 170 64 160 68 L94 98 C84 102 72 100 66 94 Z"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="transparent"
            />
          </g>

          {/* Layer 3 - Top tray */}
          <g opacity="0.6">
            <path
              d="M40 72 C40 68 48 63 58 60 L124 30 C134 26 146 28 152 34 L162 40 C168 46 166 54 156 58 L90 88 C80 92 68 90 62 84 Z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="transparent"
            />
          </g>

          {/* ── Center Isometric Briefcase ── */}
          {/* Handle */}
          <path
            d="M86 36 V30 C86 27 89 25 92 25 H108 C111 25 114 27 114 30 V36"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-foreground"
          />

          {/* Briefcase Body (crisp & solid) */}
          <rect
            x="72"
            y="36"
            width="56"
            height="44"
            rx="8"
            className="fill-background stroke-foreground"
            strokeWidth="1.8"
          />

          {/* Briefcase horizontal accent seam */}
          <line
            x1="72"
            y1="50"
            x2="128"
            y2="50"
            stroke="currentColor"
            strokeWidth="1.2"
            opacity="0.3"
          />
        </svg>
      </div>

      {/* ── Title & Description ── */}
      <div className="space-y-2 max-w-sm px-4">
        <h3 className="text-base font-semibold text-foreground tracking-tight">
          No archived projects yet
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Archived projects move out of the active projects list but aren&apos;t deleted. You&apos;ll find them here.
        </p>
      </div>
    </div>
  );
}

export default ArchivedEmptyState;
