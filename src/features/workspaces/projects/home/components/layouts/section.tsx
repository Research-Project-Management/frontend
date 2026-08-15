import React from "react";

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground select-none">
          {title}
        </h2>
        {action && <div>{action}</div>}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
