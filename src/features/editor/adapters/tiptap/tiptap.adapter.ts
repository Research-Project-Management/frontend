/**
 * tiptap.adapter.ts
 *
 * Concrete Adapter: Implements IEditorEngine for TipTap Visual Editor.
 * Translates IEditorEngine commands into TipTap transactions.
 */

import type { Editor as TipTapEditor } from '@tiptap/react';
import type {
  IEditorEngine,
  EditorSelectionRange,
  LatexFormatType,
} from '../../ports/editor-engine.port';
import { htmlToLatex, latexToHtml } from '../../utils/latex-converter.util';

export class TipTapEngineAdapter implements IEditorEngine {
  private editor: TipTapEditor;
  private contentListeners = new Set<(content: string) => void>();
  private cursorListeners = new Set<(line: number, col: number) => void>();

  constructor(editor: TipTapEditor) {
    this.editor = editor;

    this.editor.on('update', () => {
      const latex = this.getContent();
      for (const listener of this.contentListeners) {
        listener(latex);
      }
    });

    this.editor.on('selectionUpdate', () => {
      // Approximate line 1 for visual editor
      for (const listener of this.cursorListeners) {
        listener(1, 1);
      }
    });
  }

  getContent(): string {
    const html = this.editor.getHTML();
    return htmlToLatex(html);
  }

  setContent(content: string): void {
    const html = latexToHtml(content);
    this.editor.commands.setContent(html);
  }

  getSelection(): EditorSelectionRange | null {
    const { from, to } = this.editor.state.selection;
    return {
      startLine: 1,
      startColumn: from,
      endLine: 1,
      endColumn: to,
    };
  }

  getSelectedText(): string {
    const { from, to } = this.editor.state.selection;
    return this.editor.state.doc.textBetween(from, to, ' ');
  }

  insertText(text: string): void {
    this.editor.commands.insertContent(text);
  }

  wrapSelection(prefix: string, suffix: string, placeholder = ''): void {
    const selected = this.getSelectedText() || placeholder;
    this.editor.commands.insertContent(`${prefix}${selected}${suffix}`);
  }

  format(type: LatexFormatType): void {
    switch (type) {
      case 'bold':
        this.editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        this.editor.chain().focus().toggleItalic().run();
        break;
      case 'strikethrough':
        this.editor.chain().focus().toggleStrike().run();
        break;
      case 'code':
        this.editor.chain().focus().toggleCode().run();
        break;
      case 'itemize':
        this.editor.chain().focus().toggleBulletList().run();
        break;
      case 'enumerate':
        this.editor.chain().focus().toggleOrderedList().run();
        break;
      default:
        this.wrapSelection(`\\${type}{`, '}');
    }
  }

  jumpToLine(_line: number, _highlight?: 'error' | 'synctex'): void {
    // TipTap visual representation scroll
    this.editor.commands.focus('start');
  }

  undo(): void {
    this.editor.chain().focus().undo().run();
  }

  redo(): void {
    this.editor.chain().focus().redo().run();
  }

  focus(): void {
    this.editor.commands.focus();
  }

  getCursorPosition(): { line: number; column: number } | null {
    // In rich-text mode, line-based cursor position is not directly applicable
    return null;
  }

  selectAll(): void {
    this.editor.commands.selectAll();
  }

  openFind(): void {
    // No-op in visual mode or integrate with TipTap search
  }

  indent(): void {
    // No-op in visual mode
  }

  outdent(): void {
    // No-op in visual mode
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
