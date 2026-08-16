'use client';

import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { Switch } from '@/shared/components/ui';

interface AutomationProps {
  autoAdvance: boolean;
  onToggle: (checked: boolean) => void;
  disabled?: boolean;
}

export function Automation({
  autoAdvance,
  onToggle,
  disabled,
}: AutomationProps) {
  return (
    <div className="rounded-lg border border-border/80 bg-card/40 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground">
          Cycle automation
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Automate cycle transitions to keep research momentum going without manual intervention.
        </p>
      </div>

      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <RefreshCcw className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground">
              Auto-advance cycles
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Automatically start the next scheduled cycle when the current one ends.
            </div>
          </div>
        </div>

        <Switch
          checked={autoAdvance}
          onCheckedChange={onToggle}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
