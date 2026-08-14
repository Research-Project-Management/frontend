import React from "react";
import { Home, Shapes } from "lucide-react";
import { Button } from "@/shared/components/ui";

interface TopbarProps {
  onManageWidgetsClick: () => void;
}

export function Topbar({ onManageWidgetsClick }: TopbarProps) {
  return (
    <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-2.5">
        <Home className="size-4.5 text-foreground/70" aria-hidden="true" />
        <h1 className="text-sm font-semibold text-foreground transition-colors duration-200">
          Home
        </h1>
      </div>

      <Button
        variant="outline"
        size="sm"
        className="min-h-[44px] md:min-h-0 md:h-8 gap-2 rounded-lg border-border/50 bg-background px-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
        onClick={onManageWidgetsClick}
      >
        <Shapes className="size-4 text-foreground/60" aria-hidden="true" />
        <span>Manage widgets</span>
      </Button>
    </header>
  );
}
