'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CalendarDays, Clock, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Calendar } from '@/shared/components/ui/calendar';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/shared/lib/utils';
import { ItemHelpers } from '@/features/projects/project-id/work-items/utils/work-item.utils';

import {
  SingleDatePopover,
  DateCalendarIcon,
  type SingleDatePopoverProps,
} from '@/shared/components/ui/single-date-popover';
import type { DatePopoverProps } from '@/features/projects/project-id/work-items/types/picker.types';

export type { DatePopoverProps, SingleDatePopoverProps };
export { DateCalendarIcon, SingleDatePopover };

// ── Range Date Popover ────────────────────────────────────────────────────────

export function DatePopover({
  open,
  onOpenChange,
  startDate,
  dueDate,
  onApplyDates,
  actionBtnClass,
  label,
  children,
  isReadOnly = false,
}: DatePopoverProps) {
  const [selectedRange, setSelectedRange] = useState<DateRange>({
    from: startDate ? new Date(startDate) : undefined,
    to: dueDate ? new Date(dueDate) : undefined,
  });

  const [hasStartDate, setHasStartDate] = useState(Boolean(startDate));
  const [hasDueDate, setHasDueDate] = useState(Boolean(dueDate));

  useEffect(() => {
    if (open) {
      setSelectedRange({
        from: startDate ? new Date(startDate) : undefined,
        to: dueDate ? new Date(dueDate) : undefined,
      });
      setHasStartDate(Boolean(startDate));
      setHasDueDate(Boolean(dueDate));
    }
  }, [open, startDate, dueDate]);

  const setQuickDue = (daysFromNow: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysFromNow);
    setSelectedRange((prev) => ({
      from: prev.from || new Date(),
      to: target,
    }));
    setHasDueDate(true);
  };

  const handleSave = () => {
    let finalStart: string | null = null;
    let finalDue: string | null = null;

    if (hasStartDate && selectedRange.from) {
      const d = selectedRange.from;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      finalStart = `${year}-${month}-${day}`;
    }
    if (hasDueDate && (selectedRange.to || selectedRange.from)) {
      const targetDate = selectedRange.to || selectedRange.from;
      if (targetDate) {
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        finalDue = `${year}-${month}-${day}`;
      }
    }

    onApplyDates({
      startDate: finalStart,
      dueDate: finalDue,
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onApplyDates({
      startDate: null,
      dueDate: null,
    });
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isReadOnly}>
        {children ? (
          children
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-muted hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0 relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
              actionBtnClass,
              open && 'bg-muted border-border'
            )}
          >
            <DateCalendarIcon />
            <span>{label || 'Dates'}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        className="w-[520px] p-0 rounded-md border border-border overflow-hidden flex flex-col z-100 bg-popover shadow-overlay"
      >
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0 bg-popover">
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 shrink-0 text-foreground" />
            <span className="text-xs font-semibold text-foreground">Dates & Deadlines</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-foreground hover:bg-muted cursor-pointer rounded-md"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-3.5 shrink-0" />
          </Button>
        </div>

        <div className="flex divide-x divide-border min-h-0 bg-background">
          <div className="p-3 flex items-center justify-center shrink-0">
            <Calendar
              mode="range"
              selected={selectedRange}
              onSelect={(range: DateRange | undefined) => {
                setSelectedRange(range || { from: undefined });
                if (range?.from) setHasStartDate(true);
                if (range?.to) setHasDueDate(true);
              }}
              className="p-0 text-xs shrink-0"
            />
          </div>

          <div className="flex-1 p-3.5 space-y-3 flex flex-col justify-between overflow-y-auto max-h-[300px]">
            <div className="space-y-1.5">
              <span className="text-10 font-medium text-foreground tracking-normal">Quick Select</span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(0)}
                  className="h-7 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer rounded-md shadow-none"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(1)}
                  className="h-7 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer rounded-md shadow-none"
                >
                  Tomorrow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(7)}
                  className="h-7 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer rounded-md shadow-none"
                >
                  Next week
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(14)}
                  className="h-7 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer rounded-md shadow-none"
                >
                  In 2 weeks
                </Button>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hasStartDate}
                  onCheckedChange={(checked) => setHasStartDate(Boolean(checked))}
                  id="start-date-cb"
                />
                <label htmlFor="start-date-cb" className="text-xs font-medium text-foreground flex-1 cursor-pointer">
                  Start date
                </label>
                <Input
                  readOnly
                  aria-label="Start date"
                  value={selectedRange.from ? selectedRange.from.toLocaleDateString() : 'M/D/YYYY'}
                  className="h-7 w-24 text-11 text-center px-1 font-mono rounded-md border-border"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hasDueDate}
                  onCheckedChange={(checked) => setHasDueDate(Boolean(checked))}
                  id="due-date-cb"
                />
                <label htmlFor="due-date-cb" className="text-xs font-medium text-foreground flex-1 cursor-pointer">
                  Due date
                </label>
                <Input
                  readOnly
                  aria-label="Due date"
                  value={
                    selectedRange.to
                      ? selectedRange.to.toLocaleDateString()
                      : selectedRange.from
                      ? selectedRange.from.toLocaleDateString()
                      : 'M/D/YYYY'
                  }
                  className="h-7 w-24 text-11 text-center px-1 font-mono rounded-md border-border"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-3.5 py-2.5 border-t border-border shrink-0 flex items-center justify-between gap-2 bg-popover">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            className="h-7 text-xs text-foreground hover:bg-muted cursor-pointer px-2.5 rounded-md"
          >
            Clear
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-7 text-xs px-3 cursor-pointer rounded-md text-foreground hover:bg-muted shadow-none"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs font-semibold px-4 cursor-pointer rounded-md shadow-none bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const DatePicker = SingleDatePopover;
