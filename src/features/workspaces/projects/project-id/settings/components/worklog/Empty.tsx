'use client';

import React from 'react';

export function WorklogEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center select-none">
      {/* ── 3D Isometric Stacked Cards with Timer (Exact Mockup Match) ── */}
      <div className="mb-6 flex items-center justify-center">
        <svg
          width="130"
          height="100"
          viewBox="0 0 130 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-foreground/80 dark:text-foreground/70"
        >
          {/* Card 1 (Back layer - faintest) */}
          <g opacity="0.15">
            <rect
              x="20"
              y="12"
              width="50"
              height="58"
              rx="12"
              transform="matrix(0.9 0.43 -0.43 0.9 38 4)"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="transparent"
            />
          </g>

          {/* Card 2 (Middle layer) */}
          <g opacity="0.35">
            <rect
              x="20"
              y="12"
              width="50"
              height="58"
              rx="12"
              transform="matrix(0.9 0.43 -0.43 0.9 44 8)"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="transparent"
            />
          </g>

          {/* Card 3 (Front layer - crisp with stopwatch) */}
          <g opacity="0.85">
            <rect
              x="20"
              y="12"
              width="50"
              height="58"
              rx="12"
              transform="matrix(0.9 0.43 -0.43 0.9 50 12)"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="transparent"
            />

            {/* Stopwatch on front card */}
            <g transform="translate(68, 52)">
              {/* Top knob */}
              <line
                x1="0"
                y1="-13.5"
                x2="0"
                y2="-16.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <line
                x1="-3"
                y1="-16.5"
                x2="3"
                y2="-16.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />

              {/* Side button */}
              <line
                x1="8.5"
                y1="-8.5"
                x2="10.5"
                y2="-10.5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />

              {/* Watch circle */}
              <circle
                cx="0"
                cy="0"
                r="11"
                stroke="currentColor"
                strokeWidth="1.6"
              />

              {/* Watch hands */}
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="0"
                y1="0"
                x2="4"
                y2="0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* ── Title & Message ── */}
      <h3 className="text-[15px] font-semibold text-foreground tracking-tight">
        Track timesheets for all members
      </h3>

      <p className="text-xs text-muted-foreground max-w-sm mt-2 leading-relaxed">
        Log time on work items to view detailed timesheets for any team member across projects.
      </p>
    </div>
  );
}
