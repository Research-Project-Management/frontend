'use client';

import React from 'react';
import { Switch } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { ModuleDef } from '../../types/module.types';

interface ItemProps {
  mod: ModuleDef;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
}

export function Item({ mod, active, disabled, onToggle }: ItemProps) {
  const Icon = mod.icon;

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 rounded-md border p-4 transition-colors',
        active
          ? 'border-border bg-background hover:bg-muted/30'
          : 'border-border/60 bg-muted/20 opacity-60',
        mod.locked && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md bg-muted',
            active ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <Icon className="size-4 shrink-0" />
        </div>
        <div className="min-w-0">
          <h3 className="text-13 font-semibold text-foreground leading-tight">
            {mod.label}
          </h3>
          <p className="text-12 text-muted-foreground leading-snug mt-0.5">
            {mod.desc}
          </p>
        </div>
      </div>

      <div className="relative shrink-0 flex items-center">
        <Switch
          checked={active}
          onCheckedChange={onToggle}
          disabled={disabled || mod.locked}
          aria-label={`Enable ${mod.label} module`}
          className="relative before:absolute before:-inset-2 md:before:hidden focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>
    </div>
  );
}
