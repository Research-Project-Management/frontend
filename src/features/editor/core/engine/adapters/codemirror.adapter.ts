/**
 * codemirror.adapter.ts
 *
 * Concrete Adapter: Implements IEditorEngine for the unified CodeMirror 6 Editor.
 * Translates IEditorEngine commands into CodeMirror 6 State Transactions.
 */

import { EditorView } from '@codemirror/view';
import { Annotation, EditorSelection, StateEffect } from '@codemirror/state';
import { undo, redo, selectAll, indentMore, indentLess, toggleComment } from '@codemirror/commands';
import {
  openSearchPanel,
  closeSearchPanel,
  searchPanelOpen,
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from '@codemirror/search';
import type {
  IEditorEngine,
  EditorSelectionRange,
  LatexFormatType,
  DiffProposal,
} from '@/features/editor/domain/types/ports/editor-engine.port';
import {
  proposeDiffEffect,
  clearDiffEffect,
  acceptDiffEffect,
  rejectDiffEffect,
  diffProposalField,
} from '@/features/editor/core/engine/extensions/inline-diff';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';

export const programmaticSyncAnnotation = Annotation.define<boolean>();

// Effect to trigger line flash/highlight for SyncTeX or compiler errors
export const highlightLineEffect = StateEffect.define<{ line: number; type: 'synctex' | 'error' }>();
export const clearHighlightEffect = StateEffect.define<void>();

export class CodeMirrorEngineAdapter implements IEditorEngine {
  private view: EditorView;
  private contentListeners = new Set<(content: string) => void>();
  private cursorListeners = new Set<(line: number, col: number) => void>();
  private cursorRafId: number | null = null;
  private lastCursorLine = -1;
  private lastCursorCol = -1;

  constructor(view: EditorView) {
    this.view = view;
  }

  public setView(view: EditorView): void {
    this.view = view;
  }

  /**
   * Called by the CodeMirror updateListener extension on every doc/selection change.
   */
  public handleViewUpdate(update: { docChanged: boolean; selectionSet: boolean }) {
    if (update.docChanged) {
      const content = this.getContent();
      for (const listener of this.contentListeners) {
        listener(content);
      }
    }

    if ((update.selectionSet || update.docChanged) && this.cursorListeners.size > 0) {
      if (this.cursorRafId === null) {
        this.cursorRafId = requestAnimationFrame(() => {
          this.cursorRafId = null;
          const pos = this.getCursorPosition();
          if (pos && (pos.line !== this.lastCursorLine || pos.column !== this.lastCursorCol)) {
            this.lastCursorLine = pos.line;
            this.lastCursorCol = pos.column;
            for (const listener of this.cursorListeners) {
              listener(pos.line, pos.column);
            }
          }
        });
      }
    }
  }

  getContent(): string {
    return this.view.state.doc.toString();
  }

  setContent(content: string): void {
    const current = this.getContent();
    if (current === content) return;

    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: content },
    });
  }

  getSelection(): EditorSelectionRange | null {
    const { from, to } = this.view.state.selection.main;
    const fromLine = this.view.state.doc.lineAt(from);
    const toLine = this.view.state.doc.lineAt(to);

    return {
      startLine: fromLine.number,
      startColumn: from - fromLine.from + 1,
      endLine: toLine.number,
      endColumn: to - toLine.from + 1,
    };
  }

  getSelectedText(): string {
    const { from, to } = this.view.state.selection.main;
    return this.view.state.sliceDoc(from, to);
  }

  insertText(text: string): void {
    this.view.dispatch(this.view.state.replaceSelection(text));
  }

  replaceRange(text: string, from: number, to: number): void {
    this.view.dispatch({
      changes: { from, to, insert: text },
      selection: EditorSelection.cursor(from + text.length),
    });
    this.view.focus();
  }

  getSelectionOffsets(): { from: number; to: number } | null {
    if (!this.view.state) return null;
    const { from, to } = this.view.state.selection.main;
    return { from, to };
  }

  proposeDiff(proposal: DiffProposal): void {
    if (this.view.state.readOnly) return;
    this.view.dispatch({
      effects: [proposeDiffEffect.of(proposal)],
    });
    // Scroll cursor into view near the diff proposal
    const safePos = Math.max(0, Math.min(proposal.from, this.view.state.doc.length));
    this.view.dispatch({
      selection: EditorSelection.cursor(safePos),
      scrollIntoView: true,
    });
  }

  clearDiff(): void {
    this.view.dispatch({
      effects: [clearDiffEffect.of()],
    });
  }

  acceptDiff(diffId?: string): void {
    if (this.view.state.readOnly) return;
    const current = this.view.state.field(diffProposalField, false);
    if (current?.proposal && (!diffId || current.proposal.id === diffId)) {
      const docLen = this.view.state.doc.length;
      const from = Math.max(0, Math.min(current.proposal.from, docLen));
      const to = Math.max(from, Math.min(current.proposal.to, docLen));
      const resolvedProposal: DiffProposal = { ...current.proposal, from, to };
      this.view.dispatch({
        changes: {
          from,
          to,
          insert: resolvedProposal.replacementText,
        },
        effects: [acceptDiffEffect.of(resolvedProposal.id)],
        userEvent: 'ai.accept-diff',
      });
      editorCommandBus.dispatch({
        type: 'ai:diff-resolved',
        action: 'accept',
        proposalId: resolvedProposal.id,
        proposal: resolvedProposal,
      });
      this.view.focus();
    }
  }

  rejectDiff(diffId?: string): void {
    const current = this.view.state.field(diffProposalField, false);
    const targetId = diffId || current?.proposal?.id || '';
    this.view.dispatch({
      effects: [rejectDiffEffect.of(targetId)],
      userEvent: 'ai.reject-diff',
    });
    editorCommandBus.dispatch({
      type: 'ai:diff-resolved',
      action: 'reject',
      proposalId: targetId,
    });
    this.view.focus();
  }

  wrapSelection(prefix: string, suffix: string, placeholder = ''): void {
    const { from, to } = this.view.state.selection.main;
    const selected = this.view.state.sliceDoc(from, to) || placeholder;
    const replacement = `${prefix}${selected}${suffix}`;

    this.view.dispatch({
      changes: { from, to, insert: replacement },
      selection: EditorSelection.cursor(from + prefix.length + selected.length),
    });
  }

  private static readonly LATEX_WRAP_FORMAT_SPECS: Readonly<
    Partial<Record<LatexFormatType, readonly [prefix: string, suffix: string]>>
  > = {
    bold: ['\\textbf{', '}'],
    italic: ['\\textit{', '}'],
    underline: ['\\underline{', '}'],
    inlineMath: ['$', '$'],
    displayMath: ['\\[\n  ', '\n\\]'],
    equation: ['\\begin{equation}\n  ', '\n\\end{equation}'],
    code: ['\\texttt{', '}'],
    strikethrough: ['\\sout{', '}'],
    superscript: ['^{', '}'],
    subscript: ['_{', '}'],
    section: ['\\section{', '}\n'],
    subsection: ['\\subsection{', '}\n'],
    subsubsection: ['\\subsubsection{', '}\n'],
    paragraph: ['\\paragraph{', '}\n'],
    subparagraph: ['\\subparagraph{', '}\n'],
    title: ['\\title{', '}\n'],
    chapter: ['\\chapter{', '}\n'],
    itemize: ['\\begin{itemize}\n  \\item ', '\n\\end{itemize}'],
    enumerate: ['\\begin{enumerate}\n  \\item ', '\n\\end{enumerate}'],
    quote: ['\\begin{quote}\n', '\n\\end{quote}'],
    codeBlock: ['\\begin{verbatim}\n', '\n\\end{verbatim}'],
    link: ['\\href{https://}{', '}'],
    table: [
      '\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{|c|c|}\n    \\hline\n    A & B \\\\\n    \\hline\n    1 & 2 \\\\\n    \\hline\n  \\end{tabular}\n  \\caption{Caption}\n  \\label{tab:my_label}\n\\end{table}',
      '',
    ],
    figure: [
      '\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{filename}\n  \\caption{Caption}\n  \\label{fig:my_label}\n\\end{figure}',
      '',
    ],
    cite: ['\\cite{', '}'],
    ref: ['\\ref{', '}'],
    align: ['\\begin{align}\n  ', '\n\\end{align}'],
  };

  private static readonly TOGGLEABLE_INLINE_FORMATS: ReadonlySet<LatexFormatType> = new Set([
    'bold',
    'italic',
    'underline',
    'code',
    'strikethrough',
  ]);

  private static readonly HEADING_FORMATS: ReadonlySet<LatexFormatType> = new Set([
    'title',
    'chapter',
    'section',
    'subsection',
    'subsubsection',
    'paragraph',
    'subparagraph',
  ]);

  private static readonly HEADING_CMD_RE =
    /\\(?:title|chapter|(?:sub){0,2}section|(?:sub)?paragraph)\*?\{([^}]*)\}/g;

  private static stripHeadingCommands(sourceText: string): string {
    const startRe = /\\(?:title|chapter|(?:sub){0,2}section|(?:sub)?paragraph)\*?\{/g;
    let current = sourceText;
    // Iterate so stacked commands (e.g. `\subsection{\section{Foo}}`) unwrap completely
    for (let pass = 0; pass < 4; pass++) {
      startRe.lastIndex = 0;
      const match = startRe.exec(current);
      if (!match) break;

      let out = '';
      let cursor = 0;
      startRe.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = startRe.exec(current)) !== null) {
        out += current.slice(cursor, m.index);
        const contentStart = m.index + m[0].length;
        let depth = 1;
        let i = contentStart;
        while (i < current.length && depth > 0) {
          if (current[i] === '{') depth++;
          else if (current[i] === '}') depth--;
          if (depth > 0) i++;
        }
        if (depth === 0) {
          out += current.slice(contentStart, i);
          cursor = i + 1;
          startRe.lastIndex = cursor;
        } else {
          out += current.slice(m.index);
          cursor = current.length;
          break;
        }
      }
      out += current.slice(cursor);
      const next = out.replace(CodeMirrorEngineAdapter.HEADING_CMD_RE, '$1');
      if (next === current) break;
      current = next;
    }
    return current;
  }

  private findEnclosingInlineCommand(
    prefix: string,
    suffix: string,
    from: number,
    to: number,
  ): { start: number; end: number; contentStart: number; contentEnd: number } | null {
    const doc = this.view.state.doc;
    const fromLine = doc.lineAt(from);
    const toLine = doc.lineAt(to);
    if (fromLine.number !== toLine.number || !suffix.endsWith('}')) return null;

    const lineText = fromLine.text;
    const localFrom = from - fromLine.from;
    const localTo = to - fromLine.from;
    let searchFrom = 0;

    while (searchFrom <= localFrom) {
      const idx = lineText.indexOf(prefix, searchFrom);
      if (idx === -1 || idx + prefix.length > localFrom) break;

      const contentStart = idx + prefix.length;
      let depth = 1;
      let i = contentStart;
      while (i < lineText.length && depth > 0) {
        if (lineText[i] === '{') depth++;
        else if (lineText[i] === '}') depth--;
        if (depth > 0) i++;
      }

      if (depth === 0 && i >= localTo && lineText.slice(i, i + suffix.length) === suffix) {
        return {
          start: fromLine.from + idx,
          end: fromLine.from + i + suffix.length,
          contentStart: fromLine.from + contentStart,
          contentEnd: fromLine.from + i,
        };
      }
      searchFrom = idx + prefix.length;
    }

    return null;
  }

  isReadOnly(): boolean {
    return Boolean(this.view.state?.readOnly);
  }

  format(type: LatexFormatType): void {
    if (this.view.state.readOnly) return;
    if (type === 'normal') {
      const { from, to } = this.view.state.selection.main;
      const hasSelection = from !== to;
      const range = hasSelection ? { from, to } : this.view.state.doc.lineAt(from);
      const sourceText = hasSelection
        ? this.view.state.sliceDoc(from, to)
        : (range as { text: string }).text;
      const unformatted = CodeMirrorEngineAdapter.stripHeadingCommands(sourceText);
      if (hasSelection || unformatted !== sourceText) {
        this.view.dispatch({
          changes: { from: range.from, to: range.to, insert: unformatted },
        });
      }
      return;
    }

    const spec = CodeMirrorEngineAdapter.LATEX_WRAP_FORMAT_SPECS[type];

    if (CodeMirrorEngineAdapter.TOGGLEABLE_INLINE_FORMATS.has(type) && spec) {
      const [prefix, suffix] = spec;
      const { from, to } = this.view.state.selection.main;
      const selected = this.view.state.sliceDoc(from, to);

      // Case 1: Selection itself includes the wrapper (e.g. `\textbf{foo}`)
      if (
        selected.startsWith(prefix) &&
        selected.endsWith(suffix) &&
        selected.length >= prefix.length + suffix.length
      ) {
        const inner = selected.slice(prefix.length, selected.length - suffix.length);
        this.view.dispatch({
          changes: { from, to, insert: inner },
          selection: EditorSelection.range(from, from + inner.length),
        });
        return;
      }

      // Case 2: Wrapper immediately surrounds selection/cursor (e.g. `\textbf{|foo|}`)
      const docLen = this.view.state.doc.length;
      if (
        from >= prefix.length &&
        to + suffix.length <= docLen &&
        this.view.state.sliceDoc(from - prefix.length, from) === prefix &&
        this.view.state.sliceDoc(to, to + suffix.length) === suffix
      ) {
        const unwrapFrom = from - prefix.length;
        const unwrapTo = to + suffix.length;
        this.view.dispatch({
          changes: { from: unwrapFrom, to: unwrapTo, insert: selected },
          selection:
            from === to
              ? EditorSelection.cursor(unwrapFrom)
              : EditorSelection.range(unwrapFrom, unwrapFrom + selected.length),
        });
        return;
      }

      // Case 3: Cursor or inner selection sits inside an enclosing command on the same line
      const enclosing = this.findEnclosingInlineCommand(prefix, suffix, from, to);
      if (enclosing) {
        const inner = this.view.state.sliceDoc(enclosing.contentStart, enclosing.contentEnd);
        const relFrom = from - enclosing.contentStart;
        const relTo = to - enclosing.contentStart;
        const newFrom = enclosing.start + relFrom;
        const newTo = enclosing.start + relTo;
        this.view.dispatch({
          changes: { from: enclosing.start, to: enclosing.end, insert: inner },
          selection:
            from === to
              ? EditorSelection.cursor(newFrom)
              : EditorSelection.range(newFrom, newTo),
        });
        return;
      }

      // Otherwise wrap (keep selection if non-empty so repeated toggle unwraps cleanly)
      const replacement = `${prefix}${selected}${suffix}`;
      this.view.dispatch({
        changes: { from, to, insert: replacement },
        selection:
          from === to
            ? EditorSelection.cursor(from + prefix.length)
            : EditorSelection.range(from + prefix.length, from + prefix.length + selected.length),
      });
      return;
    }

    if (CodeMirrorEngineAdapter.HEADING_FORMATS.has(type) && spec) {
      const [prefix, suffix] = spec;
      const { from, to } = this.view.state.selection.main;
      const cleanSuffix = suffix.trimEnd();

      if (from !== to) {
        const selected = this.view.state.sliceDoc(from, to);
        const stripped = CodeMirrorEngineAdapter.stripHeadingCommands(selected).trim();
        const replacement = `${prefix}${stripped}${cleanSuffix}`;
        this.view.dispatch({
          changes: { from, to, insert: replacement },
          selection: EditorSelection.cursor(from + prefix.length + stripped.length),
        });
      } else {
        const lineObj = this.view.state.doc.lineAt(from);
        const leadingWs = lineObj.text.match(/^(\s*)/)?.[1] ?? '';
        const body = lineObj.text.slice(leadingWs.length);
        const stripped = CodeMirrorEngineAdapter.stripHeadingCommands(body).trim();
        const replacement = `${leadingWs}${prefix}${stripped}${cleanSuffix}`;
        this.view.dispatch({
          changes: { from: lineObj.from, to: lineObj.to, insert: replacement },
          selection: EditorSelection.cursor(
            lineObj.from + leadingWs.length + prefix.length + stripped.length,
          ),
        });
      }
      return;
    }

    if (spec) {
      this.wrapSelection(spec[0], spec[1]);
      return;
    }

    this.wrapSelection(`\\${type}{`, '}');
  }
  jumpToLine(line: number, highlight?: 'error' | 'synctex', column?: number, length?: number): void {
    const totalLines = this.view.state.doc.lines;
    const targetLineNum = Math.max(1, Math.min(line, totalLines));
    const lineObj = this.view.state.doc.line(targetLineNum);

    let fromPos = column !== undefined ? Math.min(lineObj.to, lineObj.from + Math.max(0, column)) : lineObj.from;
    let toPos = length !== undefined ? Math.min(lineObj.to, fromPos + Math.max(0, length)) : fromPos;

    if (highlight === 'synctex' && length === undefined) {
      const localOffset = fromPos - lineObj.from;
      const slice = lineObj.text.slice(localOffset);
      const leadingWs = slice.match(/^\s*/)?.[0].length ?? 0;
      const wordStart = localOffset + leadingWs;
      fromPos = lineObj.from + wordStart;
      toPos = fromPos;
    }

    const effects: StateEffect<unknown>[] = [
      EditorView.scrollIntoView(fromPos, { y: 'center' }),
    ];

    if (highlight === 'error' || highlight === 'synctex') {
      effects.push(highlightLineEffect.of({ line: targetLineNum, type: highlight }));
      setTimeout(() => {
        try {
          if (this.view?.dom?.parentNode) {
            this.view.dispatch({ effects: [clearHighlightEffect.of()] });
          }
        } catch {}
      }, 2200);
    }

    this.view.dispatch({
      selection: EditorSelection.single(fromPos, toPos),
      effects,
    });
    this.view.focus();
  }

  scrollToLine(line: number, smooth: boolean = true): void {
    const totalLines = this.view.state.doc.lines;
    const targetLineNum = Math.max(1, Math.min(line, totalLines));
    const lineObj = this.view.state.doc.line(targetLineNum);
    const block = this.view.lineBlockAt(lineObj.from);
    if (this.view.scrollDOM) {
      this.view.scrollDOM.scrollTo({
        top: Math.max(0, block.top - 30),
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }

  getVisibleLine(): number {
    if (!this.view.scrollDOM) return 1;
    const block = this.view.lineBlockAtHeight(this.view.scrollDOM.scrollTop + 40);
    return this.view.state.doc.lineAt(block.from).number;
  }

  getScrollContainer(): HTMLElement | null {
    return this.view.scrollDOM || null;
  }

  undo(): void {
    undo(this.view);
  }

  redo(): void {
    redo(this.view);
  }

  focus(): void {
    this.view.focus();
  }

  getCursorPosition(): { line: number; column: number } | null {
    if (!this.view.state) return null;
    const head = this.view.state.selection.main.head;
    const line = this.view.state.doc.lineAt(head);
    return {
      line: line.number,
      column: head - line.from + 1,
    };
  }

  getView(): EditorView {
    return this.view;
  }

  selectAll(): void {
    selectAll(this.view);
  }

  openFind(): void {
    if (searchPanelOpen(this.view.state)) {
      closeSearchPanel(this.view);
    } else {
      openSearchPanel(this.view);
    }
  }

  setSearchQuery(spec: {
    search: string;
    replace?: string;
    caseSensitive?: boolean;
    regexp?: boolean;
    wholeWord?: boolean;
  }): void {
    if (!this.view.state) return;
    const query = new SearchQuery({
      search: spec.search,
      replace: spec.replace || '',
      caseSensitive: Boolean(spec.caseSensitive),
      regexp: Boolean(spec.regexp),
      wholeWord: Boolean(spec.wholeWord),
    });
    this.view.dispatch({
      effects: setSearchQuery.of(query),
    });
  }

  findNext(): boolean {
    return findNext(this.view);
  }

  findPrevious(): boolean {
    return findPrevious(this.view);
  }

  replaceNext(): boolean {
    return replaceNext(this.view);
  }

  replaceAll(): boolean {
    return replaceAll(this.view);
  }

  clearSearch(): void {
    if (!this.view.state) return;
    this.view.dispatch({
      effects: setSearchQuery.of(new SearchQuery({ search: '' })),
    });
  }

  getSearchMatchesCount(spec: {
    search: string;
    caseSensitive?: boolean;
    regexp?: boolean;
    wholeWord?: boolean;
  }): { current: number; total: number } {
    if (!spec.search || !this.view.state) return { current: 0, total: 0 };
    try {
      const query = new SearchQuery({
        search: spec.search,
        caseSensitive: Boolean(spec.caseSensitive),
        regexp: Boolean(spec.regexp),
        wholeWord: Boolean(spec.wholeWord),
      });
      if (!query.valid) return { current: 0, total: 0 };

      let total = 0;
      let current = 0;
      const cursor = query.getCursor(this.view.state.doc);
      const selFrom = this.view.state.selection.main.from;

      let item = cursor.next();
      while (!item.done) {
        total++;
        if (item.value.from <= selFrom) {
          current = total;
        }
        item = cursor.next();
      }
      return { current: current || (total > 0 ? 1 : 0), total };
    } catch {
      return { current: 0, total: 0 };
    }
  }

  indent(): void {
    indentMore(this.view);
  }

  outdent(): void {
    indentLess(this.view);
  }

  toggleComment(): void {
    if (!this.view.state) return;
    toggleComment(this.view);
    this.view.focus();
  }

  onContentChange(handler: (content: string) => void): () => void {
    this.contentListeners.add(handler);
    return () => {
      this.contentListeners.delete(handler);
    };
  }

  onCursorChange(handler: (line: number, col: number) => void): () => void {
    this.cursorListeners.add(handler);
    return () => {
      this.cursorListeners.delete(handler);
    };
  }

  onDestroy(): void {
    if (this.cursorRafId !== null) {
      cancelAnimationFrame(this.cursorRafId);
      this.cursorRafId = null;
    }
    this.contentListeners.clear();
    this.cursorListeners.clear();
  }
}
