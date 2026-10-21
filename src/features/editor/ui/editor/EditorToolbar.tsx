/**
 * EditorToolbar.tsx
 *
 * Scoped Format Toolbar for LaTeX Editor (Block 4: UI Features Layer).
 * Location: `features/editor/ui/features/editor/EditorToolbar.tsx`
 *
 * Fully dynamic responsive toolbar based on actual container width:
 * As the user resizes the split pane between Editor and PDF Preview,
 * items dynamically collapse into the "•••" (More actions) menu so they never
 * overflow or push into the PDF preview split pane!
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
  Link2,
  BookOpen,
  List,
  ListOrdered,
  Quote,
  Code,
  MessageSquarePlus,
  Search,
  Bookmark,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { SourceVisualSwitcher } from './SourceVisualSwitcher';
import { EditingModeDropdown } from '../../core/shell/topbar/EditingModeDropdown';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { editorCommandBus, useSettingsStore } from '@/features/editor/core';
import { useContainerWidth } from './useContainerWidth';
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

function ToolbarSeparator({ className }: { className?: string }) {
  return <div className={cn('h-4 w-px bg-border/60 mx-1 shrink-0 select-none', className)} aria-hidden="true" />;
}

export function EditorToolbar({ className, readOnly = false, onSplitRight }: EditorToolbarProps) {
  const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>();
  const editorMode = useSettingsStore((s) => s.editorMode);
  const [currentStyle, setCurrentStyle] = useState<string>('Normal');

  // Breakpoints based on actual container width (px)
  // Total fixed elements on ends:
  // History (Undo/Redo: ~60px) + Sep (9px) + Style Dropdown (~100px) + Sep (9px) + Bold/Italic (~60px) = ~240px
  // Right group: Comment (28px) + Search (28px) + Sep (9px) + EditingMode (~110px) + Sep (9px) + Switcher (~120px) = ~305px
  // Base fixed minimum without optional middle buttons = ~545px.
  // We use effectiveWidth (defaulting to 600 if not measured yet) and scale gracefully:
  const effectiveWidth = containerWidth > 0 ? containerWidth : 600;

  const showUnderline = effectiveWidth >= 560;
  const showMath = effectiveWidth >= 600;
  const showSymbol = effectiveWidth >= 640;
  const showLink = effectiveWidth >= 680;
  const showCrossRef = effectiveWidth >= 730;
  const showCitation = effectiveWidth >= 780;
  const showFigure = effectiveWidth >= 830;
  const showTable = effectiveWidth >= 880;
  const showLists = effectiveWidth >= 940;
  const showCodeEnvs = effectiveWidth >= 1000;
  const showComment = effectiveWidth >= 620;

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

  const handleInsertLink = () => {
    if (readOnly) return;
    if (editorMode === 'visual') {
      const url = window.prompt('Enter link URL:');
      if (url) {
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

  const handleInsertCrossRef = () => {
    if (readOnly) return;
    editorCommandBus.dispatch({
      type: 'editor:wrap-selection',
      prefix: '\\ref{',
      suffix: '}',
    });
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
    editorCommandBus.dispatch({ type: 'review:create-comment' });
  }, [readOnly]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'h-9 min-h-[36px] px-2 flex items-center gap-0.5 border-b border-border bg-surface select-none shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none w-full max-w-full',
        className
      )}
    >
      {/* ── 1. History Group (Undo / Redo) ── */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleUndo}
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
                className="h-7 px-2 gap-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
              >
                <span className="truncate max-w-[80px] text-12">{currentStyle}</span>
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
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
            className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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

      {showUnderline && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={() => handleInlineFormat('underline')}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
      )}

      {showMath && <ToolbarSeparator />}

      {/* ── 4. Insert Elements: Math & Symbol ── */}
      {showMath && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleInsertMath}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
              aria-label="Math formula"
            >
              <Sigma className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Math formula</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showSymbol && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleInsertSymbol}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
              aria-label="Insert Symbol (Ω)"
            >
              <OmegaIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Insert Symbol (Ω)</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showLink && <ToolbarSeparator />}

      {/* ── 5. Insert Objects (Dynamic container-based) ── */}
      {showLink && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleInsertLink}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
      )}

      {/* Cross-ref Button */}
      {showCrossRef && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleInsertCrossRef}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
              aria-label="Cross reference"
            >
              <Bookmark className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Cross-reference</span>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Citation Button */}
      {showCitation && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleInsertCitation}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
      )}

      {/* Figure Wizard */}
      {showFigure && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleInsertFigure}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
              aria-label="Insert figure"
            >
              <ImageIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Insert figure</span>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Table Wizard */}
      {showTable && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              onClick={handleInsertTable}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
      )}

      {showLists && <ToolbarSeparator />}

      {/* ── 6. Lists & Environments ── */}
      {showLists && (
        <>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                onClick={() => handleInsertEnvironment('itemize')}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
                aria-label="Numbered list"
              >
                <ListOrdered className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Numbered list</span>
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {showCodeEnvs && (
        <>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                onClick={() => handleInsertEnvironment('quote')}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
                aria-label="Code block"
              >
                <Code className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Code block</span>
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* ── 7. Overflow "More actions" Dropdown (3 chấm) ── */}
      <DropdownMenu>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
                aria-label="More formatting options"
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>More actions</span>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-48 text-xs z-50">
          {!showUnderline && (
            <DropdownMenuItem onClick={() => handleInlineFormat('underline')} className="flex items-center gap-2 cursor-pointer">
              <Underline className="size-3.5 text-muted-foreground" />
              <span>Underline (Mod-u)</span>
            </DropdownMenuItem>
          )}
          {!showMath && (
            <DropdownMenuItem onClick={handleInsertMath} className="flex items-center gap-2 cursor-pointer">
              <Sigma className="size-3.5 text-muted-foreground" />
              <span>Math formula</span>
            </DropdownMenuItem>
          )}
          {!showSymbol && (
            <DropdownMenuItem onClick={handleInsertSymbol} className="flex items-center gap-2 cursor-pointer">
              <OmegaIcon />
              <span>Insert Symbol (Ω)</span>
            </DropdownMenuItem>
          )}
          {!showLink && (
            <DropdownMenuItem onClick={handleInsertLink} className="flex items-center gap-2 cursor-pointer">
              <Link2 className="size-3.5 text-muted-foreground" />
              <span>Insert link (Mod-k)</span>
            </DropdownMenuItem>
          )}
          {!showComment && (
            <DropdownMenuItem onClick={handleAddComment} className="flex items-center gap-2 cursor-pointer">
              <MessageSquarePlus className="size-3.5 text-muted-foreground" />
              <span>Add Comment</span>
            </DropdownMenuItem>
          )}
          {!showCrossRef && (
            <DropdownMenuItem onClick={handleInsertCrossRef} className="flex items-center gap-2 cursor-pointer">
              <Bookmark className="size-3.5 text-muted-foreground" />
              <span>Cross-reference</span>
            </DropdownMenuItem>
          )}
          {!showCitation && (
            <DropdownMenuItem onClick={handleInsertCitation} className="flex items-center gap-2 cursor-pointer">
              <BookOpen className="size-3.5 text-muted-foreground" />
              <span>Cite reference (Mod-Shift-k)</span>
            </DropdownMenuItem>
          )}
          {!showFigure && (
            <DropdownMenuItem onClick={handleInsertFigure} className="flex items-center gap-2 cursor-pointer">
              <ImageIcon className="size-3.5 text-muted-foreground" />
              <span>Insert figure</span>
            </DropdownMenuItem>
          )}
          {!showTable && (
            <DropdownMenuItem onClick={handleInsertTable} className="flex items-center gap-2 cursor-pointer">
              <TableIcon className="size-3.5 text-muted-foreground" />
              <span>Insert table</span>
            </DropdownMenuItem>
          )}

          {(!showLists || !showCodeEnvs) && <DropdownMenuSeparator />}

          {!showLists && (
            <>
              <DropdownMenuItem onClick={() => handleInsertEnvironment('itemize')} className="flex items-center gap-2 cursor-pointer">
                <List className="size-3.5 text-muted-foreground" />
                <span>Bulleted list</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleInsertEnvironment('enumerate')} className="flex items-center gap-2 cursor-pointer">
                <ListOrdered className="size-3.5 text-muted-foreground" />
                <span>Numbered list</span>
              </DropdownMenuItem>
            </>
          )}
          {!showCodeEnvs && (
            <>
              <DropdownMenuItem onClick={() => handleInsertEnvironment('quote')} className="flex items-center gap-2 cursor-pointer">
                <Quote className="size-3.5 text-muted-foreground" />
                <span>Quote</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleInsertEnvironment('code')} className="flex items-center gap-2 cursor-pointer">
                <Code className="size-3.5 text-muted-foreground" />
                <span>Code block</span>
              </DropdownMenuItem>
            </>
          )}

          {/* When all are visible on wide pane, show quick shortcuts in menu */}
          {showCodeEnvs && (
            <>
              <DropdownMenuItem onClick={handleAddComment} className="flex items-center gap-2 cursor-pointer">
                <MessageSquarePlus className="size-3.5 text-muted-foreground" />
                <span>Add Comment</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleInsertCrossRef} className="flex items-center gap-2 cursor-pointer">
                <Bookmark className="size-3.5 text-muted-foreground" />
                <span>Cross-reference</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleInsertTable} className="flex items-center gap-2 cursor-pointer">
                <TableIcon className="size-3.5 text-muted-foreground" />
                <span>Insert table</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleInsertFigure} className="flex items-center gap-2 cursor-pointer">
                <ImageIcon className="size-3.5 text-muted-foreground" />
                <span>Insert figure</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── 8. Right Side Group: Add Comment, Search, Editing Mode (Editing/Reviewing/Viewing), Switcher ── */}
      <div className="ml-auto flex items-center gap-1 shrink-0 pl-1">
        {/* Add Comment (Grouped with Review/Editing tools on the right) */}
        {showComment && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                onClick={handleAddComment}
                className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
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
        )}

        {/* Toggle In-File Search (Ctrl+F) */}
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                editorCommandBus.dispatch({ type: 'editor:find' });
              }}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
              aria-label="Search in file (Ctrl+F)"
            >
              <Search className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Search in file</span>
            <span className="ml-1.5 opacity-60">(Mod-f)</span>
          </TooltipContent>
        </Tooltip>

        <ToolbarSeparator />

        {/* Editing Mode Dropdown: Editing, Reviewing, Viewing */}
        <EditingModeDropdown />

        <ToolbarSeparator />

        {/* Code / Visual Mode Switcher */}
        <SourceVisualSwitcher />
      </div>
    </div>
  );
}
