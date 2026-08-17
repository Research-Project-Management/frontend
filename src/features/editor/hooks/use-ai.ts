'use client';

/**
 * use-ai.ts (editor feature)
 *
 * Unified AI Assistant Hooks:
 * 1. useEditorSelection: Live Monaco selection tracking, LaTeX structure pinning & context resolution.
 * 2. useEditorAiOps: Monaco editing operations (apply with undo checkpoints, ghost preview, smart insert, auto-compile).
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { parseLatexStructure } from "@/features/editor/utils/editor.util";
import {
  applyEditsToEditor,
  previewEditsInEditor,
  highlightLines,
  findLatexCommandRange,
  type AiEditOperation,
  type AiEditPreviewHandle,
} from "@/features/editor/utils/ai.util";

// ── 1. Selection & Context Tracking ──────────────────────────────────────────

export interface LiveSelection {
  text: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
  charCount: number;
  wordCount: number;
  section: string | null;
  environment: string | null;
}

export interface PinnedContext {
  label: string;
  text: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface UseEditorSelectionOptions {
  editorRef: React.MutableRefObject<any | null>;
  filename: string;
}

export function useEditorSelection({ editorRef, filename }: UseEditorSelectionOptions) {
  const [liveSelection, setLiveSelection] = useState<LiveSelection | null>(null);
  const [pinnedContext, setPinnedContext] = useState<PinnedContext | null>(null);
  const [currentFileContent, setCurrentFileContent] = useState("");

  // Track file content changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    setCurrentFileContent(model.getValue());
    const disposable = model.onDidChangeContent(() => {
      setCurrentFileContent(model.getValue());
    });
    return () => disposable.dispose();
  }, [editorRef]);

  // Track cursor / selection changes in real time
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const update = () => {
      const model = editor.getModel();
      const sel = editor.getSelection();
      if (!model || !sel) {
        setLiveSelection(null);
        return;
      }

      const hasSelection =
        sel.startLineNumber !== sel.endLineNumber ||
        sel.startColumn !== sel.endColumn;
      if (!hasSelection) {
        setLiveSelection(null);
        return;
      }

      const text = model.getValueInRange(sel);
      if (!text.trim()) {
        setLiveSelection(null);
        return;
      }

      const fullContent = model.getValue();
      const struct = parseLatexStructure(fullContent);

      let section: string | null = null;
      for (const s of struct.sections) {
        if (s.startLine <= sel.startLineNumber) section = s.title;
        else break;
      }

      let environment: string | null = null;
      for (const env of struct.environments) {
        if (env.startLine <= sel.startLineNumber && env.endLine >= sel.startLineNumber) {
          environment = env.type;
        }
      }

      setLiveSelection({
        text,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber,
        startColumn: sel.startColumn,
        endColumn: sel.endColumn,
        charCount: text.length,
        wordCount: text.split(/\s+/).filter(Boolean).length,
        section,
        environment,
      });
    };

    const disposable = editor.onDidChangeCursorSelection(update);
    update();
    return () => disposable.dispose();
  }, [editorRef]);

  // Pin current selection
  const pinCurrentSelection = useCallback(() => {
    if (!liveSelection) return;
    const range =
      liveSelection.startLine === liveSelection.endLine
        ? `L${liveSelection.startLine}`
        : `L${liveSelection.startLine}–${liveSelection.endLine}`;
    setPinnedContext({
      label: `${filename} ${range}`,
      text: liveSelection.text,
      startLine: liveSelection.startLine,
      endLine: liveSelection.endLine,
      startColumn: liveSelection.startColumn,
      endColumn: liveSelection.endColumn,
    });
  }, [liveSelection, filename]);

  const unpinContext = useCallback(() => setPinnedContext(null), []);

  // Resolve effective context for AI prompt
  const getEffectiveContext = useCallback((): {
    text: string;
    startLine: number | undefined;
    endLine: number | undefined;
    startColumn: number | undefined;
    endColumn: number | undefined;
  } => {
    const src = pinnedContext ?? liveSelection;
    return {
      text: src?.text ?? "",
      startLine: src?.startLine,
      endLine: src?.endLine,
      startColumn: src?.startColumn,
      endColumn: src?.endColumn,
    };
  }, [pinnedContext, liveSelection]);

  return {
    liveSelection,
    pinnedContext,
    currentFileContent,
    pinCurrentSelection,
    unpinContext,
    getEffectiveContext,
  };
}

// ── 2. Monaco AI Operations ──────────────────────────────────────────────────

export interface UseEditorAiOpsOptions {
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

  // applyEdits — permanent, with undo checkpoints
  const applyEdits = useCallback(
    (edits: AiEditOperation[]): boolean => {
      const editor = editorRef.current;
      if (!editor || !edits.length) return false;

      const affected = applyEditsToEditor(editor, edits);
      if (affected) {
        highlightLines(editor, affected.startLine, affected.endLine);
      }
      setTimeout(() => compileRef.current?.(), 800);
      return true;
    },
    [editorRef, compileRef],
  );

  // previewEdits — ghost view, no undo stop
  const previewEdits = useCallback(
    (edits: AiEditOperation[]) => {
      const editor = editorRef.current;
      if (!editor || !edits.length) return;

      if (previewHandleRef.current) {
        previewHandleRef.current.clearDecorations();
        previewHandleRef.current = null;
      }

      previewHandleRef.current = previewEditsInEditor(editor, edits, isAiPreviewingRef);
    },
    [editorRef, isAiPreviewingRef],
  );

  // confirmPreview — edits already in model, just clear decorations
  const confirmPreview = useCallback(() => {
    const editor = editorRef.current;
    const handle = previewHandleRef.current;

    if (handle) {
      handle.clearDecorations();
      if (handle.affected) {
        editor?.pushUndoStop();
        highlightLines(editor, handle.affected.startLine, handle.affected.endLine);
      }
      previewHandleRef.current = null;
    }

    setTimeout(() => compileRef.current?.(), 800);
  }, [editorRef, compileRef]);

  // dismissPreview — atomically restore snapshot
  const dismissPreview = useCallback(() => {
    const editor = editorRef.current;
    const handle = previewHandleRef.current;

    if (handle && editor) {
      handle.clearDecorations();
      const model = editor.getModel();
      if (model && handle.snapshot) {
        isAiPreviewingRef.current = true;
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
        setTimeout(() => {
          isAiPreviewingRef.current = false;
        }, 0);
      }
      previewHandleRef.current = null;
    }
  }, [editorRef, isAiPreviewingRef]);

  // clearPreviewDecorations — cleanup without reverting
  const clearPreviewDecorations = useCallback(() => {
    previewHandleRef.current?.clearDecorations();
    previewHandleRef.current = null;
  }, []);

  // insertAtCursor — smart insert (replaces existing command if found)
  const insertAtCursor = useCallback(
    (latex: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const model = editor.getModel();
      if (!model) return;

      const content = model.getValue();
      const trimmed = latex.trim();

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

  // replaceSelection — replace currently selected text
  const replaceSelection = useCallback(
    (newText: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      const sel = editor.getSelection();
      if (!sel) {
        insertAtCursor(newText);
        return;
      }
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
