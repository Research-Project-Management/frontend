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
  | 'paragraph'
  | 'subparagraph'
  | 'normal'
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

export interface DiffProposal {
  id: string;
  from: number;
  to: number;
  originalText: string;
  replacementText: string;
  title?: string;
  createdAt: number;
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

  /** Replaces text within an absolute range [from, to] */
  replaceRange?(text: string, from: number, to: number): void;

  /** Proposes an AI inline diff review widget instead of immediate direct replacement */
  proposeDiff?(proposal: DiffProposal): void;

  /** Clears any active AI diff preview without applying */
  clearDiff?(): void;

  /** Accepts active AI diff proposal */
  acceptDiff?(diffId?: string): void;

  /** Rejects active AI diff proposal */
  rejectDiff?(diffId?: string): void;

  /** Gets character offset range for the active selection */
  getSelectionOffsets?(): { from: number; to: number } | null;

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

  /** Sets the search and replace query */
  setSearchQuery?(spec: {
    search: string;
    replace?: string;
    caseSensitive?: boolean;
    regexp?: boolean;
    wholeWord?: boolean;
  }): void;

  /** Navigates to the next search match */
  findNext?(): boolean;

  /** Navigates to the previous search match */
  findPrevious?(): boolean;

  /** Replaces the currently selected match */
  replaceNext?(): boolean;

  /** Replaces all occurrences matching query */
  replaceAll?(): boolean;

  /** Clears search highlights and query */
  clearSearch?(): void;

  /** Counts total matches and current index for active query */
  getSearchMatchesCount?(spec: {
    search: string;
    caseSensitive?: boolean;
    regexp?: boolean;
    wholeWord?: boolean;
  }): { current: number; total: number };

  /** Cleanup handler invoked when engine unmounts */
  onDestroy(): void;
}
