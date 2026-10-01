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
          : 'Switched to Source (Code) mode',
        { duration: 1500 },
      );
    },
    [editorMode, setEditorMode],
  );

  return (
    <div className="inline-flex items-center rounded-md bg-muted p-0.5 border border-border select-none shrink-0 shadow-2xs">
      <button
        type="button"
        onClick={() => handleSwitchMode('code')}
        className={cn(
          'px-2 py-0.5 rounded-sm text-xs font-medium transition-all duration-150 cursor-pointer select-none leading-none',
          editorMode === 'code'
            ? 'bg-background text-foreground font-semibold shadow-2xs'
            : 'text-muted-foreground hover:text-foreground',
        )}
        title="Source (Ctrl+Shift+V)"
      >
        Source
      </button>
      <button
        type="button"
        onClick={() => handleSwitchMode('visual')}
        className={cn(
          'px-2 py-0.5 rounded-sm text-xs font-medium transition-all duration-150 cursor-pointer select-none leading-none',
          editorMode === 'visual'
            ? 'bg-background text-foreground font-semibold shadow-2xs'
            : 'text-muted-foreground hover:text-foreground',
        )}
        title="Visual (Ctrl+Shift+V)"
      >
        Visual
      </button>
    </div>
  );
});
