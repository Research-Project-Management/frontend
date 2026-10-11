'use client';

/**
 * VisualSlashCommandMenu.tsx
 *
 * Slash Command Popup Menu for Visual / Rich-Text LaTeX Editor.
 * Location: `features/editor/ui/features/editor/VisualSlashCommandMenu.tsx`
 *
 * Provides a Notion/Overleaf-style popup triggered by typing '/' in Visual Mode.
 * Enables quick insertion of:
 * - Headings (\section, \subsection, \subsubsection)
 * - Math (Inline $, Display equation, Align)
 * - Structure (Table, Figure, Algorithms, Lists, Quotes)
 * - References (Citations, Labels)
 */

import React, { useEffect, useRef, useMemo } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Sigma,
  Table,
  Image,
  List,
  ListOrdered,
  Quote,
  Code2,
  BookOpen,
  Tag,
  Cpu,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  category: 'Structure' | 'Math & Formulas' | 'Media & Tables' | 'References';
  keywords: string[];
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
  // ── Structure & Sectioning ──
  {
    id: 'section',
    title: 'Section',
    description: 'Major section heading (\\section)',
    category: 'Structure',
    keywords: ['section', 'h1', 'heading', 'title'],
    shortcut: 'H1',
    icon: Heading1,
  },
  {
    id: 'subsection',
    title: 'Subsection',
    description: 'Secondary subsection heading (\\subsection)',
    category: 'Structure',
    keywords: ['subsection', 'h2', 'subheading'],
    shortcut: 'H2',
    icon: Heading2,
  },
  {
    id: 'subsubsection',
    title: 'Subsubsection',
    description: 'Tertiary subsubsection heading (\\subsubsection)',
    category: 'Structure',
    keywords: ['subsubsection', 'h3'],
    shortcut: 'H3',
    icon: Heading3,
  },
  {
    id: 'bullet-list',
    title: 'Bullet List',
    description: 'Unordered itemized list (\\begin{itemize})',
    category: 'Structure',
    keywords: ['bullet', 'list', 'itemize', 'ul'],
    icon: List,
  },
  {
    id: 'numbered-list',
    title: 'Numbered List',
    description: 'Numbered ordered list (\\begin{enumerate})',
    category: 'Structure',
    keywords: ['numbered', 'list', 'enumerate', 'ol', '1.'],
    icon: ListOrdered,
  },
  {
    id: 'quote',
    title: 'Blockquote',
    description: 'Indented block quote for citations or notes',
    category: 'Structure',
    keywords: ['quote', 'blockquote', 'cite'],
    icon: Quote,
  },

  // ── Math & Formulas ──
  {
    id: 'inline-math',
    title: 'Inline Formula',
    description: 'Mathematical formula within text ($...$)',
    category: 'Math & Formulas',
    keywords: ['math', 'inline', 'formula', 'latex', 'equation', '$'],
    shortcut: '$',
    icon: Sigma,
  },
  {
    id: 'display-equation',
    title: 'Display Equation',
    description: 'Centered equation block (\\begin{equation})',
    category: 'Math & Formulas',
    keywords: ['equation', 'display', 'math', 'block', 'formula', '$$'],
    shortcut: '$$',
    icon: Sigma,
  },
  {
    id: 'align-block',
    title: 'Multi-line Align',
    description: 'Aligned equations on relation signs (\\begin{align})',
    category: 'Math & Formulas',
    keywords: ['align', 'multiline', 'equation', 'split'],
    icon: Sigma,
  },

  // ── Media & Tables ──
  {
    id: 'table',
    title: 'Table',
    description: 'Insert an editable 3x3 table with headers',
    category: 'Media & Tables',
    keywords: ['table', 'grid', 'tabular', 'matrix'],
    icon: Table,
  },
  {
    id: 'table-wizard',
    title: 'Table Wizard',
    description: 'Configure custom table dimensions, headers & style',
    category: 'Media & Tables',
    keywords: ['table', 'wizard', 'matrix', 'tabular', 'spreadsheet', 'grid'],
    shortcut: 'Ctrl+Shift+T',
    icon: Table,
  },
  {
    id: 'figure',
    title: 'Figure with Caption',
    description: 'Centered graphic with caption (\\begin{figure})',
    category: 'Media & Tables',
    keywords: ['figure', 'image', 'picture', 'graphic', 'caption'],
    icon: Image,
  },
  {
    id: 'algorithm',
    title: 'Algorithm Block',
    description: 'Pseudocode and algorithm environment',
    category: 'Media & Tables',
    keywords: ['algorithm', 'pseudocode', 'code', 'logic'],
    icon: Cpu,
  },
  {
    id: 'code-block',
    title: 'Code / Listing',
    description: 'Verbatim code block (\\begin{lstlisting})',
    category: 'Media & Tables',
    keywords: ['code', 'verbatim', 'listing', 'snippet'],
    icon: Code2,
  },

  // ── References ──
  {
    id: 'citation',
    title: 'Citation',
    description: 'Insert bibliography reference [@bibkey] (\\cite)',
    category: 'References',
    keywords: ['cite', 'citation', 'bib', 'reference', 'bibliography'],
    shortcut: '@',
    icon: BookOpen,
  },
  {
    id: 'label',
    title: 'Cross-Reference Label',
    description: 'Attach target label for referencing (\\label)',
    category: 'References',
    keywords: ['label', 'ref', 'target'],
    icon: Tag,
  },
];

