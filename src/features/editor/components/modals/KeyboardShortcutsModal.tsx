'use client';

import React, { useState } from 'react';
import {
  Command,
  Search,
  Keyboard,
  FileCode,
  Eye,
  Edit3,
  Layers,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Input,
  Badge,
} from '@/shared/components/ui';
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
    label: 'Recompile Document',
    category: 'Compilation',
    keys: ['Ctrl', 'Enter'],
    description: 'Trigger incremental LaTeX compilation',
  },
  {
    id: 'download-pdf',
    label: 'Download PDF',
    category: 'Compilation',
    keys: ['Ctrl', 'D'],
    description: 'Download the compiled PDF file directly',
  },
  {
    id: 'download-zip',
    label: 'Download Project ZIP',
    category: 'Compilation',
    keys: ['Ctrl', 'Shift', 'D'],
    description: 'Download the full project source as a .zip file',
  },
  {
    id: 'focus-mode',
    label: 'Toggle Focus Mode',
    category: 'Compilation',
    keys: ['Ctrl', 'Shift', 'M'],
    description: 'Expand editor to full screen focus view',
  },

  // Editing & LaTeX Formatting
  {
    id: 'bold',
    label: 'Bold Text',
    category: 'Editing',
    keys: ['Ctrl', 'B'],
    description: 'Format selected text with \\textbf{...}',
  },
  {
    id: 'italic',
    label: 'Italic Text',
    category: 'Editing',
    keys: ['Ctrl', 'I'],
    description: 'Format selected text with \\textit{...}',
  },
  {
    id: 'comment',
    label: 'Toggle Comment',
    category: 'Editing',
    keys: ['Ctrl', '/'],
    description: 'Comment or uncomment line with %',
  },
  {
    id: 'autocomplete',
    label: 'Trigger Autocomplete',
    category: 'Editing',
    keys: ['Ctrl', 'Space'],
    description: 'Show LaTeX commands, symbols, and citations',
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
    description: 'Auto-format LaTeX code indentation and spacing',
  },
  {
    id: 'add-comment',
    label: 'Add Review Comment',
    category: 'Editing',
    keys: ['Ctrl', 'Alt', 'C'],
    description: 'Add a collaboration review comment to selection',
  },

  // Navigation & Search
  {
    id: 'quick-open',
    label: 'Quick Open File',
    category: 'Navigation',
    keys: ['Ctrl', 'P'],
    description: 'Jump to any file in project by name',
  },
  {
    id: 'find',
    label: 'Find in File',
    category: 'Navigation',
    keys: ['Ctrl', 'F'],
    description: 'Open in-editor search bar',
  },
  {
    id: 'replace',
    label: 'Find and Replace',
    category: 'Navigation',
    keys: ['Ctrl', 'H'],
    description: 'Open in-editor replace bar',
  },
  {
    id: 'goto-line',
    label: 'Go to Line',
    category: 'Navigation',
    keys: ['Ctrl', 'G'],
    description: 'Jump directly to line number',
  },
  {
    id: 'command-palette',
    label: 'Monaco Command Palette',
    category: 'Navigation',
    keys: ['F1'],
    description: 'Show all editor actions and configurations',
  },
  {
    id: 'shortcuts-help',
    label: 'Show Keyboard Shortcuts',
    category: 'Navigation',
    keys: ['Ctrl', '/'],
    description: 'Open this keyboard shortcuts cheat sheet',
  },

  // Layout & Views
  {
    id: 'history-mode',
    label: 'Project History',
    category: 'Layout',
    keys: ['Topbar', 'History'],
    description: 'Open full-screen 3-column version diff viewer',
  },
  {
    id: 'split-view',
    label: 'Toggle Split View',
    category: 'Layout',
    keys: ['Topbar', 'Layout'],
    description: 'Switch between Split, Editor-only, and PDF-only',
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
      <DialogContent className="max-w-2xl w-full p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-lg text-foreground select-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
          <div>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Keyboard className="size-4 text-foreground" />
              Keyboard Shortcuts Cheat Sheet
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Quick reference for productivity hotkeys matching Overleaf and modern LaTeX IDEs.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Search & Category Filter */}
        <div className="p-4 border-b border-border bg-background flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search shortcut or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-2 text-xs rounded-md border-border"
            />
          </div>

          <div className="flex items-center rounded-md bg-muted p-0.5 border border-border text-11 w-full sm:w-auto overflow-x-auto">
            {(['All', 'Compilation', 'Editing', 'Navigation', 'Layout'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-sm text-11 font-medium transition-colors cursor-pointer whitespace-nowrap',
                  activeCategory === cat
                    ? 'bg-background text-foreground shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="max-h-[380px] overflow-y-auto p-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No shortcuts matching "{search}"
            </div>
          ) : (
            filtered.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-2.5 rounded-md border border-border/60 hover:border-border hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {s.label}
                    </span>
                    <Badge variant="outline" className="text-10 px-1 py-0 font-mono text-muted-foreground">
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
                      <kbd className="px-2 py-0.5 rounded-sm bg-muted border border-border shadow-2xs text-11 font-semibold text-foreground">
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

        {/* Footer */}
        <div className="px-6 py-3 bg-background border-t border-border flex items-center justify-between text-11 text-muted-foreground">
          <span>Tip: On macOS, use ⌘ Command instead of Ctrl.</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-3 py-1 text-xs font-medium rounded-md hover:bg-muted transition-colors cursor-pointer text-foreground"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
