'use client';

/**
 * SidebarPanelHeader.tsx
 *
 * Canonical Viewlet Header for Primary Sidebar (Core Workbench Shell).
 */

import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface SidebarPanelHeaderProps {
  title: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  closeAriaLabel?: string;
  bordered?: boolean;
}

export function SidebarPanelHeader({
  title,
  children,
  className,
  bordered = false,
}: SidebarPanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-9 shrink-0 items-center justify-between px-3 select-none',
        bordered && 'border-b border-border',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
        {typeof title === 'string' ? (
          <span className="font-semibold text-13 text-foreground tracking-tight truncate">
            {title}
          </span>
        ) : (
          title
        )}
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {children}
      </div>
    </div>
  );
}

export default SidebarPanelHeader;
