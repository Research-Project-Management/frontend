'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import {
  Sigma,
  Table as TableIcon,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { latexToHtml, htmlToLatex, renderMathHtml } from '@/features/editor/utils/latex-converter.util';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { cn } from '@/shared/lib/utils';

/**
 * Custom TipTap Table extension preserving LaTeX caption, label, and column alignment attributes.
 */
const CustomTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-caption'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.caption) return {};
          return { 'data-caption': attributes.caption };
        },
      },
      label: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-label'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.label) return {};
          return { 'data-label': attributes.label };
        },
      },
      align: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-align'),
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.align) return {};
          return { 'data-align': attributes.align };
        },
      },
    };
  },
});

export interface VisualEditorProps {
  value: string;
  onChange: (latexValue: string) => void;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  onSwitchToCode?: () => void;
}

export default function VisualEditor({
  value,
  onChange,
  theme = 'light',
  readOnly = false,
  onSwitchToCode,
}: VisualEditorProps) {
  const originalLatexRef = useRef<string>(value);
  const isInternalUpdateRef = useRef(false);
  const [mathModalOpen, setMathModalOpen] = useState(false);
  const [mathFormula, setMathFormula] = useState('');
  const [isDisplayMath, setIsDisplayMath] = useState(true);
  const [isTableActive, setIsTableActive] = useState(false);

  const initialHtml = React.useMemo(() => {
    return latexToHtml(value);
  }, []); // Only compute on mount

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing your research manuscript visually...',
      }),
      CustomTable.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'flux-table',
        },
      }),
      TableRow.configure({
        HTMLAttributes: {
          class: 'flux-table-row',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'flux-table-header',
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: 'flux-table-cell',
        },
      }),
    ],
    content: initialHtml,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[500px] px-8 py-6',
          'prose-h1:text-2xl prose-h1:font-bold prose-h1:border-b prose-h1:pb-2 prose-h1:mb-4',
          'prose-h2:text-xl prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3',
          'prose-h3:text-lg prose-h3:font-medium prose-h3:mt-4 prose-h3:mb-2',
          'prose-p:leading-relaxed prose-p:my-2',
          'prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-sm',
          theme === 'dark' ? 'text-slate-100' : 'text-slate-900',
        ),
      },
    },
    onSelectionUpdate: ({ editor: ed }) => {
      setIsTableActive(ed.isActive('table'));
    },
    onUpdate: ({ editor: ed }) => {
      setIsTableActive(ed.isActive('table'));
      isInternalUpdateRef.current = true;
      const html = ed.getHTML();
      const updatedLatex = htmlToLatex(html, originalLatexRef.current);
      originalLatexRef.current = updatedLatex;
      onChange(updatedLatex);
    },
  });

  // Synchronize when external LaTeX content changes drastically (e.g. file switch)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }
    if (editor && value !== originalLatexRef.current) {
      originalLatexRef.current = value;
      const html = latexToHtml(value);
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [value, editor]);

  // Synchronize editable state whenever readOnly prop changes dynamically
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Listen for toolbar commands dispatched from the unified Format.tsx toolbar
  useEffect(() => {
    if (!editor) return;

    const unsubCommand = EditorEventBus.on('flux:visual-command', (event) => {
      if (editor.isDestroyed || readOnly) return;
      const { command, level } = event;
      switch (command) {
        case 'undo':
          editor.chain().focus().undo().run();
          break;
        case 'redo':
          editor.chain().focus().redo().run();
          break;
        case 'bold':
          editor.chain().focus().toggleBold().run();
          break;
        case 'italic':
          editor.chain().focus().toggleItalic().run();
          break;
        case 'strike':
          editor.chain().focus().toggleStrike().run();
          break;
        case 'code':
          editor.chain().focus().toggleCode().run();
          break;
        case 'heading':
          editor.chain().focus().toggleHeading({ level: level ?? 1 }).run();
          break;
        case 'bulletList':
          editor.chain().focus().toggleBulletList().run();
          break;
        case 'orderedList':
          editor.chain().focus().toggleOrderedList().run();
          break;
        case 'blockquote':
          editor.chain().focus().toggleBlockquote().run();
          break;
        case 'insertMath':
          setMathModalOpen(true);
          break;
        case 'insertTable':
          if (event.contentHtml) {
            editor.chain().focus().insertContent(event.contentHtml).run();
          } else {
            editor
              .chain()
              .focus()
              .insertTable({
                rows: event.rows || 3,
                cols: event.cols || 3,
                withHeaderRow: event.withHeaderRow !== false,
              })
              .run();
          }
          break;
        case 'addColumnBefore':
          editor.chain().focus().addColumnBefore().run();
          break;
        case 'addColumnAfter':
          editor.chain().focus().addColumnAfter().run();
          break;
        case 'deleteColumn':
          editor.chain().focus().deleteColumn().run();
          break;
        case 'addRowBefore':
          editor.chain().focus().addRowBefore().run();
          break;
        case 'addRowAfter':
          editor.chain().focus().addRowAfter().run();
          break;
        case 'deleteRow':
          editor.chain().focus().deleteRow().run();
          break;
        case 'deleteTable':
          editor.chain().focus().deleteTable().run();
          break;
        case 'toggleHeaderRow':
          editor.chain().focus().toggleHeaderRow().run();
          break;
      }
    });

    const unsubCitation = EditorEventBus.on('flux:insert-citation', ({ bibKey }) => {
      if (editor.isDestroyed || readOnly) return;
      editor.chain().focus().insertContent(`\\cite{${bibKey}} `).run();
    });

    return () => {
      unsubCommand();
      unsubCitation();
    };
  }, [editor, readOnly]);

  const insertMathFormula = () => {
    if (!editor || !mathFormula.trim()) return;

    const clean = mathFormula.trim();
    const rendered = renderMathHtml(clean, isDisplayMath);

    if (isDisplayMath) {
      editor
        .chain()
        .focus()
        .insertContent(
          `<div class="latex-math-block my-4 p-3 bg-muted/40 rounded border border-border/60 text-center" data-math="${encodeURIComponent(clean)}">${rendered}</div><p></p>`,
        )
        .run();
    } else {
      editor
        .chain()
        .focus()
        .insertContent(
          `<span class="latex-math-inline px-1 py-0.5 bg-muted/30 rounded inline-block" data-math="${encodeURIComponent(clean)}">${rendered}</span>`,
        )
        .run();
    }

    setMathFormula('');
    setMathModalOpen(false);
  };

  if (!editor) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
        Loading Visual Editor...
      </div>
    );
  }

  return (
    <div className={cn('h-full w-full flex flex-col bg-background', theme === 'dark' ? 'dark' : '')}>
      {/* ── LaTeX Source Fidelity Banner (Overleaf Parity) ── */}
      <div className="flex items-center justify-between px-3 py-1 bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-100 uppercase tracking-wide">
            Visual Mode (Beta)
          </span>
          <span className="text-[11px] text-amber-900/90 dark:text-amber-200/90">
            Rich-text mode simplifies formatting. Switch to <strong>Source</strong> mode for 100% LaTeX source code control (Ctrl+Shift+V).
          </span>
        </div>
        {onSwitchToCode && (
          <button
            type="button"
            onClick={onSwitchToCode}
            className="ml-3 px-2 py-0.5 text-11 font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 rounded transition-colors cursor-pointer shrink-0"
          >
            Switch to Source
          </button>
        )}
      </div>

      {/* ── Scrollable Document Surface ── */}
      <div className="flex-1 w-full overflow-y-auto relative">
        {/* ── Contextual Table Floating Toolbar (Overleaf WYSIWYG) ── */}
        {isTableActive && !readOnly && (
          <div className="sticky top-3 z-30 mx-auto w-fit flex items-center gap-1 px-3 py-1.5 bg-background/95 dark:bg-[#1b222c]/95 backdrop-blur-md border border-primary/40 rounded-lg shadow-raised-200 text-xs animate-in fade-in slide-in-from-top-2 duration-150 select-none">
            <div className="flex items-center gap-1.5 text-primary font-semibold pr-2.5 border-r border-border">
              <TableIcon className="size-3.5" />
              <span className="text-[11px] tracking-wide uppercase">Table</span>
            </div>

            {/* Column operations */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Insert Column to the Left"
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                className="px-1.5 py-1 rounded hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center gap-0.5 text-[11px]"
              >
                <ArrowLeft className="size-3" />
                <span>Col</span>
              </button>
              <button
                type="button"
                title="Insert Column to the Right"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                className="px-1.5 py-1 rounded hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center gap-0.5 text-[11px]"
              >
                <span>Col</span>
                <ArrowRight className="size-3" />
              </button>
              <button
                type="button"
                title="Delete Current Column"
                onClick={() => editor.chain().focus().deleteColumn().run()}
                className="px-1.5 py-1 rounded hover:bg-destructive/10 active:scale-95 text-muted-foreground hover:text-destructive transition-all cursor-pointer flex items-center gap-0.5 text-[11px]"
              >
                <Trash2 className="size-3" />
                <span>Col</span>
              </button>
            </div>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Row operations */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Insert Row Above"
                onClick={() => editor.chain().focus().addRowBefore().run()}
                className="px-1.5 py-1 rounded hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center gap-0.5 text-[11px]"
              >
                <ArrowUp className="size-3" />
                <span>Row</span>
              </button>
              <button
                type="button"
                title="Insert Row Below"
                onClick={() => editor.chain().focus().addRowAfter().run()}
                className="px-1.5 py-1 rounded hover:bg-muted active:scale-95 text-muted-foreground hover:text-foreground transition-all cursor-pointer flex items-center gap-0.5 text-[11px]"
              >
                <ArrowDown className="size-3" />
                <span>Row</span>
              </button>
              <button
                type="button"
                title="Delete Current Row"
                onClick={() => editor.chain().focus().deleteRow().run()}
                className="px-1.5 py-1 rounded hover:bg-destructive/10 active:scale-95 text-muted-foreground hover:text-destructive transition-all cursor-pointer flex items-center gap-0.5 text-[11px]"
              >
                <Trash2 className="size-3" />
                <span>Row</span>
              </button>
            </div>

            <div className="h-4 w-px bg-border mx-1" />

            {/* Header & Delete operations */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Toggle Header Row"
                onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                className="px-2 py-1 rounded hover:bg-muted active:scale-95 text-foreground/80 hover:text-foreground font-medium text-[11px] transition-all cursor-pointer"
              >
                Toggle Header
              </button>
              <button
                type="button"
                title="Delete Table"
                onClick={() => editor.chain().focus().deleteTable().run()}
                className="px-2 py-1 rounded bg-destructive/10 hover:bg-destructive/20 active:scale-95 text-destructive font-medium text-[11px] transition-all cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="size-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto my-6 bg-card rounded-lg border border-border shadow-subtle-100 min-h-[700px]">
          <EditorContent editor={editor} />
        </div>

        {/* ── Table Styling Stylesheet ── */}
        <style>{`
          .tiptap table {
            border-collapse: collapse;
            margin: 1.5rem 0;
            overflow: hidden;
            table-layout: fixed;
            width: 100%;
          }
          .tiptap table td,
          .tiptap table th {
            border: 1px solid var(--border, rgba(148, 163, 184, 0.3));
            box-sizing: border-box;
            min-width: 80px;
            padding: 8px 12px;
            position: relative;
            vertical-align: top;
          }
          .tiptap table th {
            background-color: rgba(148, 163, 184, 0.15);
            font-weight: 600;
            text-align: left;
          }
          .tiptap table .selectedCell:after {
            background: rgba(59, 130, 246, 0.15);
            content: "";
            left: 0; right: 0; top: 0; bottom: 0;
            pointer-events: none;
            position: absolute;
            z-index: 2;
          }
          .tiptap table .column-resize-handle {
            background-color: #3b82f6;
            bottom: -2px;
            pointer-events: none;
            position: absolute;
            right: -2px;
            top: 0;
            width: 4px;
          }
          .tiptap .tableWrapper {
            overflow-x: auto;
            margin: 1.5rem 0;
          }
        `}</style>
      </div>

      {/* ── Insert Math Modal ── */}
      {mathModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 space-y-4 shadow-raised-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Sigma className="size-4 text-primary" />
                <span>Insert LaTeX Formula (KaTeX)</span>
              </h3>
              <button
                type="button"
                onClick={() => setMathModalOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">LaTeX Expression</label>
              <textarea
                value={mathFormula}
                onChange={(e) => setMathFormula(e.target.value)}
                placeholder="e.g. \int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
                className="w-full h-24 rounded border border-input bg-background p-2 text-xs font-mono outline-none focus:ring-1 focus:ring-primary resize-none"
                autoFocus
              />
            </div>

            {/* Live KaTeX Preview */}
            {mathFormula.trim() && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Live KaTeX Preview</span>
                <div
                  className="p-3 rounded bg-muted/40 border border-border text-center overflow-x-auto"
                  dangerouslySetInnerHTML={{
                    __html: renderMathHtml(mathFormula, isDisplayMath),
                  }}
                />
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDisplayMath}
                  onChange={(e) => setIsDisplayMath(e.target.checked)}
                  className="rounded"
                />
                <span>Display block mode (centered)</span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMathModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={insertMathFormula}
                  disabled={!mathFormula.trim()}
                  className="px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40"
                >
                  Insert Formula
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
