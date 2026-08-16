'use client';

import React from 'react';
import { Button } from '@/shared/components/ui';

interface EmptyStateProps {
  onCreate: () => void;
}

export function EmptyState({ onCreate }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      {/* 3-card stack illustration */}
      <svg
        width="96"
        height="96"
        viewBox="0 0 96 96"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-muted-foreground/35 dark:text-muted-foreground/25"
      >
        <rect
          x="24"
          y="14"
          width="44"
          height="56"
          rx="8"
          transform="rotate(-8 46 42)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.4"
          fill="transparent"
        />
        <rect
          x="28"
          y="17"
          width="44"
          height="56"
          rx="8"
          transform="rotate(-4 50 45)"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.6"
          className="fill-background"
        />
        <rect
          x="32"
          y="20"
          width="44"
          height="56"
          rx="8"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeOpacity="0.8"
          className="fill-background"
        />
        <g transform="translate(47, 41) scale(0.9)">
          <path
            d="M5 2L12 9L4 17L-3 10L-3 2L5 2Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="0" cy="5" r="1.5" fill="currentColor" />
        </g>
      </svg>

      <h3 className="text-base font-semibold text-foreground mt-4">No labels yet</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mt-1 mb-6">
        Create personalized labels to effectively categorize and manage your work items.
      </p>
      <Button
        size="sm"
        onClick={onCreate}
        className="h-8 text-xs font-medium px-4 rounded-md bg-[#0070f3] hover:bg-[#0060df] text-white cursor-pointer shadow-2xs"
      >
        Create your first label
      </Button>
    </div>
  );
}
