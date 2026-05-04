/**
 * useEditorSelection.ts
 *
 * Tracks live Monaco selection, pinned context, and file content snapshot.
 * Extracted from ChatAiTab so it can be composed cleanly.
 */

import { useState, useEffect, useCallback } from "react";
import { parseLatexStructure } from "~/lib/latex-utils";

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

interface UseEditorSelectionOptions {
  editorRef: React.MutableRefObject<any | null>;
  filename: string;
}

export function useEditorSelection({ editorRef, filename }: UseEditorSelectionOptions) {
  const [liveSelection, setLiveSelection] = useState<LiveSelection | null>(null);
  const [pinnedContext, setPinnedContext] = useState<PinnedContext | null>(null);
  const [currentFileContent, setCurrentFileContent] = useState("");

  // ── Track file content changes ─────────────────────────────────────────────
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

  // ── Track cursor / selection changes in real time ──────────────────────────
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const update = () => {
      const model = editor.getModel();
      const sel = editor.getSelection();
      if (!model || !sel) { setLiveSelection(null); return; }

      const hasSelection =
        sel.startLineNumber !== sel.endLineNumber ||
        sel.startColumn !== sel.endColumn;
      if (!hasSelection) { setLiveSelection(null); return; }

      const text = model.getValueInRange(sel);
      if (!text.trim()) { setLiveSelection(null); return; }

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

  // ── Pin current selection ──────────────────────────────────────────────────
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

  // ── Resolve effective context for AI prompt ────────────────────────────────
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
