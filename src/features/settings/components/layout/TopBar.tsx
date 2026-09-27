import React from 'react';
import { cn } from '@/shared/lib/utils';

export function TopBar({
  title,
  Icon,
  className,
}: {
  title: string;
  description?: string;
  Icon?: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'flex items-center justify-between border-b border-border bg-transparent px-3 sm:px-4 h-11 sticky top-0 z-10 shrink-0 select-none overflow-x-auto scrollbar-none min-w-0',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 shrink-0 mr-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="size-4 text-foreground shrink-0" strokeWidth={1.5} />}
          <span className="text-14 font-semibold tracking-tight text-foreground truncate">
            {title}
          </span>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
