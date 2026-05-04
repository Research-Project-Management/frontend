/**
 * ai-edit-helpers.ts — Deterministic LaTeX Command Detection
 *
 * These functions find the exact Monaco range of common LaTeX commands
 * without relying on AI, enabling fast & reliable simple edits.
 *
 * All line numbers returned are 1-based (Monaco convention).
 */

import type { AiEditOperation } from "./ai-edit-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LatexCommandRange {
  /** Full command match, e.g. \title{Old Title} */
  fullText: string;
  /** Value inside braces, e.g. Old Title */
  innerText: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  /** Line number (same as startLineNumber for single-line commands) */
  lineNumber: number;
}

// ── LaTeX Command Finders ─────────────────────────────────────────────────────

/**
 * Find the range of a LaTeX command like \title{...} in the document.
 *
 * Supports single-line multi-brace commands. For multi-line braced content,
 * returns the entire span from the opening brace to the closing brace.
 *
 * @param content  Full editor content
 * @param commandName  Command name without backslash, e.g. "title"
 * @returns LatexCommandRange if found, null otherwise
 */
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

    const cmdStart = match.index; // column of backslash (0-based)
    const braceOpenPos = cmdStart + match[0].length; // position after '{'

    // Now find the matching closing brace, handling nested braces
    let depth = 1;
    let pos = braceOpenPos;
    let endLine = i;
    let endCol = -1;
    let searchDone = false;

    // Search within current line first
    for (let c = braceOpenPos; c < line.length; c++) {
      if (line[c] === "{") depth++;
      else if (line[c] === "}") {
        depth--;
        if (depth === 0) {
          endCol = c; // 0-based
          searchDone = true;
          break;
        }
      }
    }

    // Multi-line fallback
    if (!searchDone) {
      for (let j = i + 1; j < lines.length && !searchDone; j++) {
        const nextLine = lines[j];
        for (let c = 0; c < nextLine.length; c++) {
          if (nextLine[c] === "{") depth++;
          else if (nextLine[c] === "}") {
            depth--;
            if (depth === 0) {
              endLine = j;
              endCol = c;
              searchDone = true;
              break;
            }
          }
        }
      }
    }

    if (!searchDone) continue; // unmatched brace

    // Extract inner text
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
      startColumn: cmdStart + 1, // 1-based
      endLineNumber: endLine + 1,
      endColumn: endCol + 2, // 1-based, after closing brace
    };
  }

  return null;
}

/**
 * Build a Monaco edit operation to replace the value inside a LaTeX command.
 *
 * Example: replaceLatexCommandValue(content, "title", "Hello World")
 * → replaces \title{Old Title} with \title{Hello World}
 */
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

/**
 * Find the line number of \begin{document}.
 * Returns null if not found.
 */
export function findBeginDocumentLine(content: string): number | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/\\begin\{document\}/.test(lines[i])) return i + 1;
  }
  return null;
}

/**
 * Find the line number of \end{document}.
 * Returns null if not found.
 */
export function findEndDocumentLine(content: string): number | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/\\end\{document\}/.test(lines[i])) return i + 1;
  }
  return null;
}

/**
 * Find the line number of \maketitle.
 * Returns null if not found.
 */
export function findMakeTitleLine(content: string): number | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/\\maketitle/.test(lines[i])) return i + 1;
  }
  return null;
}

/**
 * Find the line number of \documentclass.
 * Returns null if not found.
 */
export function findDocumentclassLine(content: string): number | null {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/\\documentclass/.test(lines[i])) return i + 1;
  }
  return null;
}

// ── Document Structure Queries ─────────────────────────────────────────────────

/** Returns true if the content has a full LaTeX document structure. */
export function hasDocumentStructure(content: string): boolean {
  return (
    /\\documentclass/.test(content) &&
    /\\begin\{document\}/.test(content) &&
    /\\end\{document\}/.test(content)
  );
}

/** Returns a string with numbered lines (1-based) for AI context. */
export function addLineNumbers(content: string): string {
  const lines = content.split("\n");
  const padWidth = String(lines.length).length;
  return lines
    .map((line, i) => `${String(i + 1).padStart(padWidth, " ")}: ${line}`)
    .join("\n");
}

// ── Editor Context Collection ─────────────────────────────────────────────────

export interface EditorEditContext {
  /** Full file content */
  fileContent: string;
  /** Content with line numbers for AI reference */
  fileContentWithLineNumbers: string;
  /** Total line count */
  totalLines: number;
  /** Filename */
  filename: string;
  /** Cursor line (1-based) */
  cursorLine: number;
  /** Cursor column (1-based) */
  cursorColumn: number;
  /** Selected text (empty string if no selection) */
  selectedText: string;
  /** Selection start line (1-based), null if no selection */
  selectionStartLine: number | null;
  /** Selection start column (1-based), null if no selection */
  selectionStartColumn: number | null;
  /** Selection end line (1-based), null if no selection */
  selectionEndLine: number | null;
  /** Selection end column (1-based), null if no selection */
  selectionEndColumn: number | null;
  /** Whether the file has a full LaTeX document structure */
  hasFullDocument: boolean;
}

