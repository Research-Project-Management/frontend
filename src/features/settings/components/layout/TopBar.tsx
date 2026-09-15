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
    <header className="flex items-center justify-between px-6 md:px-8 h-11 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none">
      <div
        className="flex items-center gap-2.5 min-w-0"
        style={{ paddingLeft: 'var(--header-offset, 0px)' }}
      >
        {Icon && <Icon className="size-4 text-foreground shrink-0" />}
        <h1 className="text-sm font-semibold text-foreground tracking-tight truncate">
          {title}
        </h1>
        {description && (
          <span className="hidden sm:inline-block text-11 text-muted-foreground truncate border-l border-border pl-2.5 ml-1">
            {description}
          </span>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}

export default TopBar;
