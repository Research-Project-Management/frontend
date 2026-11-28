'use client';

import React, { useState, useMemo } from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { cn } from '@/shared/lib/utils';

export type ShortcutCategory = 'Compilation' | 'Editing' | 'Navigation' | 'Layout';

export interface ShortcutItem {
  id: string;
  label: string;
  category: ShortcutCategory;
  keys: string[];
}

const CATEGORIES: readonly ShortcutCategory[] = [
  'Compilation',
  'Editing',
  'Navigation',
  'Layout',
];

export const SHORTCUT_LIST: ShortcutItem[] = [
  // Compilation
  { id: 'compile', label: 'Compile', category: 'Compilation', keys: ['Ctrl', 'Enter'] },
  { id: 'download-pdf', label: 'Download PDF', category: 'Compilation', keys: ['Ctrl', 'D'] },
  { id: 'download-zip', label: 'Export ZIP', category: 'Compilation', keys: ['Ctrl', 'Shift', 'D'] },
  { id: 'word-count', label: 'Word Count', category: 'Compilation', keys: ['Ctrl', 'Shift', 'W'] },

  // Editing
  { id: 'bold', label: 'Bold', category: 'Editing', keys: ['Ctrl', 'B'] },
  { id: 'italic', label: 'Italic', category: 'Editing', keys: ['Ctrl', 'I'] },
  { id: 'underline', label: 'Underline', category: 'Editing', keys: ['Ctrl', 'U'] },
  { id: 'comment', label: 'Toggle Comment', category: 'Editing', keys: ['Ctrl', '/'] },
  { id: 'autocomplete', label: 'Autocomplete', category: 'Editing', keys: ['Ctrl', 'Space'] },
  { id: 'undo', label: 'Undo', category: 'Editing', keys: ['Ctrl', 'Z'] },
  { id: 'redo', label: 'Redo', category: 'Editing', keys: ['Ctrl', 'Y'] },
  { id: 'inline-math', label: 'Inline Math ($...$)', category: 'Editing', keys: ['$'] },
  { id: 'citation-picker', label: 'Insert Citation', category: 'Editing', keys: ['Ctrl', 'Shift', 'K'] },
  { id: 'table-wizard', label: 'Insert Table / Matrix', category: 'Editing', keys: ['Ctrl', 'Shift', 'T'] },
  { id: 'add-comment', label: 'Add Comment', category: 'Editing', keys: ['Ctrl', 'Alt', 'M'] },
  { id: 'fold-code', label: 'Fold Section', category: 'Editing', keys: ['Ctrl', 'Alt', '['] },
  { id: 'unfold-code', label: 'Unfold Section', category: 'Editing', keys: ['Ctrl', 'Alt', ']'] },
  { id: 'fold-all', label: 'Fold All', category: 'Editing', keys: ['Ctrl', 'Alt', 'Shift', '['] },
  { id: 'unfold-all', label: 'Unfold All', category: 'Editing', keys: ['Ctrl', 'Alt', 'Shift', ']'] },

  // Navigation
  { id: 'quick-open', label: 'Quick Open File', category: 'Navigation', keys: ['Ctrl', 'P'] },
  { id: 'find', label: 'Find', category: 'Navigation', keys: ['Ctrl', 'F'] },
  { id: 'replace', label: 'Find & Replace', category: 'Navigation', keys: ['Ctrl', 'H'] },
  { id: 'search-files', label: 'Search in Files', category: 'Navigation', keys: ['Ctrl', 'Shift', 'F'] },
  { id: 'goto-line', label: 'Go to Line', category: 'Navigation', keys: ['Ctrl', 'G'] },
  { id: 'synctex-forward', label: 'Jump to PDF', category: 'Navigation', keys: ['Ctrl', 'Alt', 'J'] },
  { id: 'next-error', label: 'Next Error', category: 'Navigation', keys: ['F8'] },
  { id: 'prev-error', label: 'Previous Error', category: 'Navigation', keys: ['Shift', 'F8'] },
  { id: 'command-palette', label: 'Command Palette', category: 'Navigation', keys: ['F1'] },

  // Layout
  { id: 'focus-mode', label: 'Focus Mode', category: 'Layout', keys: ['Ctrl', 'Shift', 'M'] },
  { id: 'toggle-editor-mode', label: 'Switch Source / Visual', category: 'Layout', keys: ['Ctrl', 'Shift', 'V'] },
  { id: 'toggle-split-editor', label: 'Split Editor', category: 'Layout', keys: ['Ctrl', '\\'] },
  { id: 'toggle-ai-panel', label: 'Toggle AI Panel', category: 'Layout', keys: ['Ctrl', 'J'] },
];

export interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  const [activeCategory, setActiveCategory] = useState<'All' | ShortcutCategory>('All');

  const items = useMemo(
    () =>
      activeCategory === 'All'
        ? SHORTCUT_LIST
        : SHORTCUT_LIST.filter((item) => item.category === activeCategory),
    [activeCategory],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-[95vw] sm:max-w-[540px] h-[460px] max-h-[82vh] !flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border shadow-raised-200 rounded-xl text-foreground font-sans select-none"
      >
        {/* Header + Category Tabs (single divider) */}
        <div className="px-5 pt-4 pb-3 border-b border-border/60 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
              Keyboard Shortcuts
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors cursor-pointer"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
          <DialogDescription className="sr-only">
            Keyboard shortcuts reference
          </DialogDescription>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {(['All', ...CATEGORIES] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-11 font-medium transition-colors cursor-pointer whitespace-nowrap outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  activeCategory === cat
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Shortcuts List */}
        <div className="flex-1 min-h-0 overflow-y-scroll px-5 py-2 divide-y divide-border/50">
          {items.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between py-2 gap-4"
            >
              <span className="text-12 text-foreground truncate">
                {s.label}
              </span>
              <div className="flex items-center gap-1 shrink-0 font-mono">
                {s.keys.map((k, i) => (
                  <React.Fragment key={`${s.id}-${k}-${i}`}>
                    <kbd className="min-w-[22px] text-center px-1.5 py-0.5 rounded bg-muted border border-border/70 text-11 font-medium text-foreground">
                      {k}
                    </kbd>
                    {i < s.keys.length - 1 && (
                      <span className="text-muted-foreground text-11">+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsModal;