/**
 * Collect full edit context from the Monaco editor.
 */
export function getEditorEditContext(
  editor: any,
  filename: string,
): EditorEditContext {
  const model = editor.getModel();
  const fileContent = model?.getValue() ?? "";
  const totalLines = model?.getLineCount() ?? 0;
  const position = editor.getPosition();
  const selection = editor.getSelection();

  const cursorLine = position?.lineNumber ?? 1;
  const cursorColumn = position?.column ?? 1;

  const hasSelection =
    selection &&
    (selection.startLineNumber !== selection.endLineNumber ||
      selection.startColumn !== selection.endColumn);

  const selectedText =
    hasSelection && model ? model.getValueInRange(selection) : "";

  return {
    fileContent,
    fileContentWithLineNumbers: addLineNumbers(fileContent),
    totalLines,
    filename,
    cursorLine,
    cursorColumn,
    selectedText,
    selectionStartLine: hasSelection ? selection.startLineNumber : null,
    selectionStartColumn: hasSelection ? selection.startColumn : null,
    selectionEndLine: hasSelection ? selection.endLineNumber : null,
    selectionEndColumn: hasSelection ? selection.endColumn : null,
    hasFullDocument: hasDocumentStructure(fileContent),
  };
}

// ── Simple Command Intent Detection ──────────────────────────────────────────

/**
 * Detect if the user prompt is a simple LaTeX command change (title/author/date/etc.)
 * and build a direct edit without calling the AI.
 *
 * Supports Vietnamese and English prompts.
 * Returns an edit + explanation if handled locally, null if AI should handle it.
 */
export function tryLocalCommandEdit(
  content: string,
  userPrompt: string,
): { op: AiEditOperation; explanation: string } | null {
  const prompt = userPrompt.trim();

  /** Extract new value: everything after the trigger word "to"/"thành"/etc. */
  function extractValue(trigger: string): string {
    const idx = prompt.toLowerCase().indexOf(trigger.toLowerCase());
    if (idx === -1) return "";
    return prompt.slice(idx + trigger.length).trim().replace(/^["\u201c\u201d']+|["\u201c\u201d']+$/g, "").trim();
  }

  // Triggers for each language
  const valueTriggers = [" to ", " thành ", " sang ", " là ", "\u2192 ", ":  "];

  // ── \title ────────────────────────────────────────────────────────────────
  const isTitleCmd =
    /sửa\s+title/i.test(prompt) ||
    /change\s+(?:the\s+)?title/i.test(prompt) ||
    /update\s+(?:the\s+)?title/i.test(prompt) ||
    /set\s+(?:the\s+)?title/i.test(prompt) ||
    /đổi\s+title/i.test(prompt) ||
    /thay\s+title/i.test(prompt);

  if (isTitleCmd) {
    let newValue = "";
    for (const t of valueTriggers) {
      const v = extractValue(t);
      if (v) { newValue = v; break; }
    }
    if (newValue) {
      const op = replaceLatexCommandValue(content, "title", newValue);
      if (op) return { op, explanation: `Changed \\title to “${newValue}”` };
    }
  }

  // ── \author ────────────────────────────────────────────────────────────────
  const isAuthorCmd =
    /sửa\s+author/i.test(prompt) ||
    /change\s+(?:the\s+)?author/i.test(prompt) ||
    /update\s+(?:the\s+)?author/i.test(prompt) ||
    /set\s+(?:the\s+)?author/i.test(prompt) ||
    /đổi\s+author/i.test(prompt);

  if (isAuthorCmd) {
    let newValue = "";
    for (const t of valueTriggers) {
      const v = extractValue(t);
      if (v) { newValue = v; break; }
    }
    if (newValue) {
      const op = replaceLatexCommandValue(content, "author", newValue);
      if (op) return { op, explanation: `Changed \\author to “${newValue}”` };
    }
  }

  // ── \date ────────────────────────────────────────────────────────────────
  const isDateCmd =
    /sửa\s+date/i.test(prompt) ||
    /change\s+(?:the\s+)?date/i.test(prompt) ||
    /set\s+(?:the\s+)?date/i.test(prompt);

  if (isDateCmd) {
    let newValue = "";
    for (const t of valueTriggers) {
      const v = extractValue(t);
      if (v) { newValue = v; break; }
    }
    if (newValue) {
      const op = replaceLatexCommandValue(content, "date", newValue);
      if (op) return { op, explanation: `Changed \\date to “${newValue}”` };
    }
  }

  return null;
}
