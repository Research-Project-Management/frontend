'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePageStore, useSettingsStore } from '@/features/editor/store';
import {
  Bot,
  Undo,
  Redo,
  Type,
  Bold,
  Italic,
  Calculator,
  Sigma,
  Link as LinkIcon,
  MessageSquarePlus,
  Tag,
  BookOpen,
  Image as ImageIcon,
  Table as TableIcon,
  List,
  Search,
  PenLine,
  ChevronDown,
  Settings,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  Pilcrow,
  Hash,
  Check,
  Code as CodeIcon,
  Eye,
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
import { WordCountDialog } from './subcomponents/WordCountDialog';
import { MathSymbolPalette } from './subcomponents/MathSymbolPalette';
import { InsertTableModal } from './subcomponents/InsertTableModal';
import { InsertImageModal } from './subcomponents/InsertImageModal';

// ── Toolbar Button Primitive ───────────────────────────────────────────────────

interface ToolbarButtonProps {
  onClick: () => void;
  icon?: React.ElementType;
  label?: string;
  tooltip: string;
  kbd?: string;
  active?: boolean;
  variant?: 'default' | 'ai' | 'settings';
  children?: React.ReactNode;
}

function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  tooltip,
  kbd,
  active = false,
  variant = 'default',
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
            'h-7 min-w-7 px-1.5 flex items-center justify-center gap-1 rounded text-xs font-medium transition-colors duration-150 outline-none select-none cursor-pointer',
            'active:scale-95',
            active
              ? 'bg-primary/10 text-primary hover:bg-primary/15'
              : 'text-foreground hover:bg-muted',
            variant === 'ai' && 'text-primary hover:bg-primary/10',
            variant === 'settings' && 'text-foreground hover:bg-muted',
          )}
        >
          {Icon && <Icon className="size-3.5 shrink-0" />}
          {label && <span>{label}</span>}
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

// ── Master Format Toolbar Component ───────────────────────────────────────────

