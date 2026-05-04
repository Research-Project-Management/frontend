/**
 * ai-edit-types.ts — Structured AI Edit Response Types & Parser
 */

// ── Types ─────────────────────────────────────────────────────────────────────

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

export function parseAiEditResponse(
  rawText: string,
  fileContent?: string,
): AiEditResponse | null {
  if (!rawText || !rawText.trim()) return null;

  // ── 1. Structured JSON (explicit intent + edits array) ─────────────────────
  const jsonFenceMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) {
    const parsed = tryParseJson(jsonFenceMatch[1].trim());
    if (parsed && isValidAiEditResponse(parsed)) {
      // Normalize: upgrade insert→replace when command already exists in file
      if (fileContent) parsed.edits = normalizeEdits(parsed.edits, fileContent);
      return parsed;
    }
  }
  // Bare JSON at line-start (avoids \begin{...})
  const bareJson = extractFirstJsonObject(rawText);
  if (bareJson) {
    const parsed = tryParseJson(bareJson);
    if (parsed && isValidAiEditResponse(parsed)) {
      if (fileContent) parsed.edits = normalizeEdits(parsed.edits, fileContent);
      return parsed;
    }
  }

  // ── 2. Multi-block: collect ALL diff/latex/tex fences ─────────────────────
  if (fileContent !== undefined) {
    const blocks = extractAllCodeBlocks(rawText);
    if (blocks.length > 0) {
      const ops: AiEditOperation[] = [];
      const explanations: string[] = [];

      for (const block of blocks) {
        if (block.lang === "diff") {
          const diffOps = parseDiffToEdits(block.code, fileContent);
          ops.push(...diffOps);
          explanations.push(`Apply diff (${diffOps.length} hunk${diffOps.length !== 1 ? "s" : ""})`);
        } else if (["latex", "tex", ""].includes(block.lang)) {
          // Smart replace: handles both single-command replace and new inserts
          const blockOps = latexBlockToOps(block.code, fileContent);
          ops.push(...blockOps);
          const hasReplace = blockOps.some(o => o.type === "replace");
          explanations.push(hasReplace ? "Update existing commands" : "Insert code");
        }
      }

      if (ops.length > 0) {
        return {
          intent: "replace_range",
          explanation: explanations.join("; ") || "Apply AI suggestion",
          edits: ops,
        };
      }
    }
  }

  return null;
}

/**
 * Post-process edit ops: if an op is type "insert" and its text is a SINGLE-LINE
 * LaTeX preamble command (e.g. \title{...}, \author{...}) that ALREADY EXISTS
 * in the file, upgrade it to a "replace" op targeting the existing command's range.
 *
 * IMPORTANT: This only applies to single-line preamble-style commands.
 * Multi-line blocks (figure, table, equation environments) MUST keep their
 * original line numbers from the AI which has seen the full file.
 *
 * Commands excluded from normalization:
 * - \begin / \end (environment delimiters)
 * - Any insert spanning multiple lines
 * - Commands not typically in the preamble
 */
