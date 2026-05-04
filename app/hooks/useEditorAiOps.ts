/**
 * useEditorAiOps.ts
 *
 * All Monaco editor operations driven by AI:
 *   - applyEdits        → permanent apply with undo checkpoints + green flash + auto-compile
 *   - previewEdits      → ghost blue preview using snapshot-based revert
 *   - confirmPreview    → lock in previewed edits
 *   - dismissPreview    → atomically revert to pre-preview snapshot
 *   - insertAtCursor    → smart insert (replaces existing LaTeX command if found)
 *   - triggerCompile    → debounced compile trigger after AI edits
 */

import { useCallback, useRef } from "react";
import {
  applyEditsToEditor,
  previewEditsInEditor,
  highlightLines,
  findLatexCommandRange,
  type AiEditOperation,
  type AiEditPreviewHandle,
} from "~/lib/ai-edit-engine";

interface UseEditorAiOpsOptions {
  editorRef: React.MutableRefObject<any | null>;
  isAiPreviewingRef: React.MutableRefObject<boolean>;
  compileRef: React.MutableRefObject<(() => void) | null>;
}

export function useEditorAiOps({
  editorRef,
  isAiPreviewingRef,
  compileRef,
}: UseEditorAiOpsOptions) {
  const previewHandleRef = useRef<AiEditPreviewHandle | null>(null);

  // ── applyEdits — permanent, with undo checkpoints ─────────────────────────
  const applyEdits = useCallback(
    (edits: AiEditOperation[]): boolean => {
      const editor = editorRef.current;
      if (!editor || !edits.length) return false;

      const affected = applyEditsToEditor(editor, edits);
      if (affected) {
        highlightLines(editor, affected.startLine, affected.endLine);
      }
      // Trigger auto-compile so PDF preview updates after AI edit
      setTimeout(() => compileRef.current?.(), 800);
      return true;
    },
    [editorRef, compileRef],
  );

  // ── previewEdits — ghost view, no undo stop ────────────────────────────────
  const previewEdits = useCallback(
    (edits: AiEditOperation[]) => {
      const editor = editorRef.current;
      if (!editor || !edits.length) return;

      // Clear any stale preview first
      if (previewHandleRef.current) {
        previewHandleRef.current.clearDecorations();
        previewHandleRef.current = null;
      }

      previewHandleRef.current = previewEditsInEditor(editor, edits, isAiPreviewingRef);
    },
    [editorRef, isAiPreviewingRef],
  );

  // ── confirmPreview — edits already in model, just clear decorations ────────
  const confirmPreview = useCallback(() => {
    const editor = editorRef.current;
    const handle = previewHandleRef.current;

    if (handle) {
      handle.clearDecorations();
      if (handle.affected) {
        // Push a clean undo stop so Ctrl+Z reverts just the AI edit block
        editor?.pushUndoStop();
        highlightLines(editor, handle.affected.startLine, handle.affected.endLine);
      }
      previewHandleRef.current = null;
    }

    // Trigger auto-compile
    setTimeout(() => compileRef.current?.(), 800);
  }, [editorRef, compileRef]);

  // ── dismissPreview — atomically restore snapshot ───────────────────────────
  const dismissPreview = useCallback(() => {
    const editor = editorRef.current;
    const handle = previewHandleRef.current;

    if (handle && editor) {
      handle.clearDecorations();
      const model = editor.getModel();
      if (model && handle.snapshot) {
        // Atomic revert: restore saved content snapshot
        isAiPreviewingRef.current = true;
        // Use pushEditOperations so the revert IS undoable (one Ctrl+Z step)
        const totalLines = model.getLineCount();
        const lastLineMaxCol = model.getLineMaxColumn(totalLines);
        editor.executeEdits("ai-preview-revert", [
          {
            range: {
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: totalLines,
              endColumn: lastLineMaxCol,
            },
            text: handle.snapshot,
            forceMoveMarkers: true,
          },
        ]);
        if (handle.cursorSnapshot) {
          editor.setPosition(handle.cursorSnapshot);
        }
        setTimeout(() => { isAiPreviewingRef.current = false; }, 0);
      }
      previewHandleRef.current = null;
    }
  }, [editorRef, isAiPreviewingRef]);

  // ── clearPreviewDecorations — cleanup without reverting ───────────────────
  const clearPreviewDecorations = useCallback(() => {
    previewHandleRef.current?.clearDecorations();
    previewHandleRef.current = null;
  }, []);

  // ── insertAtCursor — smart insert (replaces existing command if found) ─────
  const insertAtCursor = useCallback(
    (latex: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      const content = model.getValue();
      const trimmed = latex.trim();

      // Detect single-command snippet like \title{...} → replace existing
      const cmdMatch = trimmed.match(/^\\([a-zA-Z]+)\s*\{/);
      if (cmdMatch) {
        const existingRange = findLatexCommandRange(content, cmdMatch[1]);
        if (existingRange) {
          editor.pushUndoStop();
          editor.executeEdits("ai-smart-replace", [
            {
              range: {
                startLineNumber: existingRange.startLineNumber,
                startColumn: existingRange.startColumn,
                endLineNumber: existingRange.endLineNumber,
                endColumn: existingRange.endColumn,
              },
              text: trimmed,
              forceMoveMarkers: true,
            },
          ]);
          editor.pushUndoStop();
          highlightLines(editor, existingRange.startLineNumber, existingRange.endLineNumber);
          editor.revealLineInCenter(existingRange.startLineNumber);
          editor.focus();
          return;
        }
      }

      // Fallback: insert at current cursor position
      const pos = editor.getPosition();
      const range = {
        startLineNumber: pos?.lineNumber ?? 1,
        startColumn: pos?.column ?? 1,
        endLineNumber: pos?.lineNumber ?? 1,
        endColumn: pos?.column ?? 1,
      };
      editor.pushUndoStop();
      editor.executeEdits("ai-insert", [{ range: range as any, text: trimmed, forceMoveMarkers: true }]);
      editor.pushUndoStop();
      editor.focus();
    },
    [editorRef],
  );

  // ── replaceSelection — replace currently selected text ────────────────────
  const replaceSelection = useCallback(
    (newText: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = editor.getSelection();
      if (!sel) { insertAtCursor(newText); return; }
      editor.pushUndoStop();
      editor.executeEdits("ai-replace-selection", [
        { range: sel, text: newText.trim(), forceMoveMarkers: true },
      ]);
      editor.pushUndoStop();
      editor.focus();
      setTimeout(() => compileRef.current?.(), 800);
    },
    [editorRef, insertAtCursor, compileRef],
  );

  return {
    applyEdits,
    previewEdits,
    confirmPreview,
    dismissPreview,
    clearPreviewDecorations,
    insertAtCursor,
    replaceSelection,
    previewHandleRef,
  };
}
