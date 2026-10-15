'use client';

/**
 * VisualSelectionBubbleMenu.tsx
 *
 * Floating Rich-Text Selection Bubble Menu (Medium / Notion / Overleaf Style).
 * Location: `features/editor/ui/features/editor/visual/toolbars/VisualSelectionBubbleMenu.tsx`
 *
 * Features:
 * 1. Automatic Range Docking: Floats directly above active text selection.
 * 2. Text Formatting: Bold (\textbf), Italic (\textit), Underline (\underline),
 *    Strikethrough (\sout), Inline Code (\texttt).
 * 3. Academic Tools:
 *    - Convert selection to Inline Math ($...$) with KaTeX rendering.
 *    - Convert selection to Citation chip (\cite{...}).
 * 4. Block Transformation: Paragraph, Section (H1), Subsection (H2), Subsubsection (H3),
 *    Bullet List, Numbered List, Blockquote.
 * 5. Persistent Selection: Intercepts onMouseDown to prevent losing browser selection.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Sigma,
  BookOpen,
  ArrowRightToLine,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Type,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export type BlockType = 'p' | 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'blockquote';

export interface VisualSelectionBubbleMenuProps {
  position: { top: number; left: number };
  activeFormats: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    code: boolean;
    blockType: BlockType;
  };
  onFormat: (format: 'bold' | 'italic' | 'underline' | 'strike' | 'code') => void;
  onBlockTypeChange: (type: BlockType) => void;
  onConvertToMath: () => void;
  onConvertToCitation: () => void;
  onSyncToPdf?: () => void;
  onClose?: () => void;
}

const BLOCK_TYPE_LABELS: Record<BlockType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  p: { label: 'Text', icon: Type },
  h1: { label: 'Section', icon: Heading1 },
  h2: { label: 'Subsection', icon: Heading2 },
  h3: { label: 'Subsubsection', icon: Heading3 },
  ul: { label: 'Bullet List', icon: List },
  ol: { label: 'Numbered List', icon: ListOrdered },
  blockquote: { label: 'Quote', icon: Quote },
};

export function VisualSelectionBubbleMenu({
  position,
  activeFormats,
  onFormat,
  onBlockTypeChange,
  onConvertToMath,
  onConvertToCitation,
  onSyncToPdf,
}: VisualSelectionBubbleMenuProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  const currentBlockConfig = BLOCK_TYPE_LABELS[activeFormats.blockType] || BLOCK_TYPE_LABELS.p;
  const CurrentBlockIcon = currentBlockConfig.icon;

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const halfWidth = 150;
  const clampedLeft = Math.max(halfWidth + 8, Math.min(position.left, viewportWidth - halfWidth - 8));

  return (
    <div
      role="toolbar"
      aria-label="Selection Bubble Menu"
      className={cn(
        'fixed z-50 flex items-center bg-popover border border-border shadow-md rounded-md p-0.5 gap-0.5 text-12 text-foreground select-none max-w-[calc(100vw-1rem)] overflow-x-auto scrollbar-none',
        'animate-in fade-in zoom-in-95 duration-100'
      )}
      style={{
        top: `${Math.max(10, position.top)}px`,
        left: `${clampedLeft}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseDown={(e) => {
        // Crucial: Prevent stealing focus from contenteditable text selection
        e.preventDefault();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Block Type Selector Dropdown ── */}
      <div className="relative" ref={dropdownRef}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 min-h-[26px] px-1.5 flex items-center gap-1 hover:bg-muted font-medium text-11 text-foreground/90 hover:text-foreground cursor-pointer rounded-xs relative after:absolute after:-inset-1 after:content-['']"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          title="Change block style"
          aria-label={`Block style: ${currentBlockConfig.label}`}
        >
          <CurrentBlockIcon className="size-3.5 text-foreground" />
          <span className="hidden sm:inline-block max-w-[85px] truncate">{currentBlockConfig.label}</span>
          <ChevronDown className="size-3 opacity-60 ml-0.5" />
        </Button>

        {isDropdownOpen && (
          <div
            className="absolute top-full left-0 mt-1 w-40 bg-popover border border-border shadow-md rounded-md p-0.5 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
            role="menu"
            aria-label="Block style options"
          >
            {(Object.keys(BLOCK_TYPE_LABELS) as BlockType[]).map((type) => {
              const { label, icon: Icon } = BLOCK_TYPE_LABELS[type];
              const isSelected = activeFormats.blockType === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  className={cn(
                    'flex items-center gap-2 w-full px-2 py-1 rounded-xs text-left text-11 transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground hover:bg-muted'
                  )}
                  onClick={() => {
                    onBlockTypeChange(type);
                    setIsDropdownOpen(false);
                  }}
                >
                  <Icon className="size-3.5" />
                  <span className="flex-1">{label}</span>
                  {isSelected && <span className="size-1.5 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="w-px h-3.5 bg-border mx-0.5 shrink-0" />

      {/* ── Basic Formatting Controls ── */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-6 rounded-xs cursor-pointer transition-colors p-0 flex items-center justify-center relative after:absolute after:-inset-1 after:content-[\'\']',
          activeFormats.bold
            ? 'bg-primary/15 text-primary font-semibold'
            : 'hover:bg-muted text-foreground/80 hover:text-foreground'
        )}
        onClick={() => onFormat('bold')}
        aria-label="Format bold"
      >
        <Bold className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-6 rounded-xs cursor-pointer transition-colors p-0 flex items-center justify-center relative after:absolute after:-inset-1 after:content-[\'\']',
          activeFormats.italic
            ? 'bg-primary/15 text-primary'
            : 'hover:bg-muted text-foreground/80 hover:text-foreground'
        )}
        onClick={() => onFormat('italic')}
        aria-label="Format italic"
      >
        <Italic className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-6 rounded-xs cursor-pointer transition-colors p-0 flex items-center justify-center relative after:absolute after:-inset-1 after:content-[\'\']',
          activeFormats.underline
            ? 'bg-primary/15 text-primary'
            : 'hover:bg-muted text-foreground/80 hover:text-foreground'
        )}
        onClick={() => onFormat('underline')}
        aria-label="Format underline"
      >
        <Underline className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-6 rounded-xs cursor-pointer transition-colors p-0 flex items-center justify-center relative after:absolute after:-inset-1 after:content-[\'\']',
          activeFormats.strike
            ? 'bg-primary/15 text-primary'
            : 'hover:bg-muted text-foreground/80 hover:text-foreground'
        )}
        onClick={() => onFormat('strike')}
        aria-label="Format strikethrough"
      >
        <Strikethrough className="size-3.5" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-6 rounded-xs cursor-pointer transition-colors font-mono p-0 flex items-center justify-center relative after:absolute after:-inset-1 after:content-[\'\']',
          activeFormats.code
            ? 'bg-primary/15 text-primary'
            : 'hover:bg-muted text-foreground/80 hover:text-foreground'
        )}
        onClick={() => onFormat('code')}
        aria-label="Format inline code"
      >
        <Code2 className="size-3.5" />
      </Button>

      <div className="w-px h-3.5 bg-border mx-0.5 shrink-0" />

      {/* ── LaTeX Academic Fast Actions ── */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 rounded-xs cursor-pointer hover:bg-muted text-foreground/80 hover:text-foreground transition-colors p-0 flex items-center justify-center relative after:absolute after:-inset-1 after:content-[\'\']"
        onClick={onConvertToMath}
        aria-label="Convert to math formula"
      >
        <Sigma className="size-3.5 text-foreground" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 rounded-xs cursor-pointer hover:bg-muted text-foreground/80 hover:text-foreground transition-colors p-0 flex items-center justify-center relative after:absolute after:-inset-1 after:content-[\'\']"
        onClick={onConvertToCitation}
        aria-label="Insert citation"
      >
        <BookOpen className="size-3.5 text-foreground" />
      </Button>

      {onSyncToPdf && (
        <>
          <div className="w-px h-3.5 bg-border mx-0.5 shrink-0" />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 rounded-xs cursor-pointer hover:bg-muted text-foreground/80 hover:text-foreground transition-colors p-0 flex items-center justify-center relative after:absolute after:-inset-1 after:content-[\'\']"
            onClick={onSyncToPdf}
            aria-label="View in PDF (SyncTeX)"
          >
            <ArrowRightToLine className="size-3.5 text-foreground" />
          </Button>
        </>
      )}
    </div>
  );
}
