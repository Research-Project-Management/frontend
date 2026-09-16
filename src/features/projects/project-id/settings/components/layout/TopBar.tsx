'use client';

import React from 'react';
import { cn } from '@/shared/lib/utils';

interface TopBarProps {
  title: string;
  description?: string;
  Icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function TopBar({
  title,
  description,
  Icon,
  actions,
  children,
  className,
}: TopBarProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 sm:px-6 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none gap-3',
        className,
      )}
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className="size-4 text-foreground shrink-0" />}
        <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
          {title}
        </h1>
      </div>

      {(actions || children) && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {actions}
          {children}
        </div>
      )}
    </header>
  );
}

export default TopBar;
