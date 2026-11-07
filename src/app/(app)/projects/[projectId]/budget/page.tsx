'use client';

import React from 'react';
import { Wallet } from 'lucide-react';

export default function BudgetRoute() {
  return (
    <div className="flex-1 flex min-h-0 flex-col h-full bg-background overflow-hidden">
      {/* Top Header */}
      <header
        className="h-11 border-b border-border px-3 sm:px-4 flex items-center justify-between gap-2 bg-background shrink-0 text-13 w-full min-w-0 select-none sticky top-0 z-10"
        style={{ paddingLeft: 'max(0.75rem, var(--header-offset, 0px))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wallet className="size-4 text-foreground shrink-0" strokeWidth={1.75} />
          <h1 className="text-13 font-semibold text-foreground tracking-tight truncate">
            Budget
          </h1>
        </div>
      </header>

      {/* Module not yet available: empty state */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="size-12 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground mb-3 border border-border/50">
          <Wallet className="size-6 text-foreground/70" strokeWidth={1.5} />
        </div>
        <h2 className="text-16 font-semibold text-foreground tracking-tight">
          Project Budget
        </h2>
        <p className="text-13 text-muted-foreground max-w-sm mt-1">
          Financial tracking, income, expenses and research funding management.
        </p>
      </div>
    </div>
  );
}
