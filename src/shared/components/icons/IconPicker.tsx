'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Skeleton } from '@/shared/components/ui/skeleton';

const IconPickerBody = dynamic(() => import('./IconPickerBody'), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 p-1">
      <Skeleton className="h-8 w-full rounded-md" />
      <Skeleton className="h-8 w-full rounded-md" />
      <div className="grid grid-cols-8 gap-1 pt-1">
        {Array.from({ length: 32 }).map((_, i) => (
          <Skeleton key={i} className="size-7 rounded-md" />
        ))}
      </div>
    </div>
  ),
});

export interface IconPickerProps {
  currentValue?: string | null;
  onSelect: (value: string) => void;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'right' | 'bottom' | 'left';
  sideOffset?: number;
}

export function IconPicker({
  currentValue,
  onSelect,
  children,
  align = 'start',
  side = 'bottom',
  sideOffset = 6,
}: IconPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      {open && (
        <PopoverContent
          align={align}
          side={side}
          sideOffset={sideOffset}
          className="w-[336px] p-2 rounded-lg border border-border bg-popover text-foreground select-none z-50 duration-150"
        >
          <IconPickerBody
            currentValue={currentValue}
            onSelect={onSelect}
            open={open}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}

export default IconPicker;
