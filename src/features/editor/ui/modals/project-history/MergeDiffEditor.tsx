'use client';

/**
 * MergeDiffEditor.tsx
 *
 * CodeMirror 6 MergeView wrapper for side-by-side editable or read-only file diffs.
 * Location: `features/editor/ui/modals/project-history/MergeDiffEditor.tsx`
 */

import React, { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';

export interface MergeDiffEditorProps {
  baseContent: string;
  targetContent: string;
  baseLabel: string;
  targetLabel: string;
}

export const MergeDiffEditor = React.memo(function MergeDiffEditor({
  baseContent,
  targetContent,
  baseLabel,
  targetLabel,
}: MergeDiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up any existing view
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
      mergeViewRef.current = null;
    }

    try {
      const readOnlyExt = [
        lineNumbers(),
        EditorView.editable.of(false),
        EditorState.readOnly.of(true),
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px', fontFamily: 'var(--font-mono, monospace)' },
          '.cm-scroller': { overflow: 'auto' },
        }),
      ];

      mergeViewRef.current = new MergeView({
        a: {
          doc: baseContent,
          extensions: readOnlyExt,
        },
        b: {
          doc: targetContent,
          extensions: readOnlyExt,
        },
        parent: containerRef.current,
        collapseUnchanged: { margin: 3 },
      });
    } catch (err) {
      console.error('[MergeDiffEditor] Failed to initialize CodeMirror MergeView:', err);
    }

    return () => {
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }
    };
  }, [baseContent, targetContent]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden border rounded-md bg-background">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b text-xs font-mono text-muted-foreground select-none">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="size-2 rounded-full bg-rose-500/70" />
          <span>Base: {baseLabel}</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <span className="size-2 rounded-full bg-emerald-500/70" />
          <span>Target: {targetLabel}</span>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 w-full overflow-hidden" />
    </div>
  );
});
