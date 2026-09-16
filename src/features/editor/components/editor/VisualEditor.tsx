'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Sigma,
  Undo,
  Redo,
} from 'lucide-react';
import { latexToHtml, htmlToLatex, renderMathHtml } from '@/features/editor/utils/latex-converter.util';
import { cn } from '@/shared/lib/utils';

export interface VisualEditorProps {
  value: string;
  onChange: (latexValue: string) => void;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
}

export default function VisualEditor({
  value,
  onChange,
  theme = 'light',
  readOnly = false,
}: VisualEditorProps) {
  const originalLatexRef = useRef<string>(value);
  const isInternalUpdateRef = useRef(false);
  const [mathModalOpen, setMathModalOpen] = useState(false);
  const [mathFormula, setMathFormula] = useState('');
  const [isDisplayMath, setIsDisplayMath] = useState(true);

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
    onUpdate: ({ editor: ed }) => {
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
      const newHtml = latexToHtml(value);
      editor.commands.setContent(newHtml);
    }
  }, [value, editor]);

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
      {/* ── Visual Editor Toolbar ── */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b border-border bg-muted/30 shrink-0 select-none">
        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer',
            editor.isActive('heading', { level: 1 }) ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Section (H1)"
        >
          <Heading1 className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer',
            editor.isActive('heading', { level: 2 }) ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Subsection (H2)"
        >
          <Heading2 className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer',
            editor.isActive('heading', { level: 3 }) ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Subsubsection (H3)"
        >
          <Heading3 className="size-4 shrink-0" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Text styling */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted transition-colors cursor-pointer',
            editor.isActive('bold') ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Bold (\textbf)"
        >
          <Bold className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted transition-colors cursor-pointer',
            editor.isActive('italic') ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Italic (\textit)"
        >
          <Italic className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted transition-colors cursor-pointer',
            editor.isActive('strike') ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Strikethrough"
        >
          <Strikethrough className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted transition-colors cursor-pointer',
            editor.isActive('code') ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Code (\texttt)"
        >
          <Code className="size-4 shrink-0" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted transition-colors cursor-pointer',
            editor.isActive('bulletList') ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Bullet List (\begin{itemize})"
        >
          <List className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted transition-colors cursor-pointer',
            editor.isActive('orderedList') ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Numbered List (\begin{enumerate})"
        >
          <ListOrdered className="size-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            'p-1.5 rounded hover:bg-muted transition-colors cursor-pointer',
            editor.isActive('blockquote') ? 'bg-primary/20 text-primary' : 'text-muted-foreground',
          )}
          title="Blockquote"
        >
          <Quote className="size-4 shrink-0" />
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* KaTeX Math insertion button */}
        <button
          type="button"
          onClick={() => setMathModalOpen(true)}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium cursor-pointer"
          title="Insert KaTeX Math Equation"
        >
          <Sigma className="size-3.5 shrink-0" />
          <span>Insert Math</span>
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors cursor-pointer"
            title="Undo"
          >
            <Undo className="size-4 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-40 transition-colors cursor-pointer"
            title="Redo"
          >
            <Redo className="size-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* ── Scrollable Document Surface ── */}
      <div className="flex-1 w-full overflow-y-auto">
        <div className="max-w-4xl mx-auto my-6 bg-card rounded-lg border border-border shadow-subtle-100 min-h-[700px]">
          <EditorContent editor={editor} />
        </div>
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