export interface VisualSlashCommandMenuProps {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
  onClose: () => void;
  onHoverIndex: (index: number) => void;
}

export function VisualSlashCommandMenu({
  isOpen,
  query,
  position,
  selectedIndex,
  onSelect,
  onClose,
  onHoverIndex,
}: VisualSlashCommandMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

  // Filter commands by query
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.description.toLowerCase().includes(q)) return true;
      return item.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [query]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (activeItemRef.current && typeof activeItemRef.current.scrollIntoView === 'function') {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isOpen, onClose]);

  if (!isOpen || filteredCommands.length === 0) return null;

  return (
    <div
      ref={containerRef}
      role="menu"
      aria-label="Slash Commands"
      data-testid="slash-command-menu"
      style={{
        top: `${Math.max(10, position.top)}px`,
        left: `${Math.max(10, position.left)}px`,
      }}
      className={cn(
        'fixed z-50 w-64 max-h-76 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-md',
        'p-1 space-y-0.5 animate-in fade-in-50 zoom-in-95 duration-100 select-none'
      )}
    >
      <div className="px-2 py-1 border-b border-border flex items-center justify-between text-11 text-muted-foreground">
        <span className="font-medium text-foreground">Insert</span>
        {query ? (
          <span className="font-mono text-foreground font-medium">/{query}</span>
        ) : (
          <span className="text-[10px]">Filter</span>
        )}
      </div>

      <div className="py-0.5 space-y-0.5">
        {filteredCommands.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              ref={isSelected ? activeItemRef : null}
              type="button"
              role="menuitem"
              data-command-id={item.id}
              onClick={() => onSelect(item)}
              onMouseEnter={() => onHoverIndex(idx)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1 rounded-xs text-left transition-colors cursor-pointer text-12',
                isSelected
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-muted text-foreground'
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', isSelected ? 'text-primary-foreground' : 'text-muted-foreground')} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate leading-tight font-medium">{item.title}</span>
                  {item.shortcut && (
                    <span
                      className={cn(
                        'text-[10px] px-1 font-mono rounded-xs shrink-0',
                        isSelected ? 'text-primary-foreground/90 bg-primary-foreground/20' : 'text-muted-foreground bg-muted'
                      )}
                    >
                      {item.shortcut}
                    </span>
                  )}
                </div>
                <p
                  className={cn(
                    'text-[10px] truncate leading-tight',
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  )}
                >
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-2 py-1 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground font-sans">
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Close</span>
      </div>
    </div>
  );
}

export default VisualSlashCommandMenu;
