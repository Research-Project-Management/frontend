'use client';

import React, { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Calendar } from '@/shared/components/ui/calendar';
import { cn } from '@/shared/lib/utils';
import { formatDate } from '@/shared/utils/format';

export interface SingleDatePopoverProps {
  label: string;
  date?: string;
  onSelectDate: (date: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionBtnClass?: string;
  variant?: 'outline' | 'ghost' | 'default';
  disabled?: boolean;
  isReadOnly?: boolean;
  children?: React.ReactNode;
}

export function DateCalendarIcon({ className }: { className?: string }) {
  return <CalendarDays className={cn('size-3.5 shrink-0 text-foreground', className)} />;
}

export function SingleDatePopover({
  label,
  date,
  onSelectDate,
  open,
  onOpenChange,
  actionBtnClass,
  variant = 'outline',
  disabled = false,
  isReadOnly = false,
  children,
}: SingleDatePopoverProps) {
  const selectedDate = useMemo(() => (date ? new Date(date) : undefined), [date]);

  const formattedLabel = useMemo(() => {
    if (!selectedDate || Number.isNaN(selectedDate.getTime())) {
      return label;
    }
    return formatDate(selectedDate);
  }, [selectedDate, label]);

  const isDisabled = disabled || isReadOnly;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild disabled={isDisabled}>
        {children ? (
          children
        ) : (
          <Button
            variant={variant}
            size="sm"
            className={cn(
              variant === 'ghost'
                ? 'h-7 px-2 text-xs font-normal rounded-md bg-transparent hover:bg-muted/50 text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0 border-0 whitespace-nowrap relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring'
                : 'h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground flex items-center gap-1.5 cursor-pointer transition-colors shadow-none shrink-0 whitespace-nowrap relative before:absolute before:-inset-1 md:before:hidden focus-visible:ring-1 focus-visible:ring-ring',
              actionBtnClass,
              open && (variant === 'ghost' ? 'bg-muted/60' : 'bg-muted border-border'),
              date && 'text-foreground font-medium'
            )}
          >
            <DateCalendarIcon />
            <span className={cn('truncate', date && 'font-mono tabular-nums')}>{formattedLabel}</span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-auto p-0 rounded-md border border-border flex flex-col z-100 bg-popover shadow-overlay"
      >
        <div className="p-2 bg-background">
          <Calendar
            className="shrink-0"
            mode="single"
            selected={selectedDate}
            onSelect={(selectedDay) => {
              if (selectedDay) {
                const year = selectedDay.getFullYear();
                const month = String(selectedDay.getMonth() + 1).padStart(2, '0');
                const day = String(selectedDay.getDate()).padStart(2, '0');
                onSelectDate(`${year}-${month}-${day}`);
              } else {
                onSelectDate('');
              }
              onOpenChange(false);
            }}
          />
        </div>
        {date && (
          <div className="px-2 py-1.5 border-t border-border flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-11 text-foreground hover:bg-muted cursor-pointer rounded-md"
              onClick={() => {
                onSelectDate('');
                onOpenChange(false);
              }}
            >
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
