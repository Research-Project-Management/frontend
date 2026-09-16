'use client';

import React from 'react';
import { cn } from "@/shared/lib/utils";

export interface IconProps {
  className?: string;
}

export function ListIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
      <line x1="3.5" x2="16.5" y1="5.5" y2="5.5" />
      <line x1="3.5" x2="16.5" y1="10" y2="10" />
      <line x1="3.5" x2="16.5" y1="14.5" y2="14.5" />
    </svg>
  );
}

export function BoardIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <line x1="7.6" y1="3" x2="7.6" y2="17" />
      <line x1="12.4" y1="3" x2="12.4" y2="17" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="14" height="12.5" rx="2.5" />
      <line x1="3" y1="8.5" x2="17" y2="8.5" />
      <line x1="6.5" y1="2.5" x2="6.5" y2="4.5" />
      <line x1="13.5" y1="2.5" x2="13.5" y2="4.5" />
    </svg>
  );
}

export function TableIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2.5" />
      <line x1="3" y1="8" x2="17" y2="8" />
      <line x1="9" y1="8" x2="9" y2="17" />
    </svg>
  );
}

export function TimelineIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="7.5" height="4" rx="2" />
      <rect x="9.5" y="11" width="7.5" height="4" rx="2" />
    </svg>
  );
}

export function FilterFunnelIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
    >
      <line x1="3.5" x2="16.5" y1="5.5" y2="5.5" />
      <line x1="6" x2="14" y1="10" y2="10" />
      <line x1="8.5" x2="11.5" y1="14.5" y2="14.5" />
    </svg>
  );
}

export function TextLinesIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="15" y1="12" x2="3" y2="12" />
      <line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  );
}

export function ItemsIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

export function ParentBranchIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="8" height="6" rx="1.5" />
      <rect x="13" y="14" width="8" height="6" rx="1.5" />
      <path d="M7 10v5a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

export function ConcentricCirclesIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('size-4 shrink-0 text-foreground', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.2" />
    </svg>
  );
}

export function ViewsOutlineIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('size-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

export function SortAscendingIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('size-3.5 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8 4-4 4 4" />
      <path d="M7 4v16" />
      <path d="M11 12h4" />
      <path d="M11 16h7" />
      <path d="M11 20h10" />
    </svg>
  );
}

export function SortDescendingIcon({ className }: IconProps) {
  return (
    <svg
      className={cn('size-3.5 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="M11 4h10" />
      <path d="M11 8h7" />
      <path d="M11 12h4" />
    </svg>
  );
}
