import React from "react";
import { Home, Shapes } from "lucide-react";
import { Button } from '@/shared/components/ui/button';

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
        <Home className="size-4 text-foreground" aria-hidden="true" />
        <h1 className="text-sm font-semibold tracking-tight text-foreground transition-colors duration-200">
          Home
        </h1>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-2 rounded-md border border-border/60 bg-background px-3 text-[13px] font-medium text-foreground hover:bg-accent/60 cursor-pointer shadow-none transition-colors"
        onClick={onManageWidgetsClick}
      >
        <Shapes className="size-3.5 text-foreground" aria-hidden="true" />
        <span>Manage widgets</span>
      </Button>
    </header>
  );
}
