'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ColorPicker } from './ColorPicker';
import { toast } from 'sonner';

interface FormProps {
  initialName?: string;
  initialColor?: string;
  submitText?: string;
  isLoading?: boolean;
  onSubmit: (name: string, color: string) => void;
  onCancel: () => void;
}

export function Form({
  initialName = '',
  initialColor = '#FF6900',
  submitText = 'Add',
  isLoading = false,
  onSubmit,
  onCancel,
}: FormProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Label title is required');
      return;
    }
    onSubmit(trimmed, color);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-2.5 shadow-2xs"
    >
      {/* Color picker dropdown trigger */}
      <div className="pl-1 shrink-0 flex items-center">
        <ColorPicker color={color} onChange={setColor} />
      </div>

      {/* Label title input (has its own border, no outline ring on focus) */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Label title"
        value={name}
        maxLength={60}
        disabled={isLoading}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        className="flex-1 h-8.5 rounded-md border border-border/80 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:outline-none focus:ring-0 disabled:opacity-60"
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="h-8.5 px-3 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted/70 transition-colors cursor-pointer disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!name.trim() || isLoading}
          className="h-8.5 px-3.5 rounded-md bg-[#0070f3] hover:bg-[#0060df] text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? `${submitText}...` : submitText}
        </button>
      </div>
    </form>
  );
}
