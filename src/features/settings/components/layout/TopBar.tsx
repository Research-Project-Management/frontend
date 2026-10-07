import React from 'react';
import { cn } from '@/shared/lib/utils';

export function TopBar({
  title,
  Icon,
  actions,
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
        'flex items-center justify-between border-b border-border bg-background px-4 h-11 sticky top-0 z-10 shrink-0 select-none overflow-x-auto scrollbar-none min-w-0',
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0 shrink-0 mr-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && <Icon className="size-4 text-foreground shrink-0" strokeWidth={1.75} />}
          <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {actions}
        </div>
      )}
    </header>
  );
}

export default TopBar;
