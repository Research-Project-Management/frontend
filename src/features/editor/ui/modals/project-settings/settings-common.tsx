'use client';

/**
 * settings-common.tsx
 *
 * Reusable layout rows, switches, constants, and icons for Project Settings modal tabs.
 * Location: `features/editor/ui/modals/project-settings/settings-common.tsx`
 */

import React from 'react';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/lib/utils';

export const EDITOR_FONT_FAMILIES = [
  { id: 'default', label: 'Default Monospace (Monaco / Menlo)' },
  { id: 'fira', label: 'Fira Code' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
  { id: 'consolas', label: 'Consolas' },
  { id: 'source-code', label: 'Source Code Pro' },
  { id: 'courier', label: 'Courier New' },
  { id: 'inconsolata', label: 'Inconsolata' },
];

export const EDITOR_FONT_SIZES = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24];

export type SettingsTab =
  | 'editor'
  | 'compiler'
  | 'references'
  | 'github'
  | 'appearance'
  | 'notifications';

// ── Overleaf 1:1 Code Icon (<>) ────────────────────────────────────────────────
export function CodeIconBrackets({ className = 'size-4 shrink-0' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="8 7 3 12 8 17" />
      <polyline points="16 7 21 12 16 17" />
    </svg>
  );
}

// ── Overleaf 1:1 Switch (Toggle) ──────────────────────────────────────────────
export function OverleafSwitch({
  checked,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'cursor-pointer transition-colors',
        'data-[state=checked]:bg-primary',
        'data-[state=unchecked]:bg-muted-foreground/30',
        'h-[22px] w-[40px]'
      )}
    />
  );
}

// ── Overleaf Setting Row (Title, Subtitle, Control) ────────────────────────────
export function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-8 py-3.5 border-b border-border/30 last:border-b-0">
      <div className="min-w-0 flex-1 pr-4">
        <h4 className="text-sm font-medium text-foreground leading-snug">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}
