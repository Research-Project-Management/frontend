'use client';

import React from 'react';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { cn } from '@/shared/lib/utils';

export interface GroupCheckboxProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.MouseEvent) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

export function GroupCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  ariaLabel = 'Select all items in this group',
}: GroupCheckboxProps) {
  if (disabled) return null;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange(e);
      }}
      className={cn(
        'size-3.5 flex items-center justify-center cursor-pointer shrink-0 transition-opacity duration-150',
        checked || indeterminate
          ? 'opacity-100 pointer-events-auto'
          : 'opacity-0 pointer-events-none group-hover/header:opacity-100 group-hover/header:pointer-events-auto group-focus-within/header:opacity-100 group-focus-within/header:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto',
      )}
    >
      <Checkbox
        checked={indeterminate ? 'indeterminate' : checked}
        onCheckedChange={() => {}}
        aria-label={ariaLabel}
        className="size-3.5 rounded-sm"
      />
    </div>
  );
}
