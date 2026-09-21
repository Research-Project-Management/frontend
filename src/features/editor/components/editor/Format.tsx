'use client';

import React, { useState, useCallback } from 'react';
import { usePageStore, useSettingsStore } from '@/features/editor/store';
import {
  Bot,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  Link as LinkIcon,
  MessageSquarePlus,
  Tag,
  BookOpen,
  ImagePlus,
  Table2,
  List,
  ListOrdered,
  Quote,
  Search,
  ChevronDown,
  MoreHorizontal,
  Sigma,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/shared/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui";
import {
  EditorCommandBus,
  EditorEventBus,
  type LatexFormatType,
} from '@/features/editor/utils/editor.util';
import { convertLatexTableToHtml } from '@/features/editor/utils/latex-converter.util';
import { MathSymbolPalette } from './subcomponents/MathSymbolPalette';
import { InsertTableModal } from './subcomponents/InsertTableModal';
import { InsertImageModal } from './subcomponents/InsertImageModal';

// ── Overleaf Math Formula Icon (+ - / *) ──────────────────────────────────────

function MathFormulaIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" strokeWidth="1.2" />
      {/* Top Left: + */}
      <path d="M4 5.2h3M5.5 3.7v3" />
      {/* Top Right: - */}
      <path d="M9 5.2h3" />
      {/* Bottom Left: × */}
      <path d="M4.3 11.7l2.4-2.4M6.7 11.7l-2.4-2.4" />
      {/* Bottom Right: ÷ */}
      <path d="M9 10.5h3" />
      <circle cx="10.5" cy="8.8" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="12.2" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ── Toolbar Button Primitive ───────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  icon?: React.ElementType;
  label?: string;
  tooltip: string;
  kbd?: string;
  active?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const ToolbarButton = React.memo(function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  tooltip,
  kbd,
  active = false,
  className,
  children,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={tooltip || label}
          className={cn(
            'size-7 flex items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 transition-all duration-150 outline-none select-none cursor-pointer shrink-0',
            active && 'bg-primary/15 text-primary font-semibold',
            className,
          )}
        >
          {Icon && <Icon className="size-3.5 shrink-0" />}
          {label && <span className="leading-none">{label}</span>}
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="center" className="flex items-center gap-2 z-[9999]">
        <span>{tooltip}</span>
        {kbd && (
          <kbd className="bg-muted px-1 rounded text-[11px] text-muted-foreground font-mono leading-none border border-border">
            {kbd}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
});

// ── Master Format Toolbar Component (Overleaf 1:1) ────────────────────────────

const Format = React.memo(function Format() {
  const editorRef = usePageStore((s) => s.editorRef);
  const editorMode = useSettingsStore((s) => s.editorMode);
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);

  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Switch between Source (Monaco) and Visual (TipTap) modes
  const handleSwitchMode = useCallback(
    (mode: 'code' | 'visual') => {
      if (editorMode === mode) return;
      setEditorMode(mode);
      toast.info(
        mode === 'visual'
          ? 'Switched to Visual (Rich Text) mode'
          : 'Switched to Source (Code) mode',
        { duration: 1500 },
      );
    },
    [editorMode, setEditorMode],
  );

  // Source Mode formatting commands (Monaco)
  const handleFormat = useCallback(
    (type: LatexFormatType) => {
      if (type === 'cite') {
        EditorEventBus.emit('flux:open-citation-picker');
        return;
      }
      EditorCommandBus.format(editorRef.current, type);
    },
    [editorRef],
  );

  const handleInsert = useCallback(
    (snippet: string) => {
      if (editorMode === 'visual') {
        const htmlTable = convertLatexTableToHtml(snippet);
        if (htmlTable) {
          EditorEventBus.emit('flux:visual-command', {
            command: 'insertTable',
            contentHtml: htmlTable,
          });
        } else {
          EditorEventBus.emit('flux:visual-command', {
            command: 'insertTable',
            contentHtml: `<p>${snippet}</p>`,
          });
        }
        return;
      }
      EditorCommandBus.insertSnippet(editorRef.current, snippet);
    },
    [editorMode, editorRef],
  );

  const handleHeadingSelect = useCallback(
    (level: 'section' | 'subsection' | 'subsubsection' | 'paragraph') => {
      if (level === 'paragraph') {
        EditorCommandBus.wrapSelection(editorRef.current, '\\paragraph{', '}', 'Paragraph');
      } else {
        EditorCommandBus.format(editorRef.current, level);
      }
    },
    [editorRef],
  );

  // Visual Mode commands (TipTap event bus delegation)
  const handleVisualCommand = useCallback(
    (
      command:
        | 'undo'
        | 'redo'
        | 'bold'
        | 'italic'
        | 'strike'
        | 'code'
        | 'heading'
        | 'bulletList'
        | 'orderedList'
        | 'blockquote'
        | 'insertMath',
      level?: 1 | 2 | 3,
    ) => {
      EditorEventBus.emit('flux:visual-command', { command, level });
    },
    [],
  );

  const handleFind = useCallback(() => {
    if (editorMode === 'code' && editorRef.current) {
      editorRef.current.trigger('toolbar', 'actions.find', null);
      editorRef.current.focus();
    } else {
      EditorEventBus.emit('flux:open-panel', 'Search');
    }
  }, [editorMode, editorRef]);

  const handleAddComment = useCallback(() => {
    EditorEventBus.emit('flux:open-panel', 'Review');
  }, []);

  const handleOpenAi = useCallback(() => {
    let selectedText: string | undefined = undefined;
    if (editorMode === 'code' && editorRef.current) {
      const selection = editorRef.current.getSelection();
      if (selection && !selection.isEmpty()) {
        const model = editorRef.current.getModel();
        const text = model ? model.getValueInRange(selection) : '';
        if (text.trim()) {
          selectedText = text;
        }
      }
    }
    EditorEventBus.emit('flux:open-ai-panel', { selectedText });
  }, [editorMode, editorRef]);

  return (
    <div className="h-9 px-1.5 flex items-center min-w-0 w-full select-none bg-background text-foreground overflow-hidden">
      {/* ── 1:1 Overleaf Authoring Tools ───────────────────────────────────── */}
      <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
        {/* 0. Overleaf 1:1 [ Source | Visual ] Switcher at Far Left */}
        <div className="inline-flex items-center rounded-full bg-muted/80 dark:bg-[#1b222c] border border-border/80 p-0.5 select-none shrink-0 shadow-xs mr-0.5">
          <button
            type="button"
            onClick={() => handleSwitchMode('code')}
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none leading-none',
              editorMode === 'code'
                ? 'bg-[#098842] text-white font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="Switch to LaTeX Source Editor (Ctrl+Shift+V)"
          >
            Source
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('visual')}
            className={cn(
              'px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none leading-none',
              editorMode === 'visual'
                ? 'bg-[#098842] text-white font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="Switch to Visual Rich-Text Editor (Ctrl+Shift+V)"
          >
            Visual
          </button>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

        {/* 1. AI Assistant (🤖) */}
        <ToolbarButton
          onClick={handleOpenAi}
          icon={Bot}
          tooltip="AI Research Assistant (LaTeX Copilot)"
        />

        {/* ── Mode-Adaptive Authoring Controls ───────────────────────────────── */}
        {editorMode === 'code' ? (
          /* ── SOURCE MODE TOOLS (Monaco Editor) ────────────────────────────── */
          <>
            {/* 2. Undo & Redo (↺, ↻) */}
            <ToolbarButton
              onClick={() => EditorCommandBus.undo(editorRef.current)}
              icon={Undo2}
              tooltip="Undo"
              kbd="Ctrl+Z"
            />
            <ToolbarButton
              onClick={() => EditorCommandBus.redo(editorRef.current)}
              icon={Redo2}
              tooltip="Redo"
              kbd="Ctrl+Y"
            />

            {/* 3. Find & Replace (🔍 - Overleaf 1:1 beside Redo) */}
            <ToolbarButton
              onClick={handleFind}
              icon={Search}
              tooltip="Find and Replace"
              kbd="Ctrl+F"
            />

            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 4. Headings Dropdown (TT ˅) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Headings"
                  className="hidden sm:inline-flex h-7 px-1.5 items-center justify-center gap-0.5 rounded text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 outline-none cursor-pointer shrink-0 transition-colors"
                >
                  <span className="font-serif font-bold text-xs tracking-tight">TT</span>
                  <ChevronDown className="size-2.5 opacity-60 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 z-[9999]">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                  Heading Style
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleHeadingSelect('section')} className="cursor-pointer">
                  <span className="font-semibold text-sm">Section (\section)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleHeadingSelect('subsection')} className="cursor-pointer">
                  <span className="font-medium text-xs">Subsection (\subsection)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleHeadingSelect('subsubsection')} className="cursor-pointer">
                  <span className="text-xs">Subsubsection (\subsubsection)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleHeadingSelect('paragraph')} className="cursor-pointer">
                  <span className="text-xs">Normal Text (\paragraph)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 5. Text Styling (B, I) */}
            <ToolbarButton
              onClick={() => handleFormat('bold')}
              icon={Bold}
              tooltip="Bold (\textbf)"
              kbd="Ctrl+B"
              className="hidden sm:inline-flex"
            />
            <ToolbarButton
              onClick={() => handleFormat('italic')}
              icon={Italic}
              tooltip="Italic (\textit)"
              kbd="Ctrl+I"
              className="hidden sm:inline-flex"
            />

            {/* Divider */}
            <div className="hidden md:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 6. Math Formulas Dropdown (+ - / *) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Insert Math Formula"
                  className="hidden md:inline-flex size-7 items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 outline-none transition-colors cursor-pointer shrink-0"
                >
                  <MathFormulaIcon className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 z-[9999]">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                  Math Formulas
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleFormat('inlineMath')} className="cursor-pointer">
                  <span className="font-mono text-xs mr-2 text-primary">$ ... $</span>
                  <span className="text-xs">Inline Math</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFormat('displayMath')} className="cursor-pointer">
                  <span className="font-mono text-xs mr-2 text-primary">\[ ... \]</span>
                  <span className="text-xs">Display Math</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFormat('equation')} className="cursor-pointer">
                  <span className="font-mono text-xs mr-2 text-primary">\begin&#123;equation&#125;</span>
                  <span className="text-xs">Numbered Equation</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFormat('align')} className="cursor-pointer">
                  <span className="font-mono text-xs mr-2 text-primary">\begin&#123;align&#125;</span>
                  <span className="text-xs">Multi-line Align</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 7. Greek & Math Symbol Palette (Ω) */}
            <MathSymbolPalette
              onInsert={handleInsert}
              trigger={
                <button
                  type="button"
                  aria-label="LaTeX Math Symbol Palette (Ω)"
                  className="hidden md:inline-flex size-7 items-center justify-center rounded text-xs font-serif font-bold text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 outline-none transition-colors cursor-pointer shrink-0"
                >
                  <span className="text-sm font-semibold leading-none">Ω</span>
                </button>
              }
            />

            {/* Divider */}
            <div className="hidden lg:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 8. Link (🔗) */}
            <ToolbarButton
              onClick={() => EditorCommandBus.wrapSelection(editorRef.current, '\\href{url}{', '}', 'link text')}
              icon={LinkIcon}
              tooltip="Insert Link (\href)"
              className="hidden lg:inline-flex"
            />

            {/* 9. Review Comment (💬⁺) */}
            <ToolbarButton
              onClick={handleAddComment}
              icon={MessageSquarePlus}
              tooltip="Add Review Comment"
              className="hidden lg:inline-flex"
            />

            {/* Divider */}
            <div className="hidden xl:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 10. Label / Reference (🏷️) */}
            <ToolbarButton
              onClick={() => handleFormat('ref')}
              icon={Tag}
              tooltip="Cross-Reference / Label (\label, \ref)"
              className="hidden xl:inline-flex"
            />

            {/* 11. Citation (📖) */}
            <ToolbarButton
              onClick={() => EditorEventBus.emit('flux:open-citation-picker')}
              icon={BookOpen}
              tooltip="Insert Citation (\cite)"
              className="hidden xl:inline-flex"
            />

            {/* 12. More Options (...) -> Full Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More options"
                  className="size-7 flex items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 transition-colors outline-none cursor-pointer shrink-0"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className="w-56 z-[9999]">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                  Insert & Tools
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setImageModalOpen(true)} className="cursor-pointer gap-2">
                  <ImagePlus className="size-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs">Insert Figure...</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTableModalOpen(true)} className="cursor-pointer gap-2">
                  <Table2 className="size-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs">Insert Table...</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleFormat('itemize')} className="cursor-pointer gap-2">
                  <List className="size-4 text-muted-foreground" />
                  <span className="text-xs">Bullet List (\begin&#123;itemize&#125;)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFormat('enumerate')} className="cursor-pointer gap-2">
                  <ListOrdered className="size-4 text-muted-foreground" />
                  <span className="text-xs">Numbered List (\begin&#123;enumerate&#125;)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => EditorEventBus.emit('flux:open-citation-picker')} className="cursor-pointer gap-2">
                  <BookOpen className="size-4 text-muted-foreground" />
                  <span className="text-xs">Citation (\cite)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFormat('ref')} className="cursor-pointer gap-2">
                  <Tag className="size-4 text-muted-foreground" />
                  <span className="text-xs">Cross-Reference (\ref, \label)</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => EditorCommandBus.wrapSelection(editorRef.current, '\\href{url}{', '}', 'link text')}
                  className="cursor-pointer gap-2"
                >
                  <LinkIcon className="size-4 text-muted-foreground" />
                  <span className="text-xs">Insert Link (\href)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddComment} className="cursor-pointer gap-2">
                  <MessageSquarePlus className="size-4 text-muted-foreground" />
                  <span className="text-xs">Review Comment</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleFormat('inlineMath')} className="cursor-pointer gap-2">
                  <span className="font-mono text-xs text-primary font-bold">$...$</span>
                  <span className="text-xs">Inline Math</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFormat('displayMath')} className="cursor-pointer gap-2">
                  <span className="font-mono text-xs text-primary font-bold">\[...\]</span>
                  <span className="text-xs">Display Math</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleFormat('equation')} className="cursor-pointer gap-2">
                  <span className="font-mono text-xs text-primary font-bold">\eq</span>
                  <span className="text-xs">Numbered Equation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          /* ── VISUAL MODE TOOLS (TipTap Rich-Text Editor) ────────────────────── */
          <>
            {/* 2. Undo & Redo (↺, ↻) */}
            <ToolbarButton
              onClick={() => handleVisualCommand('undo')}
              icon={Undo2}
              tooltip="Undo"
              kbd="Ctrl+Z"
            />
            <ToolbarButton
              onClick={() => handleVisualCommand('redo')}
              icon={Redo2}
              tooltip="Redo"
              kbd="Ctrl+Y"
            />

            {/* 3. Find & Replace (🔍) */}
            <ToolbarButton
              onClick={handleFind}
              icon={Search}
              tooltip="Find and Replace"
              kbd="Ctrl+F"
            />

            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 4. Headings Dropdown (TT ˅) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Headings"
                  className="hidden sm:inline-flex h-7 px-1.5 items-center justify-center gap-0.5 rounded text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 outline-none cursor-pointer shrink-0 transition-colors"
                >
                  <span className="font-serif font-bold text-xs tracking-tight">TT</span>
                  <ChevronDown className="size-2.5 opacity-60 ml-0.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48 z-[9999]">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                  Heading Style
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleVisualCommand('heading', 1)} className="cursor-pointer">
                  <span className="font-semibold text-sm">Section (H1)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVisualCommand('heading', 2)} className="cursor-pointer">
                  <span className="font-medium text-xs">Subsection (H2)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVisualCommand('heading', 3)} className="cursor-pointer">
                  <span className="text-xs">Subsubsection (H3)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleVisualCommand('heading', 1)} className="cursor-pointer">
                  <span className="text-xs">Normal Text</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Divider */}
            <div className="hidden sm:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 5. Text Styling (B, I, S, Code) */}
            <ToolbarButton
              onClick={() => handleVisualCommand('bold')}
              icon={Bold}
              tooltip="Bold (\textbf)"
              kbd="Ctrl+B"
              className="hidden sm:inline-flex"
            />
            <ToolbarButton
              onClick={() => handleVisualCommand('italic')}
              icon={Italic}
              tooltip="Italic (\textit)"
              kbd="Ctrl+I"
              className="hidden sm:inline-flex"
            />
            <ToolbarButton
              onClick={() => handleVisualCommand('strike')}
              icon={Strikethrough}
              tooltip="Strikethrough"
              className="hidden md:inline-flex"
            />
            <ToolbarButton
              onClick={() => handleVisualCommand('code')}
              icon={CodeIcon}
              tooltip="Code (\texttt)"
              className="hidden md:inline-flex"
            />

            {/* Divider */}
            <div className="hidden md:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 6. Insert Math (Σ) */}
            <ToolbarButton
              onClick={() => handleVisualCommand('insertMath')}
              icon={Sigma}
              tooltip="Insert KaTeX Math Formula"
              className="hidden md:inline-flex"
            />

            {/* 6b. Insert Table (▦) */}
            <ToolbarButton
              onClick={() => setTableModalOpen(true)}
              icon={Table2}
              tooltip="Insert Table"
              className="hidden md:inline-flex"
            />

            {/* Divider */}
            <div className="hidden lg:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 7. Lists & Quotes */}
            <ToolbarButton
              onClick={() => handleVisualCommand('bulletList')}
              icon={List}
              tooltip="Bullet List (\begin{itemize})"
              className="hidden lg:inline-flex"
            />
            <ToolbarButton
              onClick={() => handleVisualCommand('orderedList')}
              icon={ListOrdered}
              tooltip="Numbered List (\begin{enumerate})"
              className="hidden lg:inline-flex"
            />
            <ToolbarButton
              onClick={() => handleVisualCommand('blockquote')}
              icon={Quote}
              tooltip="Blockquote"
              className="hidden lg:inline-flex"
            />

            {/* Divider */}
            <div className="hidden xl:block h-4 w-px bg-border/80 mx-0.5 shrink-0" />

            {/* 8. Review Comment (💬⁺) */}
            <ToolbarButton
              onClick={handleAddComment}
              icon={MessageSquarePlus}
              tooltip="Add Review Comment"
              className="hidden xl:inline-flex"
            />

            {/* 9. Citation (📖) */}
            <ToolbarButton
              onClick={() => EditorEventBus.emit('flux:open-citation-picker')}
              icon={BookOpen}
              tooltip="Insert Citation (\cite)"
              className="hidden xl:inline-flex"
            />

            {/* 10. More Options (...) -> Full Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More options"
                  className="size-7 flex items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 transition-colors outline-none cursor-pointer shrink-0"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className="w-56 z-[9999]">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                  Insert & Tools
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTableModalOpen(true)} className="cursor-pointer gap-2">
                  <Table2 className="size-4 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs">Insert Table...</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVisualCommand('insertMath')} className="cursor-pointer gap-2">
                  <Sigma className="size-4 text-primary" />
                  <span className="text-xs">Insert Math Formula</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleVisualCommand('bulletList')} className="cursor-pointer gap-2">
                  <List className="size-4 text-muted-foreground" />
                  <span className="text-xs">Bullet List</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVisualCommand('orderedList')} className="cursor-pointer gap-2">
                  <ListOrdered className="size-4 text-muted-foreground" />
                  <span className="text-xs">Numbered List</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleVisualCommand('blockquote')} className="cursor-pointer gap-2">
                  <Quote className="size-4 text-muted-foreground" />
                  <span className="text-xs">Blockquote</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => EditorEventBus.emit('flux:open-citation-picker')} className="cursor-pointer gap-2">
                  <BookOpen className="size-4 text-muted-foreground" />
                  <span className="text-xs">Citation (\cite)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddComment} className="cursor-pointer gap-2">
                  <MessageSquarePlus className="size-4 text-muted-foreground" />
                  <span className="text-xs">Review Comment</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* ── Modals & Dialogs ── */}
      <InsertTableModal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onInsert={handleInsert}
      />

      <InsertImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onInsert={handleInsert}
      />
    </div>
  );
});

export default Format;
