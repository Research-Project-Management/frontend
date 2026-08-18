'use client';

import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
  Label,
  Button,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

interface DateRangeProps {
  startDate: string | null;
  endDate: string | null;
  onApply: (start: string | null, end: string | null) => void;
  onClear: () => void;
}

export function WorklogDateRange({
  startDate,
  endDate,
  onApply,
  onClear,
}: DateRangeProps) {
  const [open, setOpen] = useState(false);
  const [localStart, setLocalStart] = useState(startDate || '');
  const [localEnd, setLocalEnd] = useState(endDate || '');

  const hasFilter = Boolean(startDate || endDate);

  const handleSave = () => {
    onApply(localStart || null, localEnd || null);
    setOpen(false);
  };

  const handleReset = () => {
    setLocalStart('');
    setLocalEnd('');
    onClear();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'h-8 px-2.5 rounded-md border border-border/80 bg-background hover:bg-muted/40 text-xs font-medium text-foreground flex items-center gap-1.5 transition-colors cursor-pointer outline-none shrink-0',
            hasFilter && 'border-primary/50 text-primary bg-primary/5'
          )}
        >
          <span>{startDate || 'Start date'}</span>
          <ArrowRight className="size-3 text-muted-foreground shrink-0" />
          <span>{endDate || 'End date'}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-3 rounded-lg space-y-3">
        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-foreground">Start date</Label>
          <Input
            type="date"
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            className="h-8 text-xs border-border/80 focus:ring-0 focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-medium text-foreground">End date</Label>
          <Input
            type="date"
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            className="h-8 text-xs border-border/80 focus:ring-0 focus:outline-none"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          {hasFilter ? (
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1"
            >
              <X className="size-3" />
              <span>Clear</span>
            </button>
          ) : (
            <div />
          )}

          <Button
            size="sm"
            onClick={handleSave}
            className="h-7 text-xs px-3 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer rounded-md shadow-2xs"
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
