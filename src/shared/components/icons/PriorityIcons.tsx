'use client';

import React from 'react';
import { cn } from "@/shared/lib/utils";

export interface PriorityIconProps {
  className?: string;
}

export function UrgentPriorityBoxIcon({ className }: PriorityIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn("size-3.5 shrink-0 text-red-500", className)}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.2" />
      <line x1="8" y1="4.5" x2="8" y2="8.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="11" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function HighPriorityBoxIcon({ className }: PriorityIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn("size-3.5 shrink-0 text-orange-500", className)}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5.5" y1="11" x2="5.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8" y1="11" x2="8" y2="6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10.5" y1="11" x2="10.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MediumPriorityBoxIcon({ className }: PriorityIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn("size-3.5 shrink-0 text-amber-500", className)}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.2" />
      <line x1="6.5" y1="11" x2="6.5" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9.5" y1="11" x2="9.5" y2="6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LowPriorityBoxIcon({ className }: PriorityIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn("size-3.5 shrink-0 text-blue-500", className)}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.2" />
      <line x1="8" y1="11" x2="8" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function NonePriorityBoxIcon({ className }: PriorityIconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn("size-3.5 shrink-0 text-muted-foreground", className)}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.1" />
      <line x1="5.7" y1="5.7" x2="10.3" y2="10.3" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

export function NonePriorityTriggerIcon({ className }: PriorityIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={cn("size-3.5 shrink-0 text-muted-foreground", className)}
    >
      <circle cx="8" cy="8" r="6" strokeDasharray="2.5 2" />
    </svg>
  );
}

/** 3 Ascending bars (Priority signal bars) */
export function PrioritySignalBarsIcon({ className }: PriorityIconProps) {
  return (
    <svg className={cn('size-4 shrink-0 text-foreground', className)} viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="14" width="3.2" height="6" rx="1" />
      <rect x="10.4" y="9" width="3.2" height="11" rx="1" />
      <rect x="16.8" y="4" width="3.2" height="16" rx="1" />
    </svg>
  );
}
