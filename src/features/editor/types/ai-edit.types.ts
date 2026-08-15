/**
 * ai-edit.types.ts — Pure type declarations for AI editing.
 * No functions or logic. All runtime logic lives in services/ai-edit.services.ts
 */

export type AiEditIntent =
  | 'replace_range'
  | 'insert_at_cursor'
  | 'replace_selection'
  | 'append_to_file'
  | 'no_change';

export interface AiEditOperation {
  type: 'replace' | 'insert' | 'delete';
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

export interface AiEditPreviewHandle {
  /** Content snapshot BEFORE applying preview — used for atomic revert. */
  snapshot: string;
  /** Cursor position snapshot for revert. */
  cursorSnapshot: { lineNumber: number; column: number } | null;
  /** Remove blue preview decorations. */
  clearDecorations: () => void;
  /** Affected line range (for green-flash highlight on Apply). */
  affected: { startLine: number; endLine: number } | null;
}

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

export interface EditorEditContext {
  fileContent: string;
  fileContentWithLineNumbers: string;
  totalLines: number;
  filename: string;
  cursorLine: number;
  cursorColumn: number;
  selectedText: string;
  selectionStartLine: number | null;
  selectionStartColumn: number | null;
  selectionEndLine: number | null;
  selectionEndColumn: number | null;
  hasFullDocument: boolean;
}
