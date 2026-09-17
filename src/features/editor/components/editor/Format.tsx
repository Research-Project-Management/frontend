'use client';

import React, { useState } from 'react';
import { usePageStore, useSettingsStore } from '@/features/editor/store';
import {
  Bot,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Link as LinkIcon,
  MessageSquarePlus,
  Tag,
  BookOpen,
  ImagePlus,
  Table2,
  List,
  Search,
  PenLine,
  ChevronDown,
  MoreHorizontal,
  Check,
} from 'lucide-react';
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

function ToolbarButton({
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
}

// ── Master Format Toolbar Component (Overleaf 1:1) ────────────────────────────

export default function Format() {
  const { editorRef } = usePageStore();
  const { editorMode, setEditorMode, reviewMode, setReviewMode } = useSettingsStore();

  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const handleFormat = (type: LatexFormatType) => {
    if (type === 'cite') {
      EditorEventBus.emit('flux:open-citation-picker');
      return;
    }
    EditorCommandBus.format(editorRef.current, type);
  };

  const handleInsert = (snippet: string) => {
    EditorCommandBus.insertSnippet(editorRef.current, snippet);
  };

  const handleHeadingSelect = (level: 'section' | 'subsection' | 'subsubsection' | 'paragraph') => {
    if (level === 'paragraph') {
      EditorCommandBus.wrapSelection(editorRef.current, '\\paragraph{', '}', 'Paragraph');
    } else {
      EditorCommandBus.format(editorRef.current, level);
    }
  };

  const handleFind = () => {
    if (editorRef.current) {
      editorRef.current.trigger('toolbar', 'actions.find', null);
      editorRef.current.focus();
    }
  };

  const handleAddComment = () => {
    EditorEventBus.emit('flux:open-panel', 'Review');
  };

  const handleOpenAi = () => {
    let selectedText: string | undefined = undefined;
    if (editorRef.current) {
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
  };

  return (
    <div className="h-9 px-2 flex items-center justify-between flex-1 min-w-0 select-none bg-background text-foreground">
      {/* ── Left Side: 1:1 Overleaf Authoring Tools ─────────────────────────── */}
      <div className="flex items-center gap-0.5 min-w-0 shrink-0">
        {/* 1. AI Assistant (🤖) */}
        <ToolbarButton
          onClick={handleOpenAi}
          icon={Bot}
          tooltip="AI Research Assistant (LaTeX Copilot)"
        />

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

        {/* Divider */}
        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* 3. Headings Dropdown (TT ˅) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Headings"
              className="h-7 px-1.5 flex items-center justify-center gap-0.5 rounded text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 outline-none cursor-pointer shrink-0 transition-colors"
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
        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* 4. Text Styling (B, I) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleFormat('bold')}
              aria-label="Bold (Ctrl+B)"
              className="size-7 flex items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 transition-colors outline-none cursor-pointer shrink-0"
            >
              <Bold className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-2">
            <span>Bold</span>
            <kbd className="bg-muted px-1 rounded text-[11px] text-muted-foreground font-mono leading-none border border-border">Ctrl+B</kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => handleFormat('italic')}
              aria-label="Italic (Ctrl+I)"
              className="size-7 flex items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 transition-colors outline-none cursor-pointer shrink-0"
            >
              <Italic className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-2">
            <span>Italic</span>
            <kbd className="bg-muted px-1 rounded text-[11px] text-muted-foreground font-mono leading-none border border-border">Ctrl+I</kbd>
          </TooltipContent>
        </Tooltip>

        {/* Divider */}
        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* 5. Math Formulas Dropdown (+ - / *) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Insert Math Formula"
              className="size-7 flex items-center justify-center rounded text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 outline-none transition-colors cursor-pointer shrink-0"
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

        {/* 6. Greek & Math Symbol Palette (Ω) */}
        <MathSymbolPalette
          onInsert={handleInsert}
          trigger={
            <button
              type="button"
              aria-label="LaTeX Math Symbol Palette (Ω)"
              className="size-7 flex items-center justify-center rounded text-xs font-serif font-bold text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 outline-none transition-colors cursor-pointer shrink-0"
            >
              <span className="text-sm font-semibold leading-none">Ω</span>
            </button>
          }
        />

        {/* 7. Link (🔗) */}
        <ToolbarButton
          onClick={() => EditorCommandBus.wrapSelection(editorRef.current, '\\href{url}{', '}', 'link text')}
          icon={LinkIcon}
          tooltip="Insert Link (\href)"
        />

        {/* 8. Review Comment (💬⁺) */}
        <ToolbarButton
          onClick={handleAddComment}
          icon={MessageSquarePlus}
          tooltip="Add Review Comment"
        />

        {/* 9. Label / Reference (🏷️) */}
        <ToolbarButton
          onClick={() => handleFormat('ref')}
          icon={Tag}
          tooltip="Cross-Reference / Label (\label, \ref)"
        />

        {/* 10. Citation (📖) */}
        <ToolbarButton
          onClick={() => EditorEventBus.emit('flux:open-citation-picker')}
          icon={BookOpen}
          tooltip="Insert Citation (\cite)"
        />

        {/* 11. Overflow / More Options (...) -> [🖼️+] [▦] [≔] */}
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
          <DropdownMenuContent
            align="start"
            sideOffset={6}
            className="flex items-center gap-1 p-1 bg-[#1e232d] dark:bg-[#161a22] border border-border/80 shadow-xl rounded-md z-[9999]"
          >
            {/* Insert Figure (🖼️+) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setImageModalOpen(true)}
                  aria-label="Insert Figure"
                  className="size-7 flex items-center justify-center rounded text-zinc-300 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                >
                  <ImagePlus className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Insert Figure</TooltipContent>
            </Tooltip>

            {/* Insert Table (▦) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setTableModalOpen(true)}
                  aria-label="Insert Table"
                  className="size-7 flex items-center justify-center rounded text-zinc-300 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                >
                  <Table2 className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Insert Table</TooltipContent>
            </Tooltip>

            {/* Bullet List (≔) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleFormat('itemize')}
                  aria-label="Bullet List"
                  className="size-7 flex items-center justify-center rounded text-zinc-300 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                >
                  <List className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Bullet List (\begin&#123;itemize&#125;)</TooltipContent>
            </Tooltip>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Spacer ── */}
      <div className="flex-1 min-w-2" />

      {/* ── Right Side: [ Code | Visual ], Review Mode [✏️ ˅], Find [🔍] ───── */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Code | Visual Segmented Switcher (Overleaf 1:1) */}
        <div className="inline-flex items-center rounded-full bg-[#1b222c] border border-black/15 p-0.5 select-none shrink-0">
          <button
            type="button"
            onClick={() => setEditorMode('code')}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none leading-none',
              editorMode === 'code'
                ? 'bg-[#098842] text-white shadow-2xs'
                : 'text-zinc-400 hover:text-white',
            )}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer select-none leading-none',
              editorMode === 'visual'
                ? 'bg-[#098842] text-white shadow-2xs'
                : 'text-zinc-400 hover:text-white',
            )}
          >
            Visual
          </button>
        </div>

        {/* Review / Track Changes Mode Dropdown (✏️ ▾) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Review Mode"
              className={cn(
                'h-7 px-1.5 flex items-center justify-center gap-0.5 rounded text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95 outline-none transition-colors cursor-pointer shrink-0',
                reviewMode && 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold',
              )}
            >
              <PenLine className="size-3.5 shrink-0" />
              <ChevronDown className="size-2.5 opacity-60 ml-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 z-[9999]">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
              Editing Mode
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setReviewMode(false)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <PenLine className="size-3.5 text-muted-foreground" />
                <span className="text-xs">Direct Editing</span>
              </div>
              {!reviewMode && <Check className="size-3.5 text-[#16a34a]" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setReviewMode(true)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-amber-500" />
                <span className="text-xs">Track Changes</span>
              </div>
              {reviewMode && <Check className="size-3.5 text-[#16a34a]" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Find & Replace (🔍) */}
        <ToolbarButton
          onClick={handleFind}
          icon={Search}
          tooltip="Find and Replace"
          kbd="Ctrl+F"
        />
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
}
