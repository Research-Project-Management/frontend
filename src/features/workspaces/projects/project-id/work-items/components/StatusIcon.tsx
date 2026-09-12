'use client';

import React from 'react';
import { cn } from "@/shared/lib/utils";

export interface StatusIconProps {
  id?: string;
  title?: string;
  group?: string;
  category?: string;
  color?: string;
  className?: string;
}

/**
 * Backlog: Dotted / dashed circle (zinc gray)
 */
export function BacklogStatusIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke={color || "currentColor"}
      strokeWidth="1.5"
      className={cn("size-3.5 shrink-0", !color && "text-muted-foreground", className)}
      aria-label="Backlog"
    >
      <circle cx="8" cy="8" r="6" strokeDasharray="2.2 1.8" />
    </svg>
  );
}

/**
 * Todo / Unstarted: Hollow outlined circle
 */
export function TodoStatusIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke={color || "currentColor"}
      strokeWidth="1.75"
      className={cn("size-3.5 shrink-0", !color && "text-muted-foreground", className)}
      aria-label="Todo"
    >
      <circle cx="8" cy="8" r="6.25" />
    </svg>
  );
}

/**
 * In Progress / Started: Concentric double circle (bullseye) in orange/amber
 */
export function InProgressStatusIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke={color || "#f59e0b"}
      strokeWidth="1.5"
      className={cn("size-3.5 shrink-0", !color && "text-amber-500", className)}
      aria-label="In Progress"
    >
      <circle cx="8" cy="8" r="6.25" />
      <circle cx="8" cy="8" r="2.75" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Done / Completed: Solid emerald green circle with white checkmark
 */
export function DoneStatusIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn("size-3.5 shrink-0", className)}
      aria-label="Done"
    >
      <circle cx="8" cy="8" r="7" fill={color || "#10b981"} />
      <path
        d="M4.75 8.25L7 10.5L11.5 5.75"
        stroke="#ffffff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Cancelled: Solid red circle with white cross ('x')
 */
export function CancelledStatusIcon({ className, color }: { className?: string; color?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className={cn("size-3.5 shrink-0", className)}
      aria-label="Cancelled"
    >
      <circle cx="8" cy="8" r="7" fill={color || "#ef4444"} />
      <path
        d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5"
        stroke="#ffffff"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Universal Workflow State Icon resolver
 */
export function StatusIcon({
  id,
  title = '',
  group = '',
  category = '',
  color,
  className,
}: StatusIconProps) {
  const normalizedGroup = (category || group).toLowerCase().trim();
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedId = (id || '').toLowerCase().trim();

  // 1. Backlog
  if (
    normalizedGroup === 'backlog' ||
    normalizedTitle.includes('backlog') ||
    normalizedId.includes('backlog')
  ) {
    return <BacklogStatusIcon className={className} color={color} />;
  }

  // 2. Todo / Unstarted
  if (
    normalizedGroup === 'unstarted' ||
    normalizedTitle === 'todo' ||
    normalizedTitle === 'to do' ||
    normalizedTitle.includes('todo') ||
    normalizedTitle.includes('to do') ||
    normalizedTitle.includes('unstarted') ||
    normalizedId === 'todo' ||
    normalizedId.includes('unstarted')
  ) {
    return <TodoStatusIcon className={className} color={color} />;
  }

  // 3. In Progress / Started
  if (
    normalizedGroup === 'started' ||
    normalizedTitle.includes('progress') ||
    normalizedTitle.includes('doing') ||
    normalizedTitle.includes('active') ||
    normalizedTitle.includes('in_progress') ||
    normalizedId.includes('progress') ||
    normalizedId.includes('started')
  ) {
    return <InProgressStatusIcon className={className} color={color} />;
  }

  // 4. Done / Completed
  if (
    normalizedGroup === 'completed' ||
    normalizedTitle.includes('done') ||
    normalizedTitle.includes('completed') ||
    normalizedTitle.includes('finished') ||
    normalizedId.includes('done') ||
    normalizedId.includes('completed')
  ) {
    return <DoneStatusIcon className={className} color={color} />;
  }

  // 5. Cancelled
  if (
    normalizedGroup === 'cancelled' ||
    normalizedTitle.includes('cancel') ||
    normalizedTitle.includes('closed') ||
    normalizedTitle.includes('rejected') ||
    normalizedId.includes('cancel')
  ) {
    return <CancelledStatusIcon className={className} color={color} />;
  }

  // Fallback: custom state using accentColor
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth="1.75"
      className={cn("size-3.5 shrink-0", className)}
      aria-label={title || "Status"}
    >
      <circle cx="8" cy="8" r="6.25" />
    </svg>
  );
}
