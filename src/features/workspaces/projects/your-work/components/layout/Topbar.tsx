'use client';

import React from 'react';
import { UserStar } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface TopbarProps {
  title?: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
  className?: string;
}

export default function Topbar({
  title = "Your Work",
  icon: Icon = UserStar,
  children,
  className,
}: TopbarProps) {
  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-md px-4 h-12 sticky top-0 z-10 shrink-0 select-none',
        className
      )}
      style={{ paddingLeft: 'max(1rem, var(--header-offset, 0px))' }}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="size-4 text-foreground shrink-0" />}
        <h1 className="text-sm font-semibold text-foreground tracking-tight">
          {title}
        </h1>
      </div>

      {children && (
        <div className="flex items-center gap-3">
          {children}
        </div>
      )}
    </header>
  );
}
