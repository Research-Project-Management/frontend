'use client';

/**
 * useEditorDiagnosticsListener.ts
 *
 * Dedicated custom hook encapsulating global editor command listeners:
 * - flux:autofix: Applies AST / regex-based LaTeX syntax fixes with toast notifications
 * - flux:lint-page: Runs static LaTeX linter checks with summary toast notifications
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are strictly managed within hooks; presentation components do not hold toast.
 */

import React, { useEffect } from 'react';
import type { EditorView } from '@codemirror/view';
import { toast } from 'sonner';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { runLatexLinter, type RetractedItemInfo } from '@/features/editor/utils/latex-linter.util';

export interface UseEditorDiagnosticsListenerOptions {
  viewRef: React.RefObject<EditorView | null>;
  retractedMapRef: React.RefObject<Map<string, RetractedItemInfo> | undefined>;
}

export function useEditorDiagnosticsListener({
  viewRef,
  retractedMapRef,
}: UseEditorDiagnosticsListenerOptions) {
  useEffect(() => {
    const unsubAutoFix = editorCommandBus.subscribe('editor:autofix', async () => {
      const view = viewRef.current;
      if (!view) return;
      const content = view.state.doc.toString();
      if (!content.trim()) return;

      try {
        toast.loading('Applying LaTeX syntax fixes...', { id: 'flux:autofix' });
        const res = await manuscriptService.diagnostics.autoFix(content);
        if (res && res.fixedSource && res.fixedSource !== content) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: res.fixedSource },
          });
          const count = res.appliedFixes?.length ?? 1;
          toast.success(`Applied ${count} LaTeX syntax fix(es)!`, { id: 'flux:autofix' });
        } else {
          toast.info('No common LaTeX syntax issues found to fix', { id: 'flux:autofix' });
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to auto-fix document', { id: 'flux:autofix' });
      }
    });

    const unsubLint = editorCommandBus.subscribe('editor:lint-project', async () => {
      const view = viewRef.current;
      if (!view) return;
      const content = view.state.doc.toString();
      if (!content.trim()) return;

      try {
        toast.loading('Checking page LaTeX syntax...', { id: 'flux:lint' });
        const diags = runLatexLinter(content, {
          retractedItemsMap: retractedMapRef.current,
        });
        const errs = diags.filter((d) => d.severity === 'error').length;
        const warns = diags.filter((d) => d.severity === 'warning').length;
        if (diags.length > 0) {
          toast.warning(`Page check found ${errs} error(s) and ${warns} warning(s)`, {
            id: 'flux:lint',
          });
        } else {
          toast.success('Page passed static LaTeX check with no issues!', { id: 'flux:lint' });
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to check page syntax', { id: 'flux:lint' });
      }
    });

    return () => {
      unsubAutoFix();
      unsubLint();
    };
  }, [viewRef, retractedMapRef]);
}
