/**
 * EditorToolbar.tsx
 *
 * Scoped Format Toolbar for LaTeX Editor (Block 4: UI Features Layer).
 * Location: `features/editor/ui/features/editor/EditorToolbar.tsx`
 *
 * Modeled 1:1 after Overleaf Visual/Code Editor Toolbar:
 * - History group: Undo (Ctrl+Z), Redo (Ctrl+Y)
 * - Paragraph style dropdown: Normal, Title, Section, Subsection, Subsubsection, Paragraph
 * - Inline format group: Bold (Ctrl+B), Italic (Ctrl+I), Underline (Ctrl+U)
 * - Insert group: Math ($...$), Symbol (Ω), Table Wizard, Figure Wizard, Hyperlink, Citation
 * - Environment group: Bulleted list, Numbered list, Quote, Code/Verbatim
 * - Collaboration group: Add Comment (Ctrl+Alt+M)
 * - Group separators for clean visual hierarchy
 */

'use client';

import React, { useState } from 'react';
import {
  RotateCcw,
  RotateCw,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Sigma,
  Table as TableIcon,
  Image as ImageIcon,
  Shapes,
  Link2,
  BookOpen,
  List,
  ListOrdered,
  Quote,
  Code,
  MessageSquarePlus,
  Columns2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { editorCommandBus, getActiveEditorEngine } from '@/features/editor/coordinators/command-bus';
import { EditorEventBus } from '@/features/editor/domain/latex/latex-structure';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { useDocumentCollaborationStore } from '@/features/editor/store/collaboration.store';
import { useLayoutStore } from '@/features/editor/store/layout.store';
import { SourceVisualSwitcher } from './SourceVisualSwitcher';
import { cn } from '@/shared/lib/utils';

export interface EditorToolbarProps {
  className?: string;
  readOnly?: boolean;
  onSplitRight?: () => void;
}

interface StyleOption {
  id: string;
  label: string;
  latexPrefix: string;
  latexSuffix: string;
  visualCommand: string;
  visualLevel?: 1 | 2 | 3;
}

const STYLE_OPTIONS: StyleOption[] = [
  { id: 'normal', label: 'Normal', latexPrefix: '', latexSuffix: '', visualCommand: 'paragraph' },
  { id: 'title', label: 'Title', latexPrefix: '\\title{', latexSuffix: '}', visualCommand: 'heading', visualLevel: 1 },
  { id: 'section', label: 'Section', latexPrefix: '\\section{', latexSuffix: '}', visualCommand: 'heading', visualLevel: 1 },
  { id: 'subsection', label: 'Subsection', latexPrefix: '\\subsection{', latexSuffix: '}', visualCommand: 'heading', visualLevel: 2 },
  { id: 'subsubsection', label: 'Subsubsection', latexPrefix: '\\subsubsection{', latexSuffix: '}', visualCommand: 'heading', visualLevel: 3 },
  { id: 'paragraph', label: 'Paragraph', latexPrefix: '\\paragraph{', latexSuffix: '}', visualCommand: 'paragraph' },
];

function OmegaIcon({ className }: { className?: string }) {
  return (
    <span className={cn('font-serif font-semibold text-xs leading-none select-none text-center', className)}>
      Ω
    </span>
  );
}

function ToolbarSeparator() {
  return <div className="h-4 w-px bg-border/60 mx-1 shrink-0 select-none" aria-hidden="true" />;
}

export function EditorToolbar({ className, readOnly = false, onSplitRight }: EditorToolbarProps) {
  const editorMode = useSettingsStore((s) => s.editorMode);
  const [currentStyle, setCurrentStyle] = useState<string>('Normal');

  // ── History Handlers (Undo / Redo) ──
  const handleUndo = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'editor:undo' });
  };

  const handleRedo = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'editor:redo' });
  };

  // ── Paragraph Style Handler ──
  const handleSelectStyle = (option: StyleOption) => {
    if (readOnly) return;
    setCurrentStyle(option.label);

    if (editorMode === 'visual') {
      EditorEventBus.emit('flux:visual-command', {
        command: option.visualCommand,
        level: option.visualLevel,
      });
      editorCommandBus.dispatch({
        type: 'editor:visual-command',
        command: option.visualCommand,
        level: option.visualLevel,
      });
      return;
    }

    if (option.latexPrefix) {
      editorCommandBus.dispatch({
        type: 'editor:wrap-selection',
        prefix: option.latexPrefix,
        suffix: option.latexSuffix,
      });
    }
  };

  // ── Inline Format Handlers ──
  const handleInlineFormat = (format: 'bold' | 'italic' | 'underline') => {
    if (readOnly) return;

    if (editorMode === 'visual') {
      EditorEventBus.emit('flux:visual-command', { command: format });
      editorCommandBus.dispatch({ type: 'editor:visual-command', command: format });
      return;
    }

    const snippetMap = {
      bold: { prefix: '\\textbf{', suffix: '}' },
      italic: { prefix: '\\textit{', suffix: '}' },
      underline: { prefix: '\\underline{', suffix: '}' },
    };
    const s = snippetMap[format];
    editorCommandBus.dispatch({
      type: 'editor:wrap-selection',
      prefix: s.prefix,
      suffix: s.suffix,
    });
  };

  // ── Insert Handlers ──
  const handleInsertMath = () => {
    if (readOnly) return;
    if (editorMode === 'visual') {
      EditorEventBus.emit('flux:visual-command', { command: 'insertMath' });
      editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'insertMath' });
      return;
    }
    editorCommandBus.dispatch({
      type: 'editor:wrap-selection',
      prefix: '$',
      suffix: '$',
    });
  };

  const handleInsertSymbol = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'symbol-palette' });
  };

  const handleInsertTable = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' });
  };

  const handleInsertFigure = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'figure-wizard' });
  };

  const handleInsertDiagram = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'diagram-canvas' });
  };

  const handleInsertLink = () => {
    if (readOnly) return;
    if (editorMode === 'visual') {
      const url = window.prompt('Nhập URL liên kết:');
      if (url) {
        EditorEventBus.emit('flux:visual-command', { command: 'createLink', contentHtml: url });
        editorCommandBus.dispatch({ type: 'editor:visual-command', command: 'createLink', contentHtml: url });
      }
      return;
    }
    editorCommandBus.dispatch({
      type: 'editor:wrap-selection',
      prefix: '\\href{https://}{',
      suffix: '}',
    });
  };

  const handleInsertCitation = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
  };

  // ── Environment Handlers (Lists, Quote, Code) ──
  const handleInsertEnvironment = (env: 'itemize' | 'enumerate' | 'quote' | 'code') => {
    if (readOnly) return;

    if (editorMode === 'visual') {
      const visualMap: Record<string, string> = {
        itemize: 'bulletList',
        enumerate: 'orderedList',
        quote: 'quote',
        code: 'code',
      };
      const cmd = visualMap[env];
      if (cmd) {
        EditorEventBus.emit('flux:visual-command', { command: cmd });
        editorCommandBus.dispatch({ type: 'editor:visual-command', command: cmd });
        return;
      }
    }

    const snippetMap = {
      itemize: { prefix: '\\begin{itemize}\n  \\item ', suffix: '\n\\end{itemize}' },
      enumerate: { prefix: '\\begin{enumerate}\n  \\item ', suffix: '\n\\end{enumerate}' },
      quote: { prefix: '\\begin{quote}\n', suffix: '\n\\end{quote}' },
      code: { prefix: '\\begin{verbatim}\n', suffix: '\n\\end{verbatim}' },
    };
    const s = snippetMap[env];
    editorCommandBus.dispatch({
      type: 'editor:wrap-selection',
      prefix: s.prefix,
      suffix: s.suffix,
    });
  };

  // ── Comment Handler ──
  const handleAddComment = React.useCallback(() => {
    if (readOnly) return;
    const engine = getActiveEditorEngine();
    const sel = engine?.getSelection?.();
    const cursor = engine?.getCursorPosition?.();

    const startLine = sel?.startLine ?? sel?.fromLine ?? cursor?.line ?? 1;
    const endLine = sel?.endLine ?? sel?.toLine ?? cursor?.line ?? 1;
    const selectedText = engine?.getSelectedText?.() || '';

    useDocumentCollaborationStore.getState().setPendingComment({
      startLine,
      endLine,
      selectedText,
    });
    useLayoutStore.getState().setActiveSidebarTab('review');
    useLayoutStore.getState().setSidebarLeftOpen(true);
  }, [readOnly]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleAddComment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAddComment]);

  if (editorMode === 'code') {
    return (
      <div
        className={cn(
          'h-9 px-2 flex items-center justify-between border-b border-border bg-surface select-none shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none',
          className
        )}
      >
        <div className="flex items-center gap-1.5">
          <SourceVisualSwitcher />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                onClick={handleInsertSymbol}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Insert Symbol (Ω)"
              >
                <OmegaIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Insert Symbol (Ω)</span>
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                onClick={handleAddComment}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Add Comment"
              >
                <MessageSquarePlus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Add Comment</span>
              <span className="ml-1.5 opacity-60">(Mod-Alt-m)</span>
            </TooltipContent>
          </Tooltip>

          {onSplitRight && (
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSplitRight}
                  className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="Chia đôi khung soạn thảo"
                  title="Chia đôi khung soạn thảo (Split to Side)"
                >
                  <Columns2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <span>Chia đôi khung soạn thảo</span>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-9 px-2 flex items-center gap-0.5 border-b border-border bg-surface select-none shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none',
        className
      )}
    >
      {/* ── Mode Switcher (Overleaf Parity: Top-left of toolbar) ── */}
      <div className="mr-1 shrink-0">
        <SourceVisualSwitcher />
      </div>

      <ToolbarSeparator />

      {/* ── 1. History Group (Undo / Redo) ── */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleUndo}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Undo"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Undo</span>
          <span className="ml-1.5 opacity-60">(Mod-z)</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleRedo}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Redo"
          >
            <RotateCw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Redo</span>
          <span className="ml-1.5 opacity-60">(Mod-y)</span>
        </TooltipContent>
      </Tooltip>

      <ToolbarSeparator />

      {/* ── 2. Paragraph Style Dropdown ── */}
      <DropdownMenu>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                className="h-7 px-2 gap-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <span className="truncate max-w-[85px] text-[12px]">{currentStyle}</span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Paragraph style</span>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-36">
          {STYLE_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => handleSelectStyle(opt)}
              className="text-xs cursor-pointer"
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarSeparator />

      {/* ── 3. Text Formatting (Bold, Italic, Underline) ── */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => handleInlineFormat('bold')}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Bold"
          >
            <Bold className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Bold</span>
          <span className="ml-1.5 opacity-60">(Mod-b)</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => handleInlineFormat('italic')}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Italic"
          >
            <Italic className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Italic</span>
          <span className="ml-1.5 opacity-60">(Mod-i)</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => handleInlineFormat('underline')}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Underline"
          >
            <Underline className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Underline</span>
          <span className="ml-1.5 opacity-60">(Mod-u)</span>
        </TooltipContent>
      </Tooltip>

      <ToolbarSeparator />

      {/* ── 4. Insert Elements (Math, Symbol, Table, Figure, Link, Citation) ── */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleInsertMath}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Math formula"
          >
            <Sigma className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Math formula</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleInsertSymbol}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Insert Symbol (Ω)"
          >
            <OmegaIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Insert Symbol (Ω)</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleInsertTable}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Insert table"
          >
            <TableIcon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Insert table</span>
          <span className="ml-1.5 opacity-60">(Mod-Shift-t)</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleInsertFigure}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Insert figure"
          >
            <ImageIcon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Insert figure</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleInsertDiagram}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Insert TikZ diagram"
          >
            <Shapes className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Insert TikZ diagram</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleInsertLink}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Insert link"
          >
            <Link2 className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Insert link</span>
          <span className="ml-1.5 opacity-60">(Mod-k)</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleInsertCitation}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Cite reference"
          >
            <BookOpen className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Cite reference</span>
          <span className="ml-1.5 opacity-60">(Mod-Shift-k)</span>
        </TooltipContent>
      </Tooltip>

      <ToolbarSeparator />

      {/* ── 5. Lists & Environments ── */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => handleInsertEnvironment('itemize')}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Bulleted list"
          >
            <List className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Bulleted list</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => handleInsertEnvironment('enumerate')}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Numbered list"
          >
            <ListOrdered className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Numbered list</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => handleInsertEnvironment('quote')}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Quote environment"
          >
            <Quote className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Quote environment</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => handleInsertEnvironment('code')}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
            aria-label="Code block"
          >
            <Code className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Code block</span>
        </TooltipContent>
      </Tooltip>

      {/* ── 6. Collaboration & Actions (Add Comment & Split) ── */}
      <div className="ml-auto flex items-center gap-1">
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleAddComment}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
              aria-label="Add Comment"
            >
              <MessageSquarePlus className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Add Comment</span>
            <span className="ml-1.5 opacity-60">(Mod-Alt-m)</span>
          </TooltipContent>
        </Tooltip>

        {onSplitRight && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSplitRight}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Chia đôi khung soạn thảo"
                title="Chia đôi khung soạn thảo (Split to Side)"
              >
                <Columns2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Chia đôi khung soạn thảo</span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default EditorToolbar;
