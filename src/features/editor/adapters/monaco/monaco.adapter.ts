/**
 * monaco.adapter.ts
 *
 * Concrete Adapter: Implements IEditorEngine for Monaco Editor.
 * Decouples the rest of the Flux Editor from Monaco specifics.
 */

import type { editor as MonacoEditorType } from 'monaco-editor';
import type {
  IEditorEngine,
  EditorSelectionRange,
  LatexFormatType,
} from '../../ports/editor-engine.port';
import { EditorCommandBus } from '../../utils/editor.util';

export class MonacoEngineAdapter implements IEditorEngine {
  private editor: MonacoEditorType.IStandaloneCodeEditor;
  private monaco: typeof import('monaco-editor');
  private contentListeners = new Set<(content: string) => void>();
  private cursorListeners = new Set<(line: number, col: number) => void>();
  private disposables: import('monaco-editor').IDisposable[] = [];
  private currentDecorations: string[] = [];

  constructor(
    editor: MonacoEditorType.IStandaloneCodeEditor,
    monaco: typeof import('monaco-editor'),
  ) {
    this.editor = editor;
    this.monaco = monaco;

    // Listen for model content changes
    const contentSub = this.editor.onDidChangeModelContent?.(() => {
      const val = this.getContent();
      for (const listener of this.contentListeners) {
        listener(val);
      }
    });
    if (contentSub) this.disposables.push(contentSub);

    // Listen for cursor position changes
    const cursorSub = this.editor.onDidChangeCursorPosition?.((e) => {
      for (const listener of this.cursorListeners) {
        listener(e.position.lineNumber, e.position.column);
      }
    });
    if (cursorSub) this.disposables.push(cursorSub);
  }

  getContent(): string {
    return this.editor.getValue();
  }

  setContent(content: string): void {
    if (this.editor.getValue() !== content) {
      this.editor.setValue(content);
    }
  }

  getSelection(): EditorSelectionRange | null {
    const sel = this.editor.getSelection();
    if (!sel) return null;
    return {
      startLine: sel.startLineNumber,
      startColumn: sel.startColumn,
      endLine: sel.endLineNumber,
      endColumn: sel.endColumn,
    };
  }

  getSelectedText(): string {
    const sel = this.editor.getSelection();
    const model = this.editor.getModel();
    if (!sel || !model) return '';
    return model.getValueInRange(sel);
  }

  insertText(text: string): void {
    EditorCommandBus.insertSnippet(this.editor, text);
  }

  wrapSelection(prefix: string, suffix: string, placeholder = ''): void {
    EditorCommandBus.wrapSelection(this.editor, prefix, suffix, placeholder);
  }

  format(type: LatexFormatType): void {
    EditorCommandBus.format(this.editor, type);
  }

  jumpToLine(line: number, highlight?: 'error' | 'synctex'): void {
    const model = this.editor.getModel();
    if (!model || line <= 0 || line > model.getLineCount()) return;

    this.editor.revealLineInCenter(line);
    this.editor.setPosition({ lineNumber: line, column: 1 });
    this.editor.focus();

    if (highlight && this.monaco) {
      const className =
        highlight === 'error' ? 'editor-error-line-highlight' : 'editor-synctex-highlight';
      this.currentDecorations = this.editor.deltaDecorations(this.currentDecorations, [
        {
          range: new this.monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
          options: {
            isWholeLine: true,
            className,
            marginClassName: `${className}-glyph`,
          },
        },
      ]);

      // Auto clear decoration after 2.5 seconds
      setTimeout(() => {
        this.currentDecorations = this.editor.deltaDecorations(this.currentDecorations, []);
      }, 2500);
    }
  }

  undo(): void {
    this.editor.trigger('adapter', 'undo', null);
  }

  redo(): void {
    this.editor.trigger('adapter', 'redo', null);
  }

  focus(): void {
    this.editor.focus();
  }

  getCursorPosition(): { line: number; column: number } | null {
    const pos = this.editor.getPosition();
    return pos ? { line: pos.lineNumber, column: pos.column } : null;
  }

  selectAll(): void {
    const model = this.editor.getModel();
    if (model) {
      this.editor.setSelection(model.getFullModelRange());
    }
  }

  openFind(): void {
    this.editor.getAction('actions.find')?.run();
  }

  indent(): void {
    this.editor.getAction('editor.action.indentLines')?.run();
  }

  outdent(): void {
    this.editor.getAction('editor.action.outdentLines')?.run();
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
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.contentListeners.clear();
    this.cursorListeners.clear();
  }
}
