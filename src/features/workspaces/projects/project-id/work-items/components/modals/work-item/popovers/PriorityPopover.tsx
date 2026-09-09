'use client';

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  CircleSlash,
  Signal,
  Check,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { TaskPriority, WorkItemPriority } from '../../../../types/work-item.types';

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  urgent: { label: 'Urgent', icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10 text-destructive border-destructive/20' },
  high: { label: 'High', icon: ArrowUp, color: 'text-warning', bg: 'bg-warning/10 text-warning border-warning/20' },
  medium: { label: 'Medium', icon: Minus, color: 'text-warning', bg: 'bg-warning/10 text-warning border-warning/20' },
  low: { label: 'Low', icon: ArrowDown, color: 'text-primary', bg: 'bg-primary/10 text-primary border-primary/20' },
  none: { label: 'None', icon: CircleSlash, color: 'text-muted-foreground', bg: 'bg-muted text-muted-foreground border-border' },
};

interface PriorityPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priority: TaskPriority;
  setPriority: (priority: TaskPriority) => void;
  actionBtnClass?: string;
}

export const PriorityPopover: React.FC<PriorityPopoverProps> = ({
  open,
  onOpenChange,
  priority,
  setPriority,
  actionBtnClass,
}) => {
  const currentConfig = PRIORITY_CONFIG[priority || 'none'] || PRIORITY_CONFIG.none;
  const CurrentIcon = currentConfig.icon;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-medium rounded-md border-border bg-muted hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer shadow-none shrink-0',
            actionBtnClass
          )}
        >
          <CurrentIcon className={cn('size-3.5 shrink-0', currentConfig.color)} />
          <span>{priority && priority !== 'none' ? currentConfig.label : 'Priority'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-1 rounded-md border-border shadow-sm bg-popover z-100"
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
          Set Priority
        </div>
        <div className="space-y-0.5">
          {(Object.keys(PRIORITY_CONFIG) as TaskPriority[]).map((key) => {
            const item = PRIORITY_CONFIG[key];
            const Icon = item.icon;
            const isSelected = (priority || 'none') === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setPriority(key);
                  onOpenChange(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs font-medium transition-colors hover:bg-muted cursor-pointer text-left',
                  isSelected && 'bg-muted text-foreground font-semibold'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('size-3.5 shrink-0', item.color)} />
                  <span>{item.label}</span>
                </div>
                {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
