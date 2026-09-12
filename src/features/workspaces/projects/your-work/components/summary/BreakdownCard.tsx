'use client';

import React from 'react';
import { cn } from "@/shared/lib/utils";

export interface BreakdownItem {
  key?: string;
  label: string;
  count: number;
  color: string;
}

export interface BreakdownCardProps {
  title: string;
  items: BreakdownItem[];
  total: number;
  className?: string;
}

export function EmptyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 90"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-24 h-18 text-muted-foreground/30', className)}
    >
      {/* Back card */}
      <rect
        x="24"
        y="10"
        width="46"
        height="56"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="3 3"
        fill="none"
        className="opacity-40"
      />
      {/* Middle card */}
      <rect
        x="36"
        y="18"
        width="46"
        height="56"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.2"
        className="opacity-60 text-border"
        fill="currentColor"
      />
      {/* Front card */}
      <rect
        x="48"
        y="24"
        width="46"
        height="56"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.2"
        className="text-border"
        fill="currentColor"
      />
      {/* Bar chart lines inside front card */}
      <path
        d="M 59 64 V 54"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-muted-foreground/50"
      />
      <path
        d="M 68 64 V 44"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-muted-foreground/50"
      />
      <path
        d="M 77 64 V 36"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="text-muted-foreground/50"
      />
    </svg>
  );
}

export function BreakdownCard({
  title,
  items,
  total,
  className,
}: BreakdownCardProps) {
  const isEmpty = total === 0 || items.every((i) => (i.count || 0) === 0);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <h3 className="text-sm font-semibold text-foreground tracking-tight">
        {title}
      </h3>

      <div className="rounded-md bg-muted/40 p-5 min-h-[170px] flex flex-col justify-center">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <EmptyIllustration />
            <span className="text-xs text-muted-foreground mt-3 font-normal">
              No work item assigned yet
            </span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Stacked Horizontal Progress Bar */}
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex gap-0.5">
              {items.map((item) => {
                if (item.count <= 0) return null;
                const pct = Math.max((item.count / total) * 100, 2);
                return (
                  <div
                    key={item.key || item.label}
                    style={{ width: `${pct}%` }}
                    className={cn('h-full transition-all duration-300', item.color)}
                    title={`${item.label}: ${item.count} (${((item.count / total) * 100).toFixed(0)}%)`}
                  />
                );
              })}
            </div>

            {/* Breakdown Item Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {items.map((item) => {
                const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <div
                    key={item.key || item.label}
                    className="p-2.5 rounded-md bg-background/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      <span className={cn('size-2 rounded-full shrink-0', item.color)} />
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {item.label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 shrink-0">
                      <span className="text-xs font-semibold text-foreground tabular-nums">
                        {item.count}
                      </span>
                      <span className="text-10 text-muted-foreground tabular-nums">
                        ({percentage}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BreakdownCard;
