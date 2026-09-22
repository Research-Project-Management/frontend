/**
 * codemirror.adapter.ts
 *
 * Concrete Adapter: Implements IEditorEngine for the unified CodeMirror 6 Editor.
 * Translates IEditorEngine commands into CodeMirror 6 State Transactions.
 */

import { EditorView } from '@codemirror/view';
import { EditorSelection, StateEffect } from '@codemirror/state';
import { undo, redo, selectAll, indentMore, indentLess } from '@codemirror/commands';
import { openSearchPanel } from '@codemirror/search';
import type {
  IEditorEngine,
  EditorSelectionRange,
  LatexFormatType,
} from '../../ports/editor-engine.port';

// Effect to trigger line flash/highlight for SyncTeX or compiler errors
export const highlightLineEffect = StateEffect.define<{ line: number; type: 'synctex' | 'error' }>();

export class CodeMirrorEngineAdapter implements IEditorEngine {
  private view: EditorView;
  private contentListeners = new Set<(content: string) => void>();
  private cursorListeners = new Set<(line: number, col: number) => void>();

  constructor(view: EditorView) {
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

    if (update.selectionSet || update.docChanged) {
      const pos = this.getCursorPosition();
      if (pos) {
        for (const listener of this.cursorListeners) {
          listener(pos.line, pos.column);
        }
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

  wrapSelection(prefix: string, suffix: string, placeholder = ''): void {
    const { from, to } = this.view.state.selection.main;
    const selected = this.view.state.sliceDoc(from, to) || placeholder;
    const replacement = `${prefix}${selected}${suffix}`;

    this.view.dispatch({
      changes: { from, to, insert: replacement },
      selection: EditorSelection.cursor(from + prefix.length + selected.length),
    });
  }

  format(type: LatexFormatType): void {
    switch (type) {
      case 'bold':
        this.wrapSelection('\\textbf{', '}');
        break;
      case 'italic':
        this.wrapSelection('\\textit{', '}');
        break;
      case 'underline':
        this.wrapSelection('\\underline{', '}');
        break;
      case 'inlineMath':
        this.wrapSelection('$', '$');
        break;
      case 'displayMath':
        this.wrapSelection('$$\n', '\n$$');
        break;
      case 'equation':
        this.wrapSelection('\\begin{equation}\n  ', '\n\\end{equation}');
        break;
      case 'code':
        this.wrapSelection('\\texttt{', '}');
        break;
      case 'strikethrough':
        this.wrapSelection('\\sout{', '}');
        break;
      case 'superscript':
        this.wrapSelection('^{', '}');
        break;
      case 'subscript':
        this.wrapSelection('_{', '}');
        break;
      case 'section':
        this.wrapSelection('\\section{', '}\n');
        break;
      case 'subsection':
        this.wrapSelection('\\subsection{', '}\n');
        break;
      case 'subsubsection':
        this.wrapSelection('\\subsubsection{', '}\n');
        break;
      case 'itemize':
        this.wrapSelection('\\begin{itemize}\n  \\item ', '\n\\end{itemize}');
        break;
      case 'enumerate':
        this.wrapSelection('\\begin{enumerate}\n  \\item ', '\n\\end{enumerate}');
        break;
      case 'table':
        this.wrapSelection(
          '\\begin{table}[h]\n  \\centering\n  \\begin{tabular}{|c|c|}\n    \\hline\n    A & B \\\\\n    \\hline\n    1 & 2 \\\\\n    \\hline\n  \\end{tabular}\n  \\caption{Caption}\n  \\label{tab:my_label}\n\\end{table}',
          ''
        );
        break;
      case 'figure':
        this.wrapSelection(
          '\\begin{figure}[h]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{filename}\n  \\caption{Caption}\n  \\label{fig:my_label}\n\\end{figure}',
          ''
        );
        break;
      case 'cite':
        this.wrapSelection('\\cite{', '}');
        break;
      case 'ref':
        this.wrapSelection('\\ref{', '}');
        break;
      case 'align':
        this.wrapSelection('\\begin{align}\n  ', '\n\\end{align}');
        break;
      default:
        this.wrapSelection(`\\${type}{`, '}');
    }
  }

  jumpToLine(line: number, highlight?: 'error' | 'synctex'): void {
    const totalLines = this.view.state.doc.lines;
    const targetLineNum = Math.max(1, Math.min(line, totalLines));
    const lineObj = this.view.state.doc.line(targetLineNum);

    const effects: StateEffect<any>[] = [
      EditorView.scrollIntoView(lineObj.from, { y: 'center' }),
    ];

    if (highlight) {
      effects.push(highlightLineEffect.of({ line: targetLineNum, type: highlight }));
    }

    this.view.dispatch({
      selection: EditorSelection.cursor(lineObj.from),
      effects,
    });
    this.view.focus();
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

  selectAll(): void {
    selectAll(this.view);
  }

  openFind(): void {
    openSearchPanel(this.view);
  }

  indent(): void {
    indentMore(this.view);
  }

  outdent(): void {
    indentLess(this.view);
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
    this.contentListeners.clear();
    this.cursorListeners.clear();
  }
}
