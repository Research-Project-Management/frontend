'use client';

import React from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Button,
} from '@/shared/components/ui';
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
import type { TaskPriority } from '../../../../types/task.types';

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  urgent: { label: 'Urgent', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50 text-red-700 border-red-200' },
  high: { label: 'High', icon: ArrowUp, color: 'text-orange-600', bg: 'bg-orange-50 text-orange-700 border-orange-200' },
  medium: { label: 'Medium', icon: Minus, color: 'text-amber-600', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: 'Low', icon: ArrowDown, color: 'text-blue-600', bg: 'bg-blue-50 text-blue-700 border-blue-200' },
  none: { label: 'None', icon: CircleSlash, color: 'text-zinc-400', bg: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
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
            'h-7 px-2.5 text-xs font-medium rounded-sm border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer',
            actionBtnClass
          )}
        >
          <CurrentIcon className={cn('size-3.5', currentConfig.color)} />
          <span>{priority && priority !== 'none' ? currentConfig.label : 'Priority'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-1 rounded-sm border-border shadow-xl bg-popover"
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
                  'w-full flex items-center justify-between px-2 py-1.5 rounded-xs text-xs font-medium transition-colors hover:bg-muted cursor-pointer text-left',
                  isSelected && 'bg-muted/80 text-foreground'
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('size-3.5', item.color)} />
                  <span>{item.label}</span>
                </div>
                {isSelected && <Check className="size-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};
