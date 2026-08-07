/**
 * ai-response-parser.ts
 *
 * Robust multi-format parser for AI responses in the LaTeX editor.
 *
 * Priority chain:
 *   1. ```json  block containing { intent, edits, explanation }  → structured edit
 *   2. ```apply block (legacy EditOp format)                     → converted to AiEditOperation[]
 *   3. ```diff  block                                            → +/- lines → replace ops
 *   4. ```latex / ```tex / ``` blocks                            → code blocks for Insert/Preview
 *   5. Plain text                                                → explanation only
 */

import type { AiEditOperation, AiEditIntent, AiEditResponse } from "./ai-edit-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedCodeBlock {
  lang: string;
  code: string;
}

export interface ParsedAiResponse {
  /** Human-readable explanation text (outside code blocks) */
  explanation: string;
  /** Structured edit operations ready for Monaco */
  edits: AiEditOperation[];
  /** Edit intent */
  intent: AiEditIntent;
  /** True when there are actionable edits to apply */
  hasEdits: boolean;
  /** All code blocks found (for Insert/Preview buttons) */
  codeBlocks: ParsedCodeBlock[];
  /** Safety warning if replacement ratio is high */
  safetyWarning: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function tryParseJson(text: string): any | null {
  try { return JSON.parse(text); } catch { return null; }
}

function isValidAiEditResponse(obj: any): obj is AiEditResponse {
  return (
    obj !== null &&
    typeof obj === "object" &&
    typeof obj.intent === "string" &&
    typeof obj.explanation === "string" &&
    Array.isArray(obj.edits)
  );
}

/** Extract first complete JSON object from arbitrary text, skipping LaTeX braces. */
function extractJsonObject(text: string): string | null {
  // Only look inside ```json fences or at the very start of a bare JSON object line
  const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (fenceMatch) return fenceMatch[1];

  // Bare JSON: find a '{' that starts at the beginning of a line (avoids \begin{...})
  const bareMatch = text.match(/(?:^|\n)\s*(\{[\s\S]*\})\s*(?:\n|$)/);
  if (bareMatch) return bareMatch[1];

  return null;
}

/** Parse fenced code blocks from a raw response string. */
function extractCodeBlocks(text: string): Array<{ lang: string; code: string; start: number; end: number }> {
  const blocks: Array<{ lang: string; code: string; start: number; end: number }> = [];
  const lines = text.split("\n");
  let inBlock = false;
  let lang = "";
  let codeLines: string[] = [];
  let blockStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && line.trim().startsWith("```")) {
      inBlock = true;
      lang = line.trim().slice(3).trim().toLowerCase();
      codeLines = [];
      blockStart = i;
    } else if (inBlock && line.trim() === "```") {
      blocks.push({ lang, code: codeLines.join("\n"), start: blockStart, end: i });
      inBlock = false;
      lang = "";
      codeLines = [];
    } else if (inBlock) {
      codeLines.push(line);
    }
  }

  return blocks;
}

/** Convert a legacy EditOp (```apply block) to AiEditOperation. */
interface LegacyEditOp {
  action: "replace_lines" | "insert_after" | "insert_before" | "delete_lines";
  startLine?: number;
  endLine?: number;
  afterLine?: number;
  beforeLine?: number;
  newContent?: string;
}

function legacyOpToEditOperation(op: LegacyEditOp): AiEditOperation | null {
  if (op.action === "replace_lines" && op.startLine && op.endLine) {
    return {
      type: "replace",
      startLineNumber: op.startLine,
      startColumn: 1,
      endLineNumber: op.endLine,
      endColumn: 9999,
      text: op.newContent ?? "",
    };
  }
  if (op.action === "insert_after" && op.afterLine) {
    return {
      type: "insert",
      startLineNumber: op.afterLine,
      startColumn: 9999,
      endLineNumber: op.afterLine,
      endColumn: 9999,
      text: "\n" + (op.newContent ?? ""),
    };
  }
  if (op.action === "insert_before" && op.beforeLine) {
    return {
      type: "insert",
      startLineNumber: op.beforeLine,
      startColumn: 1,
      endLineNumber: op.beforeLine,
      endColumn: 1,
      text: (op.newContent ?? "") + "\n",
    };
  }
  if (op.action === "delete_lines" && op.startLine && op.endLine) {
    return {
      type: "delete",
      startLineNumber: op.startLine,
      startColumn: 1,
      endLineNumber: op.endLine,
      endColumn: 9999,
      text: "",
    };
  }
  return null;
}

/**
 * Convert a diff block (+/-) into edit operations by fuzzy-matching against file content.
 * Returns null if the diff can't be matched (caller falls back to a code block).
 */
