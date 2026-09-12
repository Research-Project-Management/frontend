'use client';

import React from 'react';
import { cn } from "@/shared/lib/utils";

const DURATION_OPTIONS = [
  { value: 1, label: '1 week' },
  { value: 2, label: '2 weeks' },
  { value: 3, label: '3 weeks' },
  { value: 4, label: '4 weeks' },
  { value: 6, label: '6 weeks' },
];

interface DurationProps {
  value: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}

export function Duration({ value, onChange, disabled }: DurationProps) {
  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          Default cycle duration
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          How long each research sprint or cycle runs by default when created.
        </p>
      </div>

      <div className="px-6 py-5">
        <div className="flex flex-wrap gap-2">
          {DURATION_OPTIONS.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt.value)}
                className={cn(
                  'px-3.5 py-1.5 rounded-md text-xs font-medium border transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
                  isSelected
                    ? 'bg-foreground text-background border-foreground font-semibold '
                    : 'bg-background text-muted-foreground border-border hover:border-foreground/30 ',
                  disabled && 'opacity-60 cursor-not-allowed'
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
