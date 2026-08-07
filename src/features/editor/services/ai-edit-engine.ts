/**
 * ai-edit-engine.ts
 *
 * Single source of truth for all AI→Monaco edit operations.
 * Merges what was previously split across ai-edit-types.ts and ai-edit-helpers.ts.
 *
 * Public surface:
 *   Types      → AiEditOperation, AiEditResponse, AiEditIntent, AiEditValidationResult
 *   Validation → validateEdits(), isEditSafe()
 *   Monaco ops → applyEditsToEditor(), previewEditsInEditor(), highlightLines()
 *   LaTeX helpers → findLatexCommandRange(), replaceLatexCommandValue(), tryLocalCommandEdit()
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AiEditIntent =
  | "replace_range"
  | "insert_at_cursor"
  | "replace_selection"
  | "append_to_file"
  | "no_change";

export interface AiEditOperation {
  type: "replace" | "insert" | "delete";
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  text: string;
}

export interface AiEditResponse {
  intent: AiEditIntent;
  explanation: string;
  edits: AiEditOperation[];
  previewText?: string;
}

export interface AiEditValidationResult {
  valid: boolean;
  errors: string[];
  replacementRatio: number;
}

/** Returned by previewEditsInEditor — caller uses this to confirm or revert. */
export interface AiEditPreviewHandle {
  /** Content snapshot taken BEFORE applying preview — used for atomic revert. */
  snapshot: string;
  /** Cursor position snapshot for revert. */
  cursorSnapshot: { lineNumber: number; column: number } | null;
  /** Remove blue preview decorations. */
  clearDecorations: () => void;
  /** Affected line range (for green-flash highlight on Apply). */
  affected: { startLine: number; endLine: number } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export function validateEdits(
  edits: AiEditOperation[],
  totalLines: number,
  fileContent: string,
): AiEditValidationResult {
  const errors: string[] = [];
  const lines = fileContent.split("\n");
  let totalReplacedChars = 0;
  const totalChars = fileContent.length || 1;

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const idx = i + 1;

    if (edit.startLineNumber < 1 || edit.startLineNumber > totalLines)
      errors.push(`Edit ${idx}: startLine ${edit.startLineNumber} out of range (1–${totalLines})`);
    if (edit.endLineNumber < 1 || edit.endLineNumber > totalLines)
      errors.push(`Edit ${idx}: endLine ${edit.endLineNumber} out of range (1–${totalLines})`);
    if (edit.startColumn < 1) errors.push(`Edit ${idx}: startColumn must be ≥ 1`);
    if (edit.endColumn < 1) errors.push(`Edit ${idx}: endColumn must be ≥ 1`);
    if (edit.startLineNumber > edit.endLineNumber)
      errors.push(`Edit ${idx}: startLine > endLine`);

    if (edit.type === "replace" || edit.type === "delete") {
      const sl = Math.max(0, edit.startLineNumber - 1);
      const el = Math.min(lines.length - 1, edit.endLineNumber - 1);
      for (let l = sl; l <= el; l++) {
        const len = (lines[l] || "").length;
        if (l === sl && l === el) totalReplacedChars += Math.max(0, edit.endColumn - edit.startColumn);
        else if (l === sl) totalReplacedChars += Math.max(0, len - edit.startColumn + 1);
        else if (l === el) totalReplacedChars += edit.endColumn;
        else totalReplacedChars += len;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    replacementRatio: totalReplacedChars / totalChars,
  };
}

export function isEditSafe(
  result: AiEditValidationResult,
  intent: AiEditIntent,
  threshold = 0.6,
): boolean {
  if (intent === "append_to_file" || intent === "no_change") return true;
  if (!result.valid) return false;
  return result.replacementRatio <= threshold;
}

// ─────────────────────────────────────────────────────────────────────────────
// Monaco — build edits list (no monaco.Range needed)
// ─────────────────────────────────────────────────────────────────────────────

function buildMonacoEdits(edits: AiEditOperation[], model: any) {
  const totalLines = model.getLineCount();
  return edits.map((edit) => {
    const sl = Math.max(1, Math.min(edit.startLineNumber, totalLines));
    const el = Math.max(1, Math.min(edit.endLineNumber, totalLines));
    const sc = Math.max(1, edit.startColumn);
    const lineMaxCol = model.getLineMaxColumn(el);
    const ec =
      edit.type === "insert"
        ? sc
        : Math.min(Math.max(1, edit.endColumn), lineMaxCol + 1);
    return {
      range: { startLineNumber: sl, startColumn: sc, endLineNumber: el, endColumn: ec },
      text: edit.type === "delete" ? "" : (edit.text ?? ""),
      forceMoveMarkers: true,
    };
  });
}

function calcAffected(edits: AiEditOperation[]): { startLine: number; endLine: number } | null {
  if (!edits.length) return null;
  const starts = edits.map((e) => e.startLineNumber);
  const ends = edits.map((e) => {
    const addedLines = (e.text || "").split("\n").length - 1;
    return e.startLineNumber + addedLines;
  });
  return { startLine: Math.min(...starts), endLine: Math.max(...ends) };
}

// ─────────────────────────────────────────────────────────────────────────────
// applyEditsToEditor — permanent apply with undo checkpoints
// ─────────────────────────────────────────────────────────────────────────────

export function applyEditsToEditor(
  editor: any,
  edits: AiEditOperation[],
): { startLine: number; endLine: number } | null {
  const model = editor.getModel();
  if (!model) return null;

  const monacoEdits = buildMonacoEdits(edits, model);

  editor.pushUndoStop();
  editor.executeEdits("ai-assistant", monacoEdits);
  editor.pushUndoStop();

  const first = monacoEdits[0];
  if (first) {
    editor.revealLineInCenter(first.range.startLineNumber);
    const insertedLines = (first.text || "").split("\n");
    const newEndLine = first.range.startLineNumber + insertedLines.length - 1;
    const newEndCol =
      insertedLines.length === 1
        ? first.range.startColumn + insertedLines[0].length
        : insertedLines[insertedLines.length - 1].length + 1;
    editor.setPosition({ lineNumber: newEndLine, column: newEndCol });
  }
  editor.focus();

  return calcAffected(edits);
}

// ─────────────────────────────────────────────────────────────────────────────
// previewEditsInEditor — ghost preview (snapshot-based revert)
// ─────────────────────────────────────────────────────────────────────────────

const PREVIEW_CLASS = "ai-edit-preview-line";

export function previewEditsInEditor(
  editor: any,
  edits: AiEditOperation[],
  isAiPreviewingRef: React.MutableRefObject<boolean>,
): AiEditPreviewHandle {
  const model = editor.getModel();
  if (!model) {
    return {
      snapshot: "",
      cursorSnapshot: null,
      clearDecorations: () => {},
      affected: null,
    };
  }

  // Save clean snapshot before touching the model
  const snapshot = model.getValue();
  const cursorSnapshot = editor.getPosition() ?? null;

  const monacoEdits = buildMonacoEdits(edits, model);

  // Guard auto-save / auto-compile from seeing the preview
  isAiPreviewingRef.current = true;
  editor.executeEdits("ai-preview", monacoEdits);
  setTimeout(() => { isAiPreviewingRef.current = false; }, 0);

  const affected = calcAffected(edits);

  // Blue ghost decorations
  const decorationRanges: any[] = [];
  if (affected) {
    const lineCount = model.getLineCount();
    for (let ln = affected.startLine; ln <= Math.min(affected.endLine, lineCount); ln++) {
      decorationRanges.push({
        range: { startLineNumber: ln, startColumn: 1, endLineNumber: ln, endColumn: 1 },
        options: { isWholeLine: true, className: PREVIEW_CLASS },
      });
    }
  }
  const collection = editor.createDecorationsCollection(decorationRanges);
  if (affected) editor.revealLineInCenter(affected.startLine);

  return {
    snapshot,
    cursorSnapshot,
    clearDecorations: () => { try { collection.clear(); } catch { /* disposed */ } },
    affected,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// highlightLines — green flash after apply
// ─────────────────────────────────────────────────────────────────────────────

const HIGHLIGHT_CLASS = "ai-edit-highlight-line";

export function highlightLines(
  editor: any,
  startLine: number,
  endLine: number,
  durationMs = 1500,
): void {
  const coll = editor.createDecorationsCollection([
    {
      range: { startLineNumber: startLine, startColumn: 1, endLineNumber: endLine, endColumn: 1 },
      options: { isWholeLine: true, className: HIGHLIGHT_CLASS },
    },
  ]);
  setTimeout(() => { try { coll.clear(); } catch { /* disposed */ } }, durationMs);
}

// ─────────────────────────────────────────────────────────────────────────────
// LaTeX Command Helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface LatexCommandRange {
  fullText: string;
  innerText: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  lineNumber: number;
}

export function findLatexCommandRange(
  content: string,
  commandName: string,
): LatexCommandRange | null {
  const lines = content.split("\n");
  const cmdPattern = new RegExp(`\\\\${commandName}\\s*\\{`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = cmdPattern.exec(line);
    if (!match) continue;

    const cmdStart = match.index;
    const braceOpenPos = cmdStart + match[0].length;

    let depth = 1;
    let endLine = i;
    let endCol = -1;
    let searchDone = false;

    for (let c = braceOpenPos; c < line.length; c++) {
      if (line[c] === "{") depth++;
      else if (line[c] === "}") {
        depth--;
        if (depth === 0) { endCol = c; searchDone = true; break; }
      }
    }

    if (!searchDone) {
      for (let j = i + 1; j < lines.length && !searchDone; j++) {
        const nl = lines[j];
        for (let c = 0; c < nl.length; c++) {
          if (nl[c] === "{") depth++;
          else if (nl[c] === "}") {
            depth--;
            if (depth === 0) { endLine = j; endCol = c; searchDone = true; break; }
          }
        }
      }
    }

    if (!searchDone) continue;

    let innerText: string;
    if (endLine === i) {
      innerText = line.slice(braceOpenPos, endCol);
    } else {
      const parts = [line.slice(braceOpenPos)];
      for (let j = i + 1; j < endLine; j++) parts.push(lines[j]);
      parts.push(lines[endLine].slice(0, endCol));
      innerText = parts.join("\n");
    }

    const fullText =
      endLine === i
        ? line.slice(cmdStart, endCol + 1)
        : [line.slice(cmdStart), ...lines.slice(i + 1, endLine), lines[endLine].slice(0, endCol + 1)].join("\n");

    return {
      fullText,
      innerText,
      lineNumber: i + 1,
      startLineNumber: i + 1,
      startColumn: cmdStart + 1,
      endLineNumber: endLine + 1,
      endColumn: endCol + 2,
    };
  }

  return null;
}

export function replaceLatexCommandValue(
  content: string,
  commandName: string,
  newValue: string,
): AiEditOperation | null {
  const range = findLatexCommandRange(content, commandName);
  if (!range) return null;
  return {
    type: "replace",
    startLineNumber: range.startLineNumber,
    startColumn: range.startColumn,
    endLineNumber: range.endLineNumber,
    endColumn: range.endColumn,
    text: `\\${commandName}{${newValue}}`,
  };
}

/** Try to resolve simple user prompts (change title / author / date) without calling AI. */
export function tryLocalCommandEdit(
  content: string,
  userPrompt: string,
): { op: AiEditOperation; explanation: string } | null {
  const prompt = userPrompt.trim();

  function extractValue(trigger: string): string {
    const idx = prompt.toLowerCase().indexOf(trigger.toLowerCase());
    if (idx === -1) return "";
    return prompt.slice(idx + trigger.length).trim().replace(/^[""\u201c\u201d']+|[""\u201c\u201d']+$/g, "").trim();
  }

  const valueTriggers = [" to ", " thành ", " sang ", " là ", "→ ", ":  "];

  const checks: Array<{ test: RegExp; cmd: string; label: string }> = [
    { test: /sửa\s+title|change\s+(?:the\s+)?title|update\s+(?:the\s+)?title|set\s+(?:the\s+)?title|đổi\s+title|thay\s+title/i, cmd: "title", label: "\\title" },
    { test: /sửa\s+author|change\s+(?:the\s+)?author|update\s+(?:the\s+)?author|set\s+(?:the\s+)?author|đổi\s+author/i, cmd: "author", label: "\\author" },
    { test: /sửa\s+date|change\s+(?:the\s+)?date|set\s+(?:the\s+)?date/i, cmd: "date", label: "\\date" },
    { test: /sửa\s+abstract|rewrite\s+(?:the\s+)?abstract/i, cmd: "abstract", label: "\\abstract" },
  ];

  for (const { test, cmd, label } of checks) {
    if (test.test(prompt)) {
      for (const trigger of valueTriggers) {
        const v = extractValue(trigger);
        if (v) {
          const op = replaceLatexCommandValue(content, cmd, v);
          if (op) return { op, explanation: `Changed ${label} to "${v}"` };
        }
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports for backward compatibility with ai-edit-types.ts consumers
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Import from ai-edit-engine instead */
export const applyAiEdits = applyEditsToEditor;
/** @deprecated Import from ai-edit-engine instead */
export const previewAiEdits = (editor: any, edits: AiEditOperation[]) => {
  // Stub shim for old callers — uses a dummy ref
  const dummyRef = { current: false };
  return previewEditsInEditor(editor, edits, dummyRef);
};
/** @deprecated Import from ai-edit-engine instead */
export const highlightEditedLines = highlightLines;

// Need React for the MutableRefObject type
import type React from "react";
