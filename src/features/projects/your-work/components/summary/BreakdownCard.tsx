'use client';

import React, { useState, useEffect } from 'react';
import { cn } from "@/shared/lib/utils";

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

export interface BreakdownTooltipItem {
  label: string;
  count: number;
  hex: string;
}

export interface BreakdownTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BreakdownTooltipItem }>;
  total: number;
  labelSuffix?: string;
  countSuffix?: string;
  dotClassName?: string;
}

export function BreakdownTooltip({
  active,
  payload,
  total,
  labelSuffix = '',
  countSuffix = '',
  dotClassName = 'size-2 rounded-full shrink-0',
}: BreakdownTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const percentage = total > 0 ? Math.round((data.count / total) * 100) : 0;

  return (
    <div className="rounded-md bg-popover px-2.5 py-1.5 text-12 text-popover-foreground border border-border shadow-overlay">
      <div className="flex items-center gap-1.5 font-medium">
        <span
          className={dotClassName}
          style={{ backgroundColor: data.hex }}
        />
        <span>{data.label}{labelSuffix}</span>
      </div>
      <div className="mt-1 text-11 text-muted-foreground flex items-center gap-1">
        <span className="font-medium text-foreground tabular-nums">
          {data.count}{countSuffix}
        </span>
        <span>({percentage}%)</span>
      </div>
    </div>
  );
}

export interface BreakdownCardProps {
  title: string;
  isEmpty: boolean;
  emptyText?: string;
  className?: string;
  children: (isMounted: boolean) => React.ReactNode;
}

export function BreakdownCard({
  title,
  isEmpty,
  emptyText = 'No work item assigned yet',
  className,
  children,
}: BreakdownCardProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <h3 className="text-13 font-semibold text-foreground tracking-tight">
        {title}
      </h3>

      <div className="rounded-md bg-muted/40 p-5 min-h-[290px] flex flex-col justify-center">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <EmptyIllustration />
            <span className="text-12 text-muted-foreground mt-3 font-normal">
              {emptyText}
            </span>
          </div>
        ) : (
          children(isMounted)
        )}
      </div>
    </div>
  );
}

export default BreakdownCard;


