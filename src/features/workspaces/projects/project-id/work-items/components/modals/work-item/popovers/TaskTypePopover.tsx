'use client';

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  CheckSquare,
  Bug,
  Sparkles,
  TrendingUp,
  Zap,
  Check,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { TaskIssueType } from '../../../../types/work-item.types';
import { ISSUE_TYPE_CONFIG } from '../../../../types/work-item.types';

const ISSUE_TYPE_ICONS: Record<TaskIssueType, React.ElementType> = {
  task: CheckSquare,
  bug: Bug,
  feature: Sparkles,
  improvement: TrendingUp,
  epic: Zap,
};

interface TaskTypePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueType: TaskIssueType;
  setIssueType: (type: TaskIssueType) => void;
  actionBtnClass?: string;
  isReadOnly?: boolean;
}

export const TaskTypePopover: React.FC<TaskTypePopoverProps> = ({
  open,
  onOpenChange,
  issueType = 'task',
  setIssueType,
  actionBtnClass,
  isReadOnly = false,
}) => {
  const currentKey = (issueType in ISSUE_TYPE_CONFIG ? issueType : 'task') as TaskIssueType;
  const currentConfig = ISSUE_TYPE_CONFIG[currentKey];
  const CurrentIcon = ISSUE_TYPE_ICONS[currentKey] || CheckSquare;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-medium rounded-md border-border/70 bg-muted/50 hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer shadow-none',
            actionBtnClass
          )}
        >
          <CurrentIcon className="size-3.5 text-muted-foreground" />
          <span>{currentConfig.label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-52 p-1 rounded-sm border-border shadow-xl bg-popover z-100"
      >
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-1">
          Work Item Type
        </div>
        <div className="space-y-0.5">
          {(Object.keys(ISSUE_TYPE_CONFIG) as TaskIssueType[]).map((key) => {
            const item = ISSUE_TYPE_CONFIG[key];
            const Icon = ISSUE_TYPE_ICONS[key] || CheckSquare;
            const isSelected = currentKey === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setIssueType(key);
                  onOpenChange(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xs text-xs font-medium transition-colors hover:bg-muted cursor-pointer text-left',
                  isSelected && 'bg-muted/80 text-foreground font-semibold'
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="size-5 rounded flex items-center justify-center"
                    style={{ backgroundColor: item.bgLight }}
                  >
                    <Icon className="size-3.5" style={{ color: item.color }} />
                  </div>
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
