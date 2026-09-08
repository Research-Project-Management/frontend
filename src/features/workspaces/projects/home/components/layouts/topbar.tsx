import React from "react";
import { Home, Shapes } from "lucide-react";

interface TopbarProps {
  onManageWidgetsClick: () => void;
}

export function Topbar({ onManageWidgetsClick }: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0 select-none"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2.5">
        <Home className="size-4 text-foreground shrink-0" aria-hidden="true" />
        <h1 className="text-sm font-semibold tracking-tight text-foreground transition-colors duration-200">
          Home
        </h1>
      </div>

      <button
        type="button"
        className="flex items-center h-8 gap-2 rounded-md border border-border bg-background px-3 text-13 font-medium text-foreground cursor-pointer shadow-none transition-colors"
        onClick={onManageWidgetsClick}
      >
        <Shapes className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
        <span>Manage widgets</span>
      </button>
    </header>
  );
}
