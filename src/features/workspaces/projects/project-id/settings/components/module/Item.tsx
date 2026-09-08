'use client';

import React from 'react';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/lib/utils';
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
        'flex items-center justify-between gap-4 rounded-lg border p-4 transition-colors',
        active
          ? 'border-border bg-card'
          : 'border-transparent bg-muted',
        mod.locked && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            active
              ? 'bg-muted text-foreground'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="size-4 shrink-0" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">
            {mod.label}
          </h3>
          <p className="text-xs text-muted-foreground leading-snug mt-0.5">
            {mod.desc}
          </p>
        </div>
      </div>

      <Switch
        checked={active}
        onCheckedChange={onToggle}
        disabled={disabled || mod.locked}
      />
    </div>
  );
}
