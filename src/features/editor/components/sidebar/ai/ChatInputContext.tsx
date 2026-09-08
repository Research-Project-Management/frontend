'use client';

import React from 'react';
import { FileCode2, Pin, X, Zap } from 'lucide-react';
import { SLASH_COMMANDS, type SlashCommand } from '@/features/editor/utils/ai.util';

export type SelectionContext = {
  text: string;
  startLine: number;
  endLine: number;
  label?: string;
  charCount?: number;
  wordCount?: number;
  section?: string | null;
  environment?: string | null;
};

interface SelectionContextBadgeProps {
  context: SelectionContext;
  filename: string;
  rangeLabel: string;
  wordCount: number;
  charCount: number;
  text: string;
  isPinned: boolean;
  onTogglePin: () => void;
}

export function SelectionContextBadge({
  context,
  filename,
  rangeLabel,
  wordCount,
  charCount,
  text,
  isPinned,
  onTogglePin,
}: SelectionContextBadgeProps) {
  return (
    <div className="mb-2 group relative">
      <div className="flex items-center gap-1.5 min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-muted">
        <FileCode2 className="size-3 text-primary/60 shrink-0" />
        <span className="text-xs font-mono text-muted-foreground truncate">
          {filename}
        </span>
        <span className="text-xs font-mono text-primary/80 shrink-0">
          {rangeLabel}
        </span>
        <span className="text-xs text-muted-foreground/45 shrink-0">
          {wordCount}w
        </span>
        <button
          type="button"
          onClick={onTogglePin}
          title={isPinned ? 'Clear selection context' : 'Pin selection context'}
          aria-label={isPinned ? 'Clear selection context' : 'Pin selection context'}
          className="ml-auto p-px rounded text-foreground hover:bg-muted transition-colors"
        >
          {isPinned ? (
            <X className="size-2.5 shrink-0" />
          ) : (
            <Pin className="size-2.5 shrink-0" />
          )}
        </button>
      </div>
      <div className="absolute bottom-full left-0 right-0 mb-1 hidden group-hover:block z-50 pointer-events-none">
        <div className="bg-popover border border-border rounded-lg p-2.5 text-xs font-mono">
          <div className="flex items-center gap-1.5 mb-1.5">
            {'section' in context && context.section && (
              <span className="px-1.5 py-px rounded-full bg-primary/10 text-primary border border-primary/20">
                {context.section}
              </span>
            )}
            {'environment' in context && context.environment && (
              <span className="px-1.5 py-px rounded-full bg-primary/10 text-primary border border-primary/20">
                \{context.environment}
              </span>
            )}
            <span className="ml-auto text-muted-foreground/40">{charCount}ch</span>
          </div>
          <pre className="text-muted-foreground/70 max-h-28 overflow-auto whitespace-pre-wrap leading-relaxed">
            {text}
          </pre>
        </div>
      </div>
    </div>
  );
}

interface SlashCommandMenuProps {
  open: boolean;
  filter: string;
  onSelect: (command: SlashCommand) => void;
}

export function SlashCommandMenu({
  open,
  filter,
  onSelect,
}: SlashCommandMenuProps) {
  if (!open) return null;

  return (
    <div className="absolute bottom-full left-3 right-3 mb-1 bg-popover border border-border rounded-lg overflow-hidden z-50 animate-in fade-in-0 slide-in-from-bottom-2 duration-150">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground">
          Editor Commands
        </p>
      </div>
      {SLASH_COMMANDS.filter((c) =>
        c.cmd.slice(1).startsWith(filter),
      ).map((c) => (
        <button
          key={c.cmd}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(c);
          }}
          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-left transition-colors cursor-pointer"
        >
          <span className="text-xs font-mono text-primary w-20 shrink-0">
            {c.cmd}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {c.description}
          </span>
        </button>
      ))}
    </div>
  );
}

interface ActiveCommandChipProps {
  command: SlashCommand | null;
  onRemove: () => void;
}

export function ActiveCommandChip({
  command,
  onRemove,
}: ActiveCommandChipProps) {
  if (!command) return null;

  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
        <Zap className="size-2.5 shrink-0" />
        {command.cmd}
      </span>
      <span className="text-xs text-muted-foreground/50">
        {command.description}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove active command"
        className="ml-auto text-foreground hover:bg-muted"
      >
        <X className="size-2.5 shrink-0" />
      </button>
    </div>
  );
}
