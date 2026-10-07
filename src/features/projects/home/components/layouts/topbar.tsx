import React from "react";
import { Home, Shapes } from "lucide-react";

interface TopbarProps {
  onManageWidgetsClick: () => void;
}

export function Topbar({ onManageWidgetsClick }: TopbarProps) {
  return (
    <header
      className="flex items-center justify-between px-4 h-11 border-b border-border/60 bg-transparent shrink-0 select-none"
      style={{ paddingLeft: "max(1rem, var(--header-offset, 0px))" }}
    >
      <div className="flex items-center gap-2.5">
        <Home className="size-4 text-foreground shrink-0" aria-hidden="true" />
        <h1 className="text-13 font-semibold tracking-tight text-foreground transition-colors duration-200">
          Home
        </h1>
      </div>

      <button
        type="button"
        className="relative flex items-center h-8 gap-2 rounded-md border border-border bg-background hover:bg-muted px-3 text-13 font-medium text-foreground cursor-pointer shadow-none transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none touch-manipulation sm:after:hidden after:absolute after:-inset-1.5 after:content-['']"
        onClick={onManageWidgetsClick}
      >
        <Shapes className="size-3.5 text-foreground shrink-0" aria-hidden="true" />
        <span>Manage widgets</span>
      </button>
    </header>
  );
}
