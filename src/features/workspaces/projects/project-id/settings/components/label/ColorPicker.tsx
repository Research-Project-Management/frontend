'use client';

import React, { useState, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';

export const PRESET_COLORS = [
  '#FF6900', // Orange
  '#FCB900', // Yellow
  '#7BDCB5', // Mint / Light teal
  '#00D084', // Green
  '#8ED1FC', // Sky Blue
  '#0693E3', // Blue
  '#ABB8C3', // Grey
  '#EB144C', // Crimson red
  '#F78DA7', // Pink
  '#9900EF', // Purple
];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(color.replace('#', '').toUpperCase());

  useEffect(() => {
    setHex(color.replace('#', '').toUpperCase());
  }, [color]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    setHex(val);
    if (val.length === 6) {
      onChange(`#${val}`);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Pick color"
          className="size-4.5 rounded-full shrink-0 transition-transform hover:scale-110 cursor-pointer outline-none shadow-2xs ring-offset-1 ring-offset-background"
          style={{ backgroundColor: color }}
        />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={10}
        className="w-auto p-3 bg-popover border border-border shadow-xl rounded-lg z-50 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Color Palette Grid */}
        <div className="grid grid-cols-6 gap-2 mb-3">
          {/* Row 1 (6 colors) */}
          {PRESET_COLORS.slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setHex(c.replace('#', '').toUpperCase());
              }}
              className={cn(
                'size-6 rounded-md transition-all cursor-pointer hover:scale-105 active:scale-95 ring-offset-1 ring-offset-background',
                color.toLowerCase() === c.toLowerCase() && 'ring-2 ring-foreground/60 scale-105',
              )}
              style={{ backgroundColor: c }}
            />
          ))}

          {/* Row 2 (4 colors + # trigger) */}
          {PRESET_COLORS.slice(6).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onChange(c);
                setHex(c.replace('#', '').toUpperCase());
              }}
              className={cn(
                'size-6 rounded-md transition-all cursor-pointer hover:scale-105 active:scale-95 ring-offset-1 ring-offset-background',
                color.toLowerCase() === c.toLowerCase() && 'ring-2 ring-foreground/60 scale-105',
              )}
              style={{ backgroundColor: c }}
            />
          ))}

          {/* Custom '#' box */}
          <div className="size-6 rounded-md bg-muted/60 border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground select-none">
            #
          </div>
        </div>

        {/* Hex Code Input Box */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background h-8 w-28">
          <input
            type="text"
            value={hex}
            maxLength={6}
            onChange={handleHexChange}
            placeholder="HEX"
            className="w-full text-xs font-mono font-medium text-foreground bg-transparent outline-none uppercase"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