export default function Format() {
  const { editorRef } = usePageStore();
  const {
    wordWrap,
    setWordWrap,
    lineNumbers,
    setLineNumbers,
    fontSize,
    setFontSize,
    editorMode,
    setEditorMode,
    reviewMode,
    setReviewMode,
  } = useSettingsStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);

  // Dialog states
  const [wordCountOpen, setWordCountOpen] = useState(false);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let frameId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
    });

    observer.observe(el);
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId);
      observer.unobserve(el);
    };
  }, []);

  const isWide = width >= 780;
  const isMedium = width >= 560;

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

  const handleFontSizeChange = (direction: 'in' | 'out') => {
    setFontSize(
      direction === 'in'
        ? Math.min(fontSize + 1, 30)
        : Math.max(fontSize - 1, 10),
    );
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

  return (
    <div
      ref={containerRef}
      className="h-9 px-1.5 flex items-center justify-between flex-1 min-w-0 select-none bg-background text-foreground"
    >
      {/* ── Left Side: 1:1 Overleaf Authoring Tools ─────────────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
        {/* 1. AI & History Group */}
        <div className="flex items-center gap-0.5 pr-1 border-r border-border shrink-0">
          <ToolbarButton
            onClick={() => EditorEventBus.emit('flux:open-ai-panel')}
            icon={Bot}
            tooltip="AI Research Assistant"
            variant="ai"
          />
          <ToolbarButton
            onClick={() => EditorCommandBus.undo(editorRef.current)}
            icon={Undo}
            tooltip="Undo"
            kbd="Ctrl+Z"
          />
          <ToolbarButton
            onClick={() => EditorCommandBus.redo(editorRef.current)}
            icon={Redo}
            tooltip="Redo"
            kbd="Ctrl+Y"
          />
        </div>

        {/* 2. Headings Dropdown (TT ▾) */}
        <div className="flex items-center pr-1 border-r border-border shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Headings"
                className="h-7 px-1.5 flex items-center justify-center gap-0.5 rounded text-xs font-medium text-foreground hover:bg-muted active:scale-95 outline-none cursor-pointer"
              >
                <span className="font-serif font-bold text-xs tracking-tighter">TT</span>
                <ChevronDown className="size-3 opacity-60 ml-0.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44 z-[9999]">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                Paragraph Style
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleHeadingSelect('paragraph')}>
                <span className="text-xs">Normal Text (\paragraph)</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleHeadingSelect('section')}>
                <span className="font-semibold text-sm">Section (\section)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleHeadingSelect('subsection')}>
                <span className="font-medium text-xs">Subsection (\subsection)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleHeadingSelect('subsubsection')}>
                <span className="text-xs">Subsubsection (\subsubsection)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 3. Text Styling (B, I) */}
        <div className="flex items-center gap-0.5 pr-1 border-r border-border shrink-0">
          <ToolbarButton
            onClick={() => handleFormat('bold')}
            icon={Bold}
            tooltip="Bold"
            kbd="Ctrl+B"
          />
          <ToolbarButton
            onClick={() => handleFormat('italic')}
            icon={Italic}
            tooltip="Italic"
            kbd="Ctrl+I"
          />
        </div>

        {/* 4. Academic & Multimedia Inserts */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Math Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Insert Math Formula"
                className="h-7 px-1.5 flex items-center justify-center gap-0.5 rounded text-xs font-medium text-foreground hover:bg-muted active:scale-95 outline-none cursor-pointer"
              >
                <Calculator className="size-3.5" />
                <ChevronDown className="size-2.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 z-[9999]">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                Math Formula
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleFormat('inlineMath')}>
                <span className="font-mono text-xs mr-2 text-primary">$ ... $</span>
                <span className="text-xs">Inline Math</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('displayMath')}>
                <span className="font-mono text-xs mr-2 text-primary">\[ ... \]</span>
                <span className="text-xs">Display Math</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('equation')}>
                <span className="font-mono text-xs mr-2 text-primary">\begin&#123;equation&#125;</span>
                <span className="text-xs">Equation</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Math Symbol Palette (Ω) */}
          <MathSymbolPalette
            onInsert={handleInsert}
            trigger={
              <button
                type="button"
                aria-label="LaTeX Math Symbol Palette (Ω)"
                className="h-7 min-w-7 px-1.5 flex items-center justify-center rounded text-xs font-serif font-bold text-foreground hover:bg-muted active:scale-95 outline-none transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold leading-none">Ω</span>
              </button>
            }
          />

          {/* Link */}
          <ToolbarButton
            onClick={() => EditorCommandBus.wrapSelection(editorRef.current, '\\href{url}{', '}', 'link text')}
            icon={LinkIcon}
            tooltip="Insert Link (\href)"
          />

          {/* Review Comment (💬⁺) */}
          <ToolbarButton
            onClick={handleAddComment}
            icon={MessageSquarePlus}
            tooltip="Add Review Comment"
          />

          {/* Label (🏷️) */}
          <ToolbarButton
            onClick={() => handleFormat('ref')}
            icon={Tag}
            tooltip="Cross-Reference / Label"
          />

          {/* Citation (📖) */}
          <ToolbarButton
            onClick={() => EditorEventBus.emit('flux:open-citation-picker')}
            icon={BookOpen}
            tooltip="Insert Citation (\cite)"
          />

          {/* Insert Figure / Image (🖼️) */}
          <ToolbarButton
            onClick={() => setImageModalOpen(true)}
            icon={ImageIcon}
            tooltip="Insert Image / Figure"
          />

          {/* Insert Table (▦) */}
          <ToolbarButton
            onClick={() => setTableModalOpen(true)}
            icon={TableIcon}
            tooltip="Insert Table"
          />

          {/* Bullet List (≡) */}
          <ToolbarButton
            onClick={() => handleFormat('itemize')}
            icon={List}
            tooltip="Bullet List (\begin{itemize})"
          />
        </div>
      </div>

      {/* ── Right Side: Mode Switcher, Review, Search & Settings ─────────── */}
      <div className="flex items-center gap-2 shrink-0 pl-2">
        {/* Code | Visual Segmented Pill Toggle (Matching Overleaf 1:1) */}
        <div className="flex items-center rounded-full bg-muted/80 p-0.5 border border-border text-xs select-none">
          <button
            type="button"
            onClick={() => setEditorMode('code')}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer',
              editorMode === 'code'
                ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Code
          </button>
          <button
            type="button"
            onClick={() => setEditorMode('visual')}
            className={cn(
              'px-2.5 py-0.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer',
              editorMode === 'visual'
                ? 'bg-emerald-600 text-white font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Visual
          </button>
        </div>

        {/* Review Mode Dropdown (✏️ ▾) */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Review Mode"
              className={cn(
                'h-7 px-1.5 flex items-center justify-center gap-0.5 rounded text-xs font-medium text-foreground hover:bg-muted active:scale-95 outline-none transition-colors cursor-pointer',
                reviewMode && 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold',
              )}
            >
              <PenLine className="size-3.5 shrink-0" />
              <ChevronDown className="size-2.5 opacity-60" />
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
              {!reviewMode && <Check className="size-3.5 text-emerald-600" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setReviewMode(true)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Check className="size-3.5 text-amber-500" />
                <span className="text-xs">Track Changes</span>
              </div>
              {reviewMode && <Check className="size-3.5 text-emerald-600" />}
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

        {/* Settings & Word Count */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Editor settings"
              className="h-7 w-7 flex items-center justify-center rounded text-foreground hover:bg-muted active:scale-95 outline-none shrink-0 cursor-pointer"
            >
              <Settings className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 z-[9999]">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
              Editor Tools & Preferences
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setWordCountOpen(true)} className="cursor-pointer">
              <Calculator className="size-4 mr-2 text-primary" />
              <span className="text-xs">Word Count (TeXcount)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setWordWrap(!wordWrap)} className="cursor-pointer">
              <Pilcrow className={cn('size-4 mr-2', wordWrap && 'text-primary')} />
              <span className="text-xs">Word Wrap</span>
              <span className="ml-auto text-[11px] font-mono font-medium text-muted-foreground">
                {wordWrap ? 'On' : 'Off'}
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLineNumbers(!lineNumbers)} className="cursor-pointer">
              <Hash className={cn('size-4 mr-2', lineNumbers && 'text-primary')} />
              <span className="text-xs">Line Numbers</span>
              <span className="ml-auto text-[11px] font-mono font-medium text-muted-foreground">
                {lineNumbers ? 'On' : 'Off'}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5 text-xs">
              <span className="text-muted-foreground">Font Size:</span>
              <div className="flex items-center gap-1 bg-muted rounded border border-border">
                <button
                  type="button"
                  onClick={() => handleFontSizeChange('out')}
                  className="px-1.5 py-0.5 hover:bg-background rounded-l text-xs font-bold"
                >
                  -
                </button>
                <span className="px-1.5 font-mono text-[11px] font-semibold">{fontSize}px</span>
                <button
                  type="button"
                  onClick={() => handleFontSizeChange('in')}
                  className="px-1.5 py-0.5 hover:bg-background rounded-r text-xs font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Modals & Dialogs ─────────────────────────────────────────────── */}
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

      <WordCountDialog
        open={wordCountOpen}
        onClose={() => setWordCountOpen(false)}
        content={editorRef.current?.getValue() ?? ''}
      />
    </div>
  );
}
