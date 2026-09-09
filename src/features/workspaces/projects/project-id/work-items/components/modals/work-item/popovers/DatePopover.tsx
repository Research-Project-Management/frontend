'use client';

import React, { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Calendar } from '@/shared/components/ui/calendar';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/shared/components/ui/select';
import { cn } from '@/shared/lib/utils';
import type { TaskRecurrence, TaskReminder } from '../../../../types/work-item.types';

export interface DatePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate: string | null;
  dueDate: string | null;
  recurrence?: TaskRecurrence | null;
  reminder?: TaskReminder | null;
  onApplyDates: (data: {
    startDate: string | null;
    dueDate: string | null;
    recurrence?: TaskRecurrence | null;
    reminder?: TaskReminder | null;
  }) => void;
  actionBtnClass?: string;
}

export function DatePopover({
  open,
  onOpenChange,
  startDate,
  dueDate,
  recurrence,
  reminder,
  onApplyDates,
  actionBtnClass,
}: DatePopoverProps) {
  const [selectedRange, setSelectedRange] = useState<{
    from: Date | undefined;
    to?: Date | undefined;
  }>({
    from: startDate ? new Date(startDate) : undefined,
    to: dueDate ? new Date(dueDate) : undefined,
  });

  const [hasStartDate, setHasStartDate] = useState(!!startDate);
  const [hasDueDate, setHasDueDate] = useState(!!dueDate);
  const [reminderOption, setReminderOption] = useState<TaskReminder>(reminder || 'none');
  const [recurrenceOption, setRecurrenceOption] = useState<TaskRecurrence>(recurrence || 'none');

  useEffect(() => {
    if (open) {
      setSelectedRange({
        from: startDate ? new Date(startDate) : undefined,
        to: dueDate ? new Date(dueDate) : undefined,
      });
      setHasStartDate(!!startDate);
      setHasDueDate(!!dueDate);
      setReminderOption(reminder || 'none');
      setRecurrenceOption(recurrence || 'none');
    }
  }, [open, startDate, dueDate, recurrence, reminder]);

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
      finalStart = selectedRange.from.toISOString();
    }
    if (hasDueDate && (selectedRange.to || selectedRange.from)) {
      const d = selectedRange.to || selectedRange.from;
      finalDue = d ? d.toISOString() : null;
    }

    onApplyDates({
      startDate: finalStart,
      dueDate: finalDue,
      reminder: reminderOption === 'none' ? null : reminderOption,
      recurrence: recurrenceOption === 'none' ? null : recurrenceOption,
    });
    onOpenChange(false);
  };

  const handleRemove = () => {
    onApplyDates({
      startDate: null,
      dueDate: null,
      reminder: null,
      recurrence: null,
    });
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-7 px-2.5 text-xs font-medium rounded-md border border-border/70 bg-muted hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0',
            actionBtnClass,
            open && 'bg-muted border-border'
          )}
        >
          <Clock className="size-3.5 text-muted-foreground" />
          <span>Dates</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        collisionPadding={16}
        className="w-[520px] p-0 rounded-xl shadow-2xl border-border/80 overflow-hidden flex flex-col z-100 bg-popover"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/70 shrink-0 bg-popover">
          <div className="flex items-center gap-2">
            <Clock className="size-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground">Dates & Deadlines</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-foreground hover:bg-muted cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>

        {/* 2-Column Body (Compact Height) */}
        <div className="flex divide-x divide-border/60 min-h-0 bg-background/50">
          {/* Left Column: Calendar */}
          <div className="p-3 flex items-center justify-center shrink-0">
            <Calendar
              mode="range"
              selected={selectedRange as any}
              onSelect={(range: any) => {
                setSelectedRange(range || { from: undefined });
                if (range?.from) setHasStartDate(true);
                if (range?.to) setHasDueDate(true);
              }}
              className="p-0 text-xs"
            />
          </div>

          {/* Right Column: Quick Presets + Details */}
          <div className="flex-1 p-3.5 space-y-3 flex flex-col justify-between overflow-y-auto max-h-[300px]">
            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-10 font-bold text-muted-foreground tracking-normal">Quick Select</span>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(0)}
                  className="h-6.5 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(1)}
                  className="h-6.5 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer"
                >
                  Tomorrow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(7)}
                  className="h-6.5 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer"
                >
                  Next week
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickDue(14)}
                  className="h-6.5 text-11 font-medium justify-start px-2 bg-muted hover:bg-muted cursor-pointer"
                >
                  In 2 weeks
                </Button>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hasStartDate}
                  onCheckedChange={(c) => setHasStartDate(!!c)}
                  id="start-date-cb"
                />
                <label htmlFor="start-date-cb" className="text-xs font-medium text-foreground flex-1 cursor-pointer">
                  Start date
                </label>
                <Input
                  readOnly
                  value={selectedRange.from ? selectedRange.from.toLocaleDateString() : 'M/D/YYYY'}
                  className="h-6.5 w-24 text-11 text-center px-1 font-mono"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  checked={hasDueDate}
                  onCheckedChange={(c) => setHasDueDate(!!c)}
                  id="due-date-cb"
                />
                <label htmlFor="due-date-cb" className="text-xs font-medium text-foreground flex-1 cursor-pointer">
                  Due date
                </label>
                <Input
                  readOnly
                  value={
                    selectedRange.to
                      ? selectedRange.to.toLocaleDateString()
                      : selectedRange.from
                      ? selectedRange.from.toLocaleDateString()
                      : 'M/D/YYYY'
                  }
                  className="h-6.5 w-24 text-11 text-center px-1 font-mono"
                />
              </div>
            </div>

            {/* Reminders & Recurrence */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <label className="text-10 font-bold text-muted-foreground">
                  Reminder
                </label>
                <Select
                  value={reminderOption || 'none'}
                  onValueChange={(val) => setReminderOption(val as TaskReminder)}
                >
                  <SelectTrigger className="h-6.5 text-11 px-2">
                    <SelectValue placeholder="Reminder" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="at-time">At time of due</SelectItem>
                    <SelectItem value="15m">15m before</SelectItem>
                    <SelectItem value="1h">1h before</SelectItem>
                    <SelectItem value="1day">1d before</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-10 font-bold text-muted-foreground">
                  Repeat
                </label>
                <Select
                  value={recurrenceOption || 'none'}
                  onValueChange={(val) => setRecurrenceOption(val as TaskRecurrence)}
                >
                  <SelectTrigger className="h-6.5 text-11 px-2">
                    <SelectValue placeholder="Repeat" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="none">Never</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="mon-fri">Mon - Fri</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly-day">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3.5 py-2.5 border-t border-border/70 shrink-0 flex items-center justify-between gap-2 bg-popover">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            className="h-7 text-xs text-muted-foreground hover:text-destructive cursor-pointer px-2.5"
          >
            Clear
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-7 text-xs px-3 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-7 text-xs font-semibold px-4 cursor-pointer"
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DatePopover;