function diffBlockToEdits(
  diffLines: string[],
  fileContent: string,
): AiEditOperation[] | null {
  const fileLines = fileContent.split("\n");

  const removedLines = diffLines
    .filter((l) => l.startsWith("-") && !l.startsWith("---"))
    .map((l) => l.slice(1));

  const addedLines = diffLines
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1));

  if (removedLines.length === 0 && addedLines.length === 0) return null;

  // Find the removed block in the file (exact match, first occurrence)
  if (removedLines.length > 0) {
    const target = removedLines[0].trim();
    for (let i = 0; i < fileLines.length; i++) {
      if (fileLines[i].trim() === target) {
        // Check if the whole removed block matches
        let matches = true;
        for (let j = 1; j < removedLines.length; j++) {
          if (i + j >= fileLines.length || fileLines[i + j].trim() !== removedLines[j].trim()) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return [{
            type: "replace",
            startLineNumber: i + 1,
            startColumn: 1,
            endLineNumber: i + removedLines.length,
            endColumn: (fileLines[i + removedLines.length - 1] || "").length + 1,
            text: addedLines.join("\n"),
          }];
        }
      }
    }
  }

  // Can't match — return null so caller treats the diff as a display-only block
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseAiResponse(
  rawText: string,
  fileContent = "",
): ParsedAiResponse {
  const result: ParsedAiResponse = {
    explanation: "",
    edits: [],
    intent: "no_change",
    hasEdits: false,
    codeBlocks: [],
    safetyWarning: null,
  };

  if (!rawText?.trim()) return result;

  const blocks = extractCodeBlocks(rawText);

  // ── Step 1: Look for structured JSON edit response ────────────────────────
  for (const block of blocks) {
    if (block.lang === "json" || block.lang === "") {
      const parsed = tryParseJson(block.code);
      if (parsed && isValidAiEditResponse(parsed) && parsed.edits.length > 0) {
        result.intent = parsed.intent as AiEditIntent;
        result.explanation = parsed.explanation;
        result.edits = parsed.edits;
        result.hasEdits = true;

        // Safety check
        const totalChars = fileContent.length || 1;
        let replacedChars = 0;
        for (const edit of parsed.edits) {
          if (edit.type !== "insert") {
            replacedChars += (edit.text || "").length || 200;
          }
        }
        if (replacedChars / totalChars > 0.6) {
          result.safetyWarning = `⚠️ This edit affects a large portion of your file. Review carefully.`;
        }

        return result;
      }
    }
  }

  // Bare JSON fallback (not in a fence)
  const bareJson = extractJsonObject(rawText);
  if (bareJson) {
    const parsed = tryParseJson(bareJson);
    if (parsed && isValidAiEditResponse(parsed) && parsed.edits.length > 0) {
      result.intent = parsed.intent as AiEditIntent;
      result.explanation = parsed.explanation;
      result.edits = parsed.edits;
      result.hasEdits = true;
      return result;
    }
  }

  // ── Step 2: Look for legacy ```apply blocks ──────────────────────────────
  const applyEdits: AiEditOperation[] = [];
  for (const block of blocks) {
    if (block.lang === "apply") {
      const parsed = tryParseJson(block.code);
      if (parsed) {
        const op = legacyOpToEditOperation(parsed);
        if (op) applyEdits.push(op);
      }
    }
  }
  if (applyEdits.length > 0) {
    result.intent = "replace_range";
    result.edits = applyEdits;
    result.hasEdits = true;
    // Extract explanation from non-apply text
    result.explanation = extractExplanationText(rawText, blocks);
    return result;
  }

  // ── Step 3: ```diff blocks — try to match against file ──────────────────
  for (const block of blocks) {
    if (block.lang === "diff") {
      const diffLines = block.code.split("\n");
      const ops = diffBlockToEdits(diffLines, fileContent);
      if (ops) {
        result.intent = "replace_range";
        result.edits = ops;
        result.hasEdits = true;
        result.explanation = extractExplanationText(rawText, blocks);
        result.codeBlocks.push({ lang: "diff", code: block.code });
        return result;
      }
      // Can't match diff — add as display block only
      result.codeBlocks.push({ lang: "diff", code: block.code });
    }
  }

  // ── Step 4: Collect all latex/tex/generic code blocks for display ─────────
  for (const block of blocks) {
    if (["latex", "tex", ""].includes(block.lang) && block.lang !== "diff" && block.lang !== "apply" && block.lang !== "json") {
      result.codeBlocks.push({ lang: block.lang || "latex", code: block.code });
    }
  }

  // ── Step 5: Plain text explanation ───────────────────────────────────────
  result.explanation = extractExplanationText(rawText, blocks);

  return result;
}

/** Strip code blocks from text to get the surrounding explanation. */
function extractExplanationText(
  rawText: string,
  blocks: Array<{ lang: string; code: string; start: number; end: number }>,
): string {
  const lines = rawText.split("\n");
  const blockLineSet = new Set<number>();
  for (const b of blocks) {
    for (let i = b.start; i <= b.end; i++) blockLineSet.add(i);
  }
  return lines
    .filter((_, i) => !blockLineSet.has(i))
    .join("\n")
    .trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compat shim for old callers of parseAiEditResponse
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use parseAiResponse() from ai-response-parser instead */
export function parseAiEditResponse(rawText: string): AiEditResponse | null {
  const result = parseAiResponse(rawText);
  if (!result.hasEdits) return null;
  return {
    intent: result.intent,
    explanation: result.explanation,
    edits: result.edits,
  };
}
