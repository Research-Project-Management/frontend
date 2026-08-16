'use client';

import React from 'react';

interface WorklogStatsProps {
  totalHours: number;
  totalEntries: number;
  activeContributors: number;
}

export function WorklogStats({
  totalHours,
  totalEntries,
  activeContributors,
}: WorklogStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="p-4 rounded-lg border border-border/80 bg-card/50 flex flex-col justify-between">
        <span className="text-xs text-muted-foreground font-medium">Total time spent</span>
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="text-2xl font-bold text-foreground tracking-tight">{totalHours}</span>
          <span className="text-xs text-muted-foreground">hours</span>
        </div>
      </div>

      <div className="p-4 rounded-lg border border-border/80 bg-card/50 flex flex-col justify-between">
        <span className="text-xs text-muted-foreground font-medium">Logged entries</span>
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="text-2xl font-bold text-foreground tracking-tight">{totalEntries}</span>
          <span className="text-xs text-muted-foreground">sessions</span>
        </div>
      </div>

      <div className="p-4 rounded-lg border border-border/80 bg-card/50 flex flex-col justify-between">
        <span className="text-xs text-muted-foreground font-medium">Active contributors</span>
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="text-2xl font-bold text-foreground tracking-tight">{activeContributors}</span>
          <span className="text-xs text-muted-foreground">members</span>
        </div>
      </div>
    </div>
  );
}
