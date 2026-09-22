/**
 * editor-engine.port.ts
 *
 * Core Port (Contract): Interface that any text editing engine (Monaco, TipTap, CodeMirror 6)
 * must implement to plug into the Flux Editor Workspace.
 * Dependency Rule: ZERO UI or library-specific imports.
 */

export type LatexFormatType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'inlineMath'
  | 'displayMath'
  | 'equation'
  | 'code'
  | 'strikethrough'
  | 'superscript'
  | 'subscript'
  | 'section'
  | 'subsection'
  | 'subsubsection'
  | 'itemize'
  | 'enumerate'
  | 'table'
  | 'figure'
  | 'cite'
  | 'ref'
  | 'align';

export interface EditorSelectionRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface IEditorEngine {
  /** Retrieves full document content */
  getContent(): string;

  /** Replaces entire document content */
  setContent(content: string): void;

  /** Gets active selection range, or null if no selection exists */
  getSelection(): EditorSelectionRange | null;

  /** Returns selected text string */
  getSelectedText(): string;

  /** Inserts raw text or snippet at current cursor position */
  insertText(text: string): void;

  /** Wraps current selection (or placeholder) with prefix and suffix */
  wrapSelection(prefix: string, suffix: string, placeholder?: string): void;

  /** Applies LaTeX semantic formatting to selection or cursor */
  format(type: LatexFormatType): void;

  /** Navigates editor viewport to line and optionally decorates highlight */
  jumpToLine(line: number, highlight?: 'error' | 'synctex'): void;

  /** Triggers editor undo operation */
  undo(): void;

  /** Triggers editor redo operation */
  redo(): void;

  /** Requests focus on the editor surface */
  focus(): void;

  /** Retrieves current cursor line and column (1-indexed), or null if not focused */
  getCursorPosition(): { line: number; column: number } | null;

  /** Selects all content in the editor */
  selectAll(): void;

  /** Opens the search / find widget */
  openFind(): void;

  /** Indents current line or selection */
  indent(): void;

  /** Outdents current line or selection */
  outdent(): void;

  /** Subscribes to content modifications */
  onContentChange(handler: (content: string) => void): () => void;

  /** Subscribes to cursor position updates */
  onCursorChange(handler: (line: number, col: number) => void): () => void;

  /** Cleanup handler invoked when engine unmounts */
  onDestroy(): void;
}
