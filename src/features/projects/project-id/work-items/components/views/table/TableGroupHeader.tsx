'use client';

import React from 'react';

export interface TableGroupHeaderProps {
  title: string;
  color?: string;
  icon?: React.ReactNode;
  count: number;
  isExpanded: boolean;
  onToggle: () => void;
  onQuickAdd?: () => void;
  isReadOnly?: boolean;
}

export function TableGroupHeader({
  title,
  color,
  icon,
  count,
  isExpanded,
  onToggle,
  onQuickAdd,
  isReadOnly,
}: TableGroupHeaderProps) {
  return (
    <div
      role="row"
      onClick={onToggle}
      className="sticky top-9 z-20 flex items-center h-9 px-2.5 border-b border-border bg-muted/50 hover:bg-muted/70 backdrop-blur-xs transition-colors cursor-pointer select-none gap-2 text-xs font-medium text-foreground w-full"
    >
      <div className="sticky left-2.5 flex items-center gap-2 shrink-0">
        {icon ? (
          icon
        ) : (
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: color || '#6B7280' }}
          />
        )}

        <span className="font-semibold text-foreground truncate">{title}</span>

        <span className="rounded-md bg-background border border-border px-1.5 py-0.2 text-10 font-mono font-medium text-muted-foreground tabular-nums">
          {count}
        </span>
      </div>
    </div>
  );
}
