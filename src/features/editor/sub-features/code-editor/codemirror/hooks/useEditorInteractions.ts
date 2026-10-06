/**
 * useEditorInteractions.ts
 *
 * Dedicated Hook for Editor Events, Keybinding Actions & Inline Interactions:
 * - Math popover trigger & inline formula updates
 * - Floating Suggestion / Review card state & event subscriptions
 * - Jump-to-line command bus dispatch
 * - Vim Ex-commands registration (:w, :wq)
 * - Reverse SyncTeX double-click coordinate mapping
 */

import { useState, useEffect, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
import { Vim } from '@replit/codemirror-vim';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { setMathEditCallback, type MathPopoverTrigger } from '../latex-visual-plugin';
import type { InlineSuggestionWidgetData } from '@/features/editor/components/editor/subcomponents/InlineSuggestionWidget';
import type { PageSuggestion } from '@/features/editor/types';
import { useSettingsStore } from '@/features/editor/store';

export interface UseEditorInteractionsParams {
  viewRef: React.RefObject<EditorView | null>;
  suggestions?: PageSuggestion[];
  onSyncTexReverse?: (line: number, col: number) => void;
}

export function useEditorInteractions({
  viewRef,
  suggestions,
  onSyncTexReverse,
}: UseEditorInteractionsParams) {
  const [mathTrigger, setMathTrigger] = useState<MathPopoverTrigger | null>(null);
  const [activeSuggestionWidget, setActiveSuggestionWidget] = useState<InlineSuggestionWidgetData | null>(null);

  // 1. Listen for in-place math widget clicks (respect showEquationPreview)
  useEffect(() => {
    setMathEditCallback((trigger) => {
      if (useSettingsStore.getState().showEquationPreview) {
        setMathTrigger(trigger);
      }
    });
    return () => {
      setMathEditCallback(null);
    };
  }, []);

  // 2. Register Vim Ex commands (:w, :write, :wq to compile & save)
  useEffect(() => {
    try {
      Vim.defineEx('write', 'w', () => {
        editorCommandBus.dispatch({ type: 'compiler:trigger' });
      });
      Vim.defineEx('wq', 'wq', () => {
        editorCommandBus.dispatch({ type: 'compiler:trigger' });
      });
    } catch {
      // Ex commands already defined in shared namespace
    }
  }, []);

  // 3. Track Changes Floating Widget State & Listener
  useEffect(() => {
    const unsub = EditorEventBus.on('flux:open-suggestion-widget', (detail: any) => {
      if (detail && detail.suggestionId) {
        const found = (suggestions || []).find((s) => s.id === detail.suggestionId);
        if (found) {
          setActiveSuggestionWidget({
            suggestion: found,
            x: detail.x ?? 120,
            y: detail.y ?? 120,
          });
        }
      }
    });
    return () => unsub();
  }, [suggestions]);

  // 4. Jump to Line Command Listener (from ReviewTab comments & suggestions)
  useEffect(() => {
    const unsub = editorCommandBus.subscribe('editor:jump-to-line', (cmd) => {
      const view = viewRef.current;
      if (!view) return;
      const lineNum = Math.max(1, Math.min(cmd.line, view.state.doc.lines));
      const line = view.state.doc.line(lineNum);
      view.dispatch({
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
      view.focus();
    });
    return () => unsub();
  }, [viewRef]);

  // 5. In-place Math Popover Save
  const handleApplyMath = useCallback(
    (newFormula: string, from: number, to: number, isDisplay: boolean) => {
      const view = viewRef.current;
      if (!view) return;

      const replacement = isDisplay ? `$$\n${newFormula}\n$$` : `$${newFormula}$`;
      view.dispatch({
        changes: { from, to, insert: replacement },
      });
      view.focus();
    },
    [viewRef]
  );

  // 6. Reverse SyncTeX on Double Click
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const view = viewRef.current;
      if (!view) return;

      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos !== null) {
        const line = view.state.doc.lineAt(pos);
        const col = pos - line.from + 1;

        if (onSyncTexReverse) {
          onSyncTexReverse(line.number, col);
        }
        editorCommandBus.dispatch({ type: 'viewer:jump-to-line', line: line.number });
      }
    },
    [viewRef, onSyncTexReverse]
  );

  return {
    mathTrigger,
    setMathTrigger,
    activeSuggestionWidget,
    setActiveSuggestionWidget,
    handleApplyMath,
    handleDoubleClick,
  };
}
