'use client';

/**
 * SourceVisualSwitcher.tsx
 *
 * Source vs Visual Mode Toggle Button (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/SourceVisualSwitcher.tsx`
 *
 * Pixel-perfect segmented toggle modeled after Overleaf editor toolbar.
 */

import React from 'react';
import { useSettingsStore } from '../../../store/settings.store';
import { cn } from '@/shared/lib/utils';

export const SourceVisualSwitcher = React.memo(function SourceVisualSwitcher() {
  const editorMode = useSettingsStore((s) => s.editorMode);
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);

  return (
    <div
      role="radiogroup"
      aria-label="Editor view mode"
      className="inline-flex items-center p-1 gap-0.5 bg-muted/80 dark:bg-muted/40 border border-border/60 rounded-md select-none shrink-0"
    >
      <button
        type="button"
        role="radio"
        aria-checked={editorMode === 'code'}
        onClick={() => setEditorMode('code')}
        title="Source mode (LaTeX code) (Ctrl+Shift+V)"
        aria-label="Source mode"
        className={cn(
          'h-5 px-2.5 flex items-center justify-center text-xs font-medium rounded-[4px] transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
          editorMode === 'code'
            ? 'bg-background text-foreground shadow-2xs font-semibold'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Source
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={editorMode === 'visual'}
        onClick={() => setEditorMode('visual')}
        title="Visual mode (Ctrl+Shift+V)"
        aria-label="Visual mode"
        className={cn(
          'h-5 px-2.5 flex items-center justify-center text-xs font-medium rounded-[4px] transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
          editorMode === 'visual'
            ? 'bg-background text-foreground shadow-2xs font-semibold'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Visual
      </button>
    </div>
  );
});

export default SourceVisualSwitcher;