function normalizeEdits(
  edits: AiEditOperation[],
  fileContent: string,
): AiEditOperation[] {
  const fileLines = fileContent.split("\n");

  // Preamble-only commands that can safely be replaced
  const REPLACEABLE_COMMANDS = new Set([
    "title", "author", "date", "documentclass",
    "usepackage", "institute", "subtitle",
  ]);

  return edits.map(op => {
    if (op.type !== "insert") return op;

    // Skip multi-line inserts — they contain entire environments like \begin{figure}
    const text = op.text.trim();
    if (text.includes("\n")) return op;

    // Skip if text starts with \begin or \end
    if (/^\\(begin|end)\s*\{/.test(text)) return op;

    // Match single-line preamble commands only
    const cmdMatch = text.match(/^\\([a-zA-Z]+)\s*[\{\[]/);
    if (!cmdMatch) return op;

    const cmdName = cmdMatch[1];

    // Only normalize known replaceable commands
    if (!REPLACEABLE_COMMANDS.has(cmdName)) return op;

    const existing = findCommandRangeInContent(fileLines, cmdName);
    if (!existing) return op;

    // Upgrade: replace the existing command instead of inserting a duplicate
    return {
      type: "replace" as const,
      startLineNumber: existing.startLine,
      startColumn: 1,
      endLineNumber: existing.endLine,
      endColumn: fileLines[existing.endLine - 1].length + 1,
      text: text,
    };
  });
}


// ── Diff block → AiEditOperation[] (fuzzy context matcher) ────────────────────

/**
 * Parse a unified-diff-style block and locate the changes in `fileContent`
 * by fuzzy-matching context lines (lines starting with " " or no prefix).
 * Works even without @@ headers — the AI often omits them.
 */
export function parseDiffToEdits(
  diffText: string,
  fileContent: string,
): AiEditOperation[] {
  const fileLines = fileContent.split("\n");
  const ops: AiEditOperation[] = [];

  // Split into hunks: either by @@ markers or treat whole block as one hunk
  const rawHunks = diffText.includes("@@")
    ? diffText.split(/^@@[^@]*@@[^\n]*/m).filter(Boolean)
    : [diffText];

  for (const hunk of rawHunks) {
    const lines = hunk.split("\n").filter(
      (l) => !l.startsWith("---") && !l.startsWith("+++"),
    );

    const contextBefore: string[] = [];
    const removed: string[] = [];
    const added: string[] = [];
    let seenChange = false;

    for (const line of lines) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        added.push(line.slice(1));
        seenChange = true;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        removed.push(line.slice(1));
        seenChange = true;
      } else {
        // Context line (space-prefixed or bare)
        const ctx = line.startsWith(" ") ? line.slice(1) : line;
        if (!seenChange && ctx.trim()) contextBefore.push(ctx);
      }
    }

    if (added.length === 0 && removed.length === 0) continue;

    // Find the location using: removed lines first, then context before
    const searchTarget = removed.length > 0 ? removed : contextBefore;
    const matchLine = fuzzyFindLines(fileLines, searchTarget);

    if (matchLine === -1) {
      // Could not locate via fuzzy search.
      // Special case: if we only have added lines (no removed) and each added
      // line is a LaTeX command, try to smart-replace the existing command.
      if (removed.length === 0) {
        for (const addedLine of added) {
          const cmdMatch = addedLine.trim().match(/^\\([a-zA-Z]+)\s*\{/);
          if (cmdMatch) {
            const existing = findCommandRangeInContent(fileLines, cmdMatch[1]);
            if (existing) {
              ops.push({
                type: "replace",
                startLineNumber: existing.startLine,
                startColumn: 1,
                endLineNumber: existing.endLine,
                endColumn: fileLines[existing.endLine - 1].length + 1,
                text: addedLine.trim(),
              });
              continue;
            }
          }
          // No existing command — try context anchor insert
          if (contextBefore.length > 0) {
            const anchor = fuzzyFindLines(fileLines, contextBefore);
            if (anchor !== -1) {
              const insertAt = anchor + contextBefore.length;
              const insertLine = insertAt + 1;
              ops.push({
                type: "insert",
                startLineNumber: insertLine,
                startColumn: fileLines[insertAt]?.length + 1 ?? 1,
                endLineNumber: insertLine,
                endColumn: fileLines[insertAt]?.length + 1 ?? 1,
                text: "\n" + addedLine,
              });
            }
          }
        }
      }
      continue;
    }

    // We found where the removed/original lines are
    const startLineNumber = matchLine + 1; // 1-based
    const endLineNumber = startLineNumber + Math.max(removed.length, 1) - 1;
    const endLine = fileLines[endLineNumber - 1] ?? "";

    ops.push({
      type: removed.length > 0 ? "replace" : "insert",
      startLineNumber,
      startColumn: 1,
      endLineNumber,
      endColumn: endLine.length + 1,
      text: added.join("\n"),
    });
  }

  return ops;
}

/**
 * Fuzzy line search: find the first occurrence of `targetLines` inside
 * `fileLines`, trimming whitespace for comparison.
 * Returns the 0-based index of the first matched line, or -1.
 */
function fuzzyFindLines(fileLines: string[], targetLines: string[]): number {
  if (targetLines.length === 0) return -1;
  const normalized = targetLines.map((l) => l.trim()).filter(Boolean);
  if (normalized.length === 0) return -1;

  outer: for (let i = 0; i <= fileLines.length - normalized.length; i++) {
    for (let j = 0; j < normalized.length; j++) {
      if (fileLines[i + j]?.trim() !== normalized[j]) continue outer;
    }
    return i;
  }
  return -1;
}

/**
 * Convert a bare ```latex code block to an AiEditOperation.
 *
 * Priority:
 *  1. If the block is a SINGLE LaTeX command (e.g. \title{...}),
 *     find the existing occurrence in the file and REPLACE it.
 *  2. If multiple commands or it's a block snippet, check if each
 *     individual command already exists and replace them in sequence.
 *  3. If nothing matches, insert after \begin{document} (or append).
 */
function latexBlockToInsertOp(
  code: string,
  fileContent: string,
): AiEditOperation | null {
  const trimmed = code.trim();
  const fileLines = fileContent.split("\n");

  // ── Try to replace each single-command line in the block ──────────────────
  // Split block into lines and process single-command lines first
  const blockLines = trimmed.split("\n").filter(l => l.trim());

  // Check if the ENTIRE block is a single command like \title{...}
  const singleCmdMatch = trimmed.match(/^\\([a-zA-Z]+)\s*(\{[\s\S]*\}|\[[\s\S]*\])?\s*$/);
  if (singleCmdMatch) {
    const cmdName = singleCmdMatch[1];
    const existing = findCommandRangeInContent(fileLines, cmdName);
    if (existing) {
      return {
        type: "replace",
        startLineNumber: existing.startLine,
        startColumn: 1,
        endLineNumber: existing.endLine,
        endColumn: fileLines[existing.endLine - 1].length + 1,
        text: trimmed,
      };
    }
  }

  // ── Multi-command block: try to find each \cmd{ on its own line ───────────
  // For blocks like: \title{...}\n\author{...}\n...
  // Find the first command that already exists and replace from there
  for (const line of blockLines) {
    const m = line.match(/^\\([a-zA-Z]+)\s*\{/);
    if (!m) continue;
    const cmdName = m[1];
    const existing = findCommandRangeInContent(fileLines, cmdName);
    if (existing) {
      // Replace only this specific command line
      return {
        type: "replace",
        startLineNumber: existing.startLine,
        startColumn: 1,
        endLineNumber: existing.endLine,
        endColumn: fileLines[existing.endLine - 1].length + 1,
        text: line.trim(),
      };
    }
  }

  // ── Fallback: insert after \begin{document} ────────────────────────────────
  const beginDoc = fileLines.findIndex(l => l.includes("\\begin{document}"));
  const insertAt = beginDoc !== -1 ? beginDoc + 1 : fileLines.length;
  const insertLine = insertAt + 1; // 1-based
  const col = (fileLines[insertAt - 1] ?? "").length + 1;
  return {
    type: "insert",
    startLineNumber: insertLine,
    startColumn: col,
    endLineNumber: insertLine,
    endColumn: col,
    text: "\n" + trimmed,
  };
}

/**
 * Find the line range (1-based) of \cmdName{...} in fileLines.
 * Handles multi-line braces and nested braces.
 * Returns { startLine, endLine } or null if not found.
 */
function findCommandRangeInContent(
  fileLines: string[],
  cmdName: string,
): { startLine: number; endLine: number } | null {
  const pattern = new RegExp(`\\\\${cmdName}\\s*\\{`);

  for (let i = 0; i < fileLines.length; i++) {
    const lineText = fileLines[i];
    const match = pattern.exec(lineText);
    if (!match) continue;

    // Position of the opening '{' (0-based column on line i)
    const braceOpenCol = match.index + match[0].length - 1; // -1 because match includes '{'

    // Walk forward from the opening brace counting depth
    let depth = 0;
    for (let j = i; j < fileLines.length; j++) {
      const line = fileLines[j];
      const startCol = j === i ? braceOpenCol : 0;
      for (let c = startCol; c < line.length; c++) {
        const ch = line[c];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            return { startLine: i + 1, endLine: j + 1 };
          }
        }
      }
    }
    // Unmatched brace — treat as single line
    return { startLine: i + 1, endLine: i + 1 };
  }
  return null;
}


/**
 * Convert a latex block to MULTIPLE AiEditOperations — one per command line.
 * - If a command already exists in the file → REPLACE it.
 * - If it's new → INSERT after \begin{document}.
 */
function latexBlockToOps(code: string, fileContent: string): AiEditOperation[] {
  const trimmed = code.trim();
  const fileLines = fileContent.split("\n");
  const ops: AiEditOperation[] = [];
  const blockLines = trimmed.split("\n").filter(l => l.trim());

  // Single-line block: delegate to existing single-op function
  if (blockLines.length <= 1) {
    const op = latexBlockToInsertOp(code, fileContent);
    if (op) ops.push(op);
    return ops;
  }

  for (const line of blockLines) {
    const cmdMatch = line.trim().match(/^\\([a-zA-Z]+)\s*[\{\[]/);
    if (cmdMatch) {
      const existing = findCommandRangeInContent(fileLines, cmdMatch[1]);
      if (existing) {
        ops.push({
          type: "replace",
          startLineNumber: existing.startLine,
          startColumn: 1,
          endLineNumber: existing.endLine,
          endColumn: fileLines[existing.endLine - 1].length + 1,
          text: line.trim(),
        });
        continue;
      }
    }
    // New command — insert after \begin{document}
    const beginDoc = fileLines.findIndex(l => l.includes("\\begin{document}"));
    const insertAt = beginDoc !== -1 ? beginDoc + 1 : fileLines.length;
    const col = (fileLines[insertAt - 1] ?? "").length + 1;
    ops.push({
      type: "insert",
      startLineNumber: insertAt + 1,
      startColumn: col,
      endLineNumber: insertAt + 1,
      endColumn: col,
      text: "\n" + line.trim(),
    });
  }
  return ops;
}

// ── Multi-block extractor ─────────────────────────────────────────────────────


interface CodeBlock { lang: string; code: string; }

function extractAllCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const re = /```(\w*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lang = m[1].toLowerCase().trim();
    const code = m[2];
    // Skip JSON blocks — those are structured edits handled above
    if (lang === "json") continue;
    blocks.push({ lang, code });
  }
  return blocks;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Try to parse JSON, with fallback sanitization for common AI mistakes:
 * - Literal newlines/tabs inside string values (should be \n \t)
 * - Trailing commas before } or ]
 */
function tryParseJson(text: string): any | null {
  // First try raw parse
  try { return JSON.parse(text); } catch { /* fall through to sanitize */ }

  // Sanitize: replace literal newlines/carriage returns inside string values
  // Strategy: walk char-by-char, track whether we're inside a JSON string,
  // and replace raw \n, \r, \t inside strings with their escape equivalents.
  try {
    let sanitized = "";
    let inString = false;
    let escape = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escape) {
        sanitized += ch;
        escape = false;
        continue;
      }
      if (ch === "\\" && inString) {
        sanitized += ch;
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        sanitized += ch;
        continue;
      }
      if (inString) {
        // Escape raw control characters that break JSON string parsing
        if (ch === "\n") { sanitized += "\\n"; continue; }
        if (ch === "\r") { sanitized += "\\r"; continue; }
        if (ch === "\t") { sanitized += "\\t"; continue; }
      }
      sanitized += ch;
    }
    // Also strip trailing commas before } or ]
    sanitized = sanitized.replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(sanitized);
  } catch {
    return null;
  }
}


function isValidAiEditResponse(obj: any): obj is AiEditResponse {
  return (
    typeof obj === "object" && obj !== null &&
    typeof obj.intent === "string" &&
    typeof obj.explanation === "string" &&
    Array.isArray(obj.edits)
  );
}

function extractFirstJsonObject(text: string): string | null {
  // Only match '{' at the very start of a line — skips \begin{}, \cmd{}, \textbf{} etc.
  const m = /(?:^|\n)([ \t]*\{)/m.exec(text);
  if (!m) return null;
  const start = text.indexOf("{", m.index);
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    // Stay in string even across raw newlines — AI often emits multi-line text values
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}


// ── Validation ────────────────────────────────────────────────────────────────

export function validateAiEdits(
  edits: AiEditOperation[],
  totalLines: number,
  fileContent: string,
): AiEditValidationResult {
  const errors: string[] = [];
  const lines = fileContent.split("\n");
  let totalReplacedChars = 0;
  const totalChars = fileContent.length;

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const idx = i + 1;

    // Insert ops are allowed to target totalLines + 1 (inserting after last line)
    const maxLine = edit.type === "insert" ? totalLines + 1 : totalLines;

    if (edit.startLineNumber < 1 || edit.startLineNumber > maxLine)
      errors.push(`Edit ${idx}: startLineNumber ${edit.startLineNumber} out of range (1\u2013${maxLine})`);
    if (edit.endLineNumber < 1 || edit.endLineNumber > maxLine)
      errors.push(`Edit ${idx}: endLineNumber ${edit.endLineNumber} out of range (1\u2013${maxLine})`);
    if (edit.startColumn < 1) errors.push(`Edit ${idx}: startColumn must be \u2265 1`);
    if (edit.endColumn < 1) errors.push(`Edit ${idx}: endColumn must be \u2265 1`);
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
    replacementRatio: totalChars > 0 ? totalReplacedChars / totalChars : 0,
  };
}

export function isEditSafe(result: AiEditValidationResult, intent: AiEditIntent): boolean {
  if (intent === "append_to_file" || intent === "no_change") return true;
  if (result.replacementRatio > 0.6) return false;
  return result.valid;
}

// ── Monaco Edit Applier ───────────────────────────────────────────────────────

/**
 * Apply structured AI edits to a Monaco editor instance.
 *
 * Uses PLAIN IRange objects (no new monaco.Range() needed) so this works
 * regardless of whether window.monaco is set.
 *
 * Returns the set of changed line numbers for post-apply highlighting.
 */
export function applyAiEdits(
  editor: any,
  edits: AiEditOperation[],
): { startLine: number; endLine: number } | null {
  const model = editor.getModel();
  if (!model) return null;

  const totalLines = model.getLineCount();

  const monacoEdits = edits.map((edit) => {
    // Clamp to valid range
    const sl = Math.max(1, Math.min(edit.startLineNumber, totalLines));
    const el = Math.max(1, Math.min(edit.endLineNumber, totalLines));
    const sc = Math.max(1, edit.startColumn);
    // For end column: clamp to line length if possible
    const lineMaxCol = model.getLineMaxColumn(el);
    const ec = edit.type === "insert" ? sc : Math.min(Math.max(1, edit.endColumn), lineMaxCol + 1);

    return {
      // Plain IRange — Monaco accepts this without needing new monaco.Range()
      range: {
        startLineNumber: sl,
        startColumn: sc,
        endLineNumber: el,
        endColumn: ec,
      },
      text: edit.type === "delete" ? "" : (edit.text ?? ""),
      forceMoveMarkers: true,
    };
  });

  // Create undo checkpoint BEFORE edit so Ctrl+Z reverts cleanly
  editor.pushUndoStop();
  editor.executeEdits("ai-assistant", monacoEdits);
  editor.pushUndoStop();

  // Reveal and move cursor to the first edit location
  const first = monacoEdits[0];
  if (first) {
    editor.revealLineInCenter(first.range.startLineNumber);

    // Position cursor at end of inserted text
    const insertedText = first.text || "";
    const insertedLines = insertedText.split("\n");
    const newEndLine = first.range.startLineNumber + insertedLines.length - 1;
    const newEndCol = insertedLines.length === 1
      ? first.range.startColumn + insertedLines[0].length
      : insertedLines[insertedLines.length - 1].length + 1;

    editor.setPosition({ lineNumber: newEndLine, column: newEndCol });
  }

  editor.focus();

  // Return affected range for caller to highlight
  const allStartLines = edits.map(e => e.startLineNumber);
  const allEndLines = edits.map(e => {
    const text = e.text || "";
    const insertedLineCount = text.split("\n").length - 1;
    return e.startLineNumber + insertedLineCount;
  });
  return {
    startLine: Math.min(...allStartLines),
    endLine: Math.max(...allEndLines),
  };
}

// ── Editor Highlight (post-apply green flash) ─────────────────────────────────

const HIGHLIGHT_CLASS = "ai-edit-highlight-line";

/**
 * Flash the edited lines green for 1.5s after an apply.
 * Requires a CSS rule: .ai-edit-highlight-line { background: rgba(34,197,94,0.15); }
 */
export function highlightEditedLines(
  editor: any,
  startLine: number,
  endLine: number,
  durationMs = 1500,
): void {
  const decorationsCollection = editor.createDecorationsCollection([
    {
      range: {
        startLineNumber: startLine,
        startColumn: 1,
        endLineNumber: endLine,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: HIGHLIGHT_CLASS,
      },
    },
  ]);

  setTimeout(() => {
    try { decorationsCollection.clear(); } catch { /* editor may be disposed */ }
  }, durationMs);
}

// ── Preview edits (shows change in editor before user confirms) ───────────────

const PREVIEW_CLASS = "ai-edit-preview-line";

export interface AiEditPreviewHandle {
  /** Model alternativeVersionId BEFORE the preview edits — used to undo on Dismiss */
  preVersionId: number;
  /** Remove blue preview decorations (call on both Apply and Dismiss) */
  clearDecorations: () => void;
  /** Line range that was changed — used for green flash on Apply */
  affected: { startLine: number; endLine: number } | null;
}

/**
 * Apply edits as a private LOCAL-ONLY preview:
 * - Edits are applied WITHOUT an undo-stop, so a single undo reverts them.
 * - Changed lines get a blue ghost decoration so the user can see the diff inline.
 *
 * Caller workflow:
 *   const handle = previewAiEdits(editor, edits);
 *   // Apply  → handle.clearDecorations() then flash green (edits already in model)
 *   // Dismiss → handle.clearDecorations() then model.undo() to preVersionId
 */
export function previewAiEdits(
  editor: any,
  edits: AiEditOperation[],
): AiEditPreviewHandle {
  const model = editor.getModel();
  if (!model) {
    return { preVersionId: 0, clearDecorations: () => {}, affected: null };
  }

  const preVersionId = model.getAlternativeVersionId();
  const totalLines = model.getLineCount();

  const monacoEdits = edits.map((edit) => {
    const sl = Math.max(1, Math.min(edit.startLineNumber, totalLines));
    const el = Math.max(1, Math.min(edit.endLineNumber, totalLines));
    const sc = Math.max(1, edit.startColumn);
    const lineMaxCol = model.getLineMaxColumn(el);
    const ec = edit.type === "insert"
      ? sc
      : Math.min(Math.max(1, edit.endColumn), lineMaxCol + 1);
    return {
      range: { startLineNumber: sl, startColumn: sc, endLineNumber: el, endColumn: ec },
      text: edit.type === "delete" ? "" : (edit.text ?? ""),
      forceMoveMarkers: true,
    };
  });

  // Apply WITHOUT pushUndoStop so one Ctrl+Z (or model.undo) reverts cleanly
  editor.executeEdits("ai-preview", monacoEdits);

  const allStartLines = edits.map(e => e.startLineNumber);
  const allEndLines = edits.map(e =>
    e.startLineNumber + Math.max(0, (e.text || "").split("\n").length - 1)
  );
  const affected = {
    startLine: Math.min(...allStartLines),
    endLine: Math.max(...allEndLines),
  };

  // Blue ghost decorations
  const decorationRanges = [];
  for (let ln = affected.startLine; ln <= Math.min(affected.endLine, model.getLineCount()); ln++) {
    decorationRanges.push({
      range: { startLineNumber: ln, startColumn: 1, endLineNumber: ln, endColumn: 1 },
      options: { isWholeLine: true, className: PREVIEW_CLASS },
    });
  }
  const collection = editor.createDecorationsCollection(decorationRanges);
  editor.revealLineInCenter(affected.startLine);

  return {
    preVersionId,
    clearDecorations: () => { try { collection.clear(); } catch { /* disposed */ } },
    affected,
  };
}

