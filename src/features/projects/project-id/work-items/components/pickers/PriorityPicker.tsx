'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import type { Priority } from '@/features/projects/project-id/work-items/types/work-item.types';
import { PRIORITY_CONFIG } from '@/features/projects/project-id/work-items/types/work-item.types';
import {
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
  NonePriorityTriggerIcon,
} from '@/shared/components/icons';

export {
  PRIORITY_CONFIG,
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
  NonePriorityTriggerIcon,
};

export const NonePriorityIcon = NonePriorityTriggerIcon;

import type { PriorityPopoverProps } from '@/features/projects/project-id/work-items/types/picker.types';

export type { PriorityPopoverProps };

const PRIORITY_OPTIONS: { id: Priority; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'urgent', label: 'Urgent', icon: UrgentPriorityBoxIcon },
  { id: 'high', label: 'High', icon: HighPriorityBoxIcon },
  { id: 'medium', label: 'Medium', icon: MediumPriorityBoxIcon },
  { id: 'low', label: 'Low', icon: LowPriorityBoxIcon },
  { id: 'none', label: 'None', icon: NonePriorityBoxIcon },
];

export const PriorityPopover: React.FC<PriorityPopoverProps> = ({
  open,
  onOpenChange,
  priority,
  setPriority: propSetPriority,
  onSelectPriority,
  actionBtnClass,
  isReadOnly = false,
  defaultLabel,
}) => {
  const setPriority = propSetPriority || onSelectPriority || (() => {});
  const currentKey = priority || 'none';
  const currentOption = PRIORITY_OPTIONS.find((o) => o.id === currentKey) || PRIORITY_OPTIONS[4];
  const TriggerIcon = currentKey === 'none' ? NonePriorityTriggerIcon : currentOption.icon;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-normal rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
            actionBtnClass
          )}
        >
          <TriggerIcon />
          <span>{priority && priority !== 'none' ? currentOption.label : (defaultLabel || 'None')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-36 p-1 rounded-md border border-border bg-popover shadow-overlay z-100 flex flex-col space-y-0.5"
      >
        {PRIORITY_OPTIONS.map((opt) => {
          const isSelected = currentKey === opt.id;
          const IconComponent = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setPriority(opt.id);
                onOpenChange(false);
              }}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors hover:bg-muted cursor-pointer text-left',
                isSelected && 'bg-muted text-foreground font-medium'
              )}
            >
              <div className="flex items-center gap-2 truncate">
                <IconComponent />
                <span className="truncate">{opt.label}</span>
              </div>
              {isSelected && <Check className="size-4 shrink-0 text-foreground" />}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

export const PriorityPicker = PriorityPopover;
