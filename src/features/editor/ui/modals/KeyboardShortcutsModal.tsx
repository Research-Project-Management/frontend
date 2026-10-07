'use client';

/**
 * KeyboardShortcutsModal.tsx
 *
 * Canonical Keyboard Shortcuts Cheat Sheet Modal (Block 7: UI Shell / Modals Layer).
 * Location: `features/editor/ui/modals/KeyboardShortcutsModal.tsx`
 */

import React, { useState } from 'react';
import {
  Keyboard,
  Search,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

export interface ShortcutItem {
  id: string;
  label: string;
  category: 'Compilation' | 'Editing' | 'Navigation' | 'Layout';
  keys: string[];
  description?: string;
}

export const SHORTCUT_LIST: ShortcutItem[] = [
  // Compilation & PDF
  {
    id: 'compile',
    label: 'Compile',
    category: 'Compilation',
    keys: ['Ctrl', 'Enter'],
    description: 'Compile LaTeX document',
  },
  {
    id: 'download-pdf',
    label: 'Download PDF',
    category: 'Compilation',
    keys: ['Ctrl', 'D'],
    description: 'Download PDF file',
  },
  {
    id: 'download-zip',
    label: 'Export ZIP',
    category: 'Compilation',
    keys: ['Ctrl', 'Shift', 'D'],
    description: 'Download source (.zip)',
  },
  {
    id: 'focus-mode',
    label: 'Focus Mode',
    category: 'Compilation',
    keys: ['Ctrl', 'Shift', 'M'],
    description: 'Toggle fullscreen focus',
  },

  // Editing & LaTeX Formatting
  {
    id: 'bold',
    label: 'Bold',
    category: 'Editing',
    keys: ['Ctrl', 'B'],
    description: 'Bold text (\\textbf)',
  },
  {
    id: 'italic',
    label: 'Italic',
    category: 'Editing',
    keys: ['Ctrl', 'I'],
    description: 'Italic text (\\textit)',
  },
  {
    id: 'comment',
    label: 'Toggle Comment',
    category: 'Editing',
    keys: ['Ctrl', '/'],
    description: 'Comment line (%)',
  },
  {
    id: 'autocomplete',
    label: 'Autocomplete',
    category: 'Editing',
    keys: ['Ctrl', 'Space'],
    description: 'LaTeX commands & citations',
  },
  {
    id: 'undo',
    label: 'Undo',
    category: 'Editing',
    keys: ['Ctrl', 'Z'],
  },
  {
    id: 'redo',
    label: 'Redo',
    category: 'Editing',
    keys: ['Ctrl', 'Y'],
  },
  {
    id: 'format-code',
    label: 'Format Document',
    category: 'Editing',
    keys: ['Shift', 'Alt', 'F'],
    description: 'Format indentation & spacing',
  },
  {
    id: 'add-comment',
    label: 'Add Comment',
    category: 'Editing',
    keys: ['Ctrl', 'Alt', 'C'],
    description: 'Add review comment',
  },

  // Navigation & Search
  {
    id: 'quick-open',
    label: 'Quick Open',
    category: 'Navigation',
    keys: ['Ctrl', 'P'],
    description: 'Jump to file',
  },
  {
    id: 'find',
    label: 'Find',
    category: 'Navigation',
    keys: ['Ctrl', 'F'],
    description: 'Search in file',
  },
  {
    id: 'replace',
    label: 'Find & Replace',
    category: 'Navigation',
    keys: ['Ctrl', 'H'],
    description: 'Replace in file',
  },
  {
    id: 'goto-line',
    label: 'Go to Line',
    category: 'Navigation',
    keys: ['Ctrl', 'Shift', 'L'],
    description: 'Jump to line number (or Ctrl+G)',
  },
  {
    id: 'command-palette',
    label: 'Command Palette',
    category: 'Navigation',
    keys: ['F1'],
    description: 'Show all editor commands',
  },
  {
    id: 'shortcuts-help',
    label: 'Shortcuts',
    category: 'Navigation',
    keys: ['Ctrl', '/'],
    description: 'Open shortcuts modal',
  },

  // Layout & Views
  {
    id: 'history-mode',
    label: 'History',
    category: 'Layout',
    keys: ['Topbar', 'History'],
    description: 'Version history & diffs',
  },
  {
    id: 'split-view',
    label: 'Layout',
    category: 'Layout',
    keys: ['Topbar', 'Layout'],
    description: 'Switch editor & PDF layout',
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | 'Compilation' | 'Editing' | 'Navigation' | 'Layout'>('All');

  const filtered = SHORTCUT_LIST.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const q = search.trim().toLowerCase();
    const matchesQuery =
      !q ||
      item.label.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      item.keys.some((k) => k.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden bg-background border border-border/60 shadow-raised-400 rounded-lg text-foreground select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 shrink-0">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Keyboard className="size-4 text-foreground" strokeWidth={1.5} />
            Keyboard Shortcuts
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors cursor-pointer"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Keyboard shortcuts reference
        </DialogDescription>

        {/* Search & Category Filter */}
        <div className="px-5 py-3 border-b border-border/60 bg-background flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
            <Input
              type="text"
              placeholder="Search shortcut or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-2 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
            />
          </div>

          <div className="flex items-center rounded-md bg-muted/50 p-0.5 border border-border/60 text-11 w-full sm:w-auto overflow-x-auto shrink-0">
            {(['All', 'Compilation', 'Editing', 'Navigation', 'Layout'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-sm text-11 font-medium transition-colors cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-primary',
                  activeCategory === cat
                    ? 'bg-background text-foreground font-semibold border border-border/60'
                    : 'text-muted-foreground hover:text-foreground border border-transparent'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List: Open Hairlines without outer box */}
        <div className="max-h-[380px] overflow-y-auto px-5 divide-y divide-border/60">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No shortcuts matching "{search}"
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-2.5 px-1 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-12 font-medium text-foreground">
                      {s.label}
                    </span>
                    <Badge variant="outline" className="text-10 px-1 py-0 font-mono text-muted-foreground border-border/60">
                      {s.category}
                    </Badge>
                  </div>
                  {s.description && (
                    <p className="text-11 text-muted-foreground mt-0.5 truncate">
                      {s.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0 font-mono text-xs">
                  {s.keys.map((k, i) => (
                    <React.Fragment key={k}>
                      <kbd className="px-2 py-0.5 rounded-sm bg-muted/70 border border-border/60 text-11 font-medium text-foreground">
                        {k}
                      </kbd>
                      {i < s.keys.length - 1 && (
                        <span className="text-muted-foreground text-10">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer: Only Close button */}
        <div className="px-5 py-2.5 bg-background border-t border-border/60 flex items-center justify-end shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-12 font-medium"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
