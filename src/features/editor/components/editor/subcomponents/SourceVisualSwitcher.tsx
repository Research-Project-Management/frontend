'use client';

import React, { useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { useSettingsStore } from '@/features/editor/store';

export const SourceVisualSwitcher = React.memo(function SourceVisualSwitcher() {
  const editorMode = useSettingsStore((s) => s.editorMode);
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);

  const handleSwitchMode = useCallback(
    (mode: 'code' | 'visual') => {
      if (editorMode === mode) return;
      setEditorMode(mode);
      toast.info(
        mode === 'visual'
          ? 'Switched to Visual (Rich Text) mode'
          : 'Switched to Code mode',
        { duration: 1500 },
      );
    },
    [editorMode, setEditorMode],
  );

  return (
    <div className="inline-flex items-center rounded-full bg-muted p-0.5 border border-border select-none shrink-0">
      <button
        type="button"
        onClick={() => handleSwitchMode('code')}
        className={cn(
          'px-2.5 py-1 rounded-full text-xs transition-colors duration-150 cursor-pointer select-none leading-none',
          editorMode === 'code'
            ? 'bg-background text-foreground shadow-2xs font-semibold'
            : 'text-muted-foreground hover:text-foreground font-medium',
        )}
        title="Code mode (Ctrl+Shift+V)"
      >
        Code
      </button>
      <button
        type="button"
        onClick={() => handleSwitchMode('visual')}
        className={cn(
          'px-2.5 py-1 rounded-full text-xs transition-colors duration-150 cursor-pointer select-none leading-none',
          editorMode === 'visual'
            ? 'bg-background text-foreground shadow-2xs font-semibold'
            : 'text-muted-foreground hover:text-foreground font-medium',
        )}
        title="Visual mode (Ctrl+Shift+V)"
      >
        Visual
      </button>
    </div>
  );
});
