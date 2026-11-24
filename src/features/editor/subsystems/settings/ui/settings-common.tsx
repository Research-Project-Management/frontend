'use client';

/**
 * settings-common.tsx
 *
 * Shared layout rows, switches, and font constants for Project Settings.
 */

import React from 'react';
import { Switch } from '@/shared/components/ui/switch';
import { cn } from '@/shared/lib/utils';

export const EDITOR_FONT_FAMILIES = [
  { id: 'default', label: 'Default Monospace' },
  { id: 'fira', label: 'Fira Code' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
  { id: 'consolas', label: 'Consolas' },
  { id: 'source-code', label: 'Source Code Pro' },
  { id: 'courier', label: 'Courier New' },
  { id: 'inconsolata', label: 'Inconsolata' },
  { id: 'opendyslexic', label: 'OpenDyslexic' },
];

export const EDITOR_FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24];

export function SettingsSwitch({
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
        'cursor-pointer transition-colors relative after:absolute after:-inset-2 after:content-[\'\']',
        'data-[state=checked]:bg-primary',
        'data-[state=unchecked]:bg-muted-foreground/30',
        'h-[22px] w-[40px]',
      )}
    />
  );
}

export function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 py-2.5 border-b border-border/40 last:border-b-0">
      <div className="min-w-0 flex-1 pr-2">
        <h4 className="text-[13px] font-medium text-foreground leading-snug">{title}</h4>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}
