'use client';

import React, { useState, useEffect } from 'react';
import { Clock, X } from 'lucide-react';
import {
  Button,
  Calendar,
  Checkbox,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui';
import type { TaskRecurrence, TaskReminder } from '../../../../types/task.types';

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
          className={
            open
              ? 'h-10 rounded-sm border border-border bg-muted px-4 text-[15px] font-medium text-foreground shadow-none'
              : actionBtnClass
          }
        >
          <Clock className="mr-2 h-4 w-4 text-foreground" />
          <span>Dates</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={-14}
        className="w-[304px] p-0 rounded-sm shadow-xl border-border/50 overflow-hidden flex flex-col z-100 bg-popover"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <span className="text-sm font-semibold text-center flex-1 text-foreground">Dates</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="p-3 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-center border-b border-border/50 pb-3">
            <Calendar
              mode="range"
              selected={selectedRange as any}
              onSelect={(range: any) => setSelectedRange(range || { from: undefined })}
              className="p-0"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={hasStartDate}
                onCheckedChange={(c) => setHasStartDate(!!c)}
                id="start-date-cb"
              />
              <label htmlFor="start-date-cb" className="text-xs font-semibold text-foreground flex-1">
                Start date
              </label>
              <Input
                readOnly
                value={selectedRange.from ? selectedRange.from.toLocaleDateString() : 'M/D/YYYY'}
                className="h-8 w-28 text-xs text-center"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={hasDueDate}
                onCheckedChange={(c) => setHasDueDate(!!c)}
                id="due-date-cb"
              />
              <label htmlFor="due-date-cb" className="text-xs font-semibold text-foreground flex-1">
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
                className="h-8 w-28 text-xs text-center"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border/50">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                Set due date reminder
              </label>
              <Select
                value={reminderOption || 'none'}
                onValueChange={(val) => setReminderOption(val as TaskReminder)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Reminder" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="at-time">At time of due date</SelectItem>
                  <SelectItem value="5m">5 Minutes before</SelectItem>
                  <SelectItem value="10m">10 Minutes before</SelectItem>
                  <SelectItem value="15m">15 Minutes before</SelectItem>
                  <SelectItem value="1h">1 Hour before</SelectItem>
                  <SelectItem value="2h">2 Hours before</SelectItem>
                  <SelectItem value="1day">1 Day before</SelectItem>
                  <SelectItem value="2day">2 Days before</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">
                Repeat
              </label>
              <Select
                value={recurrenceOption || 'none'}
                onValueChange={(val) => setRecurrenceOption(val as TaskRecurrence)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Repeat" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="none">Never</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="mon-fri">Every weekday (Mon - Fri)</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly-day">Monthly (on same day)</SelectItem>
                  <SelectItem value="monthly-week">Monthly (on same weekday)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
            <Button size="sm" onClick={handleSave} className="w-full">
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleRemove} className="w-full">
              Remove
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DatePopover;
