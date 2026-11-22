'use client';

import React from 'react';
import { Switch } from '@/shared/components/ui/switch';
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
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background hover:bg-muted/30 p-4 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
          <Icon className="size-4 shrink-0" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-13 font-semibold text-foreground leading-tight">
              {mod.label}
            </h3>
            {mod.locked && (
              <span className="px-1.5 py-0.5 rounded text-10 font-medium bg-muted text-muted-foreground shrink-0">
                Core
              </span>
            )}
          </div>
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
