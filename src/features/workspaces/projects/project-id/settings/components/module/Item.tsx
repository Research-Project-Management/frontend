'use client';

import React from 'react';
import { Switch } from '@/shared/components/ui';
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
          : 'border-transparent bg-muted/40',
        mod.locked && 'opacity-70',
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            active
              ? 'bg-muted text-foreground'
              : 'bg-muted/60 text-muted-foreground',
          )}
        >
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground leading-tight">
            {mod.label}
          </h3>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
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
