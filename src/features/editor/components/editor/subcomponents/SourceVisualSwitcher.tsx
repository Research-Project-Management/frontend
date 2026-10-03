'use client';

import React, { useCallback } from 'react';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore } from '@/features/editor/store';

export const SourceVisualSwitcher = React.memo(function SourceVisualSwitcher() {
  const editorMode = useSettingsStore((s) => s.editorMode);
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);

  const handleSwitchMode = useCallback(
    (mode: 'code' | 'visual') => {
      if (editorMode === mode) return;
      setEditorMode(mode);
    },
    [editorMode, setEditorMode],
  );

  return (
    <div
      role="radiogroup"
      aria-label="Editor display mode"
      className="inline-flex items-center rounded-md bg-muted/80 p-0.5 select-none shrink-0"
    >
      <button
        type="button"
        role="radio"
        aria-checked={editorMode === 'code'}
        aria-label="Code mode"
        onClick={() => handleSwitchMode('code')}
        className={cn(
          'px-2.5 py-1 rounded-sm text-12 transition-colors duration-150 cursor-pointer select-none leading-normal outline-none focus-visible:ring-1 focus-visible:ring-primary',
          editorMode === 'code'
            ? 'bg-background text-foreground font-semibold'
            : 'text-muted-foreground hover:text-foreground font-medium',
        )}
        title="Code mode (Ctrl+Shift+V)"
      >
        Code
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={editorMode === 'visual'}
        aria-label="Visual mode"
        onClick={() => handleSwitchMode('visual')}
        className={cn(
          'px-2.5 py-1 rounded-sm text-12 transition-colors duration-150 cursor-pointer select-none leading-normal outline-none focus-visible:ring-1 focus-visible:ring-primary',
          editorMode === 'visual'
            ? 'bg-background text-foreground font-semibold'
            : 'text-muted-foreground hover:text-foreground font-medium',
        )}
        title="Visual mode (Ctrl+Shift+V)"
      >
        Visual
      </button>
    </div>
  );
});
