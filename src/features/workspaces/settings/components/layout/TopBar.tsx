import React from 'react';

export function TopBar({
  title,
  description,
  Icon,
  actions,
}: {
  title: string;
  description?: string;
  Icon?: React.ComponentType<any>;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between px-6 md:px-10 lg:px-12 h-12 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <div
        className="flex items-center gap-2.5 min-w-0"
        style={{ paddingLeft: 'var(--header-offset, 0px)' }}
      >
        {Icon && <Icon className="size-4 text-foreground shrink-0" />}
        <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
          {title}
        </h1>
      </div>

      {actions && (
        <div className="flex items-center gap-3 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}

export default TopBar;
