'use client';

import React from 'react';
import { ArrowLeft, GitBranch, PanelLeft, PanelRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface HistoryHeaderProps {
  projectTitle: string;
  isLeftPaneOpen: boolean;
  isRightPaneOpen: boolean;
  onToggleLeftPane: () => void;
  onToggleRightPane: () => void;
  onClose: () => void;
}

export function HistoryHeader({
  projectTitle,
  isLeftPaneOpen,
  isRightPaneOpen,
  onToggleLeftPane,
  onToggleRightPane,
  onClose,
}: HistoryHeaderProps) {
  return (
    <header className="h-11 border-b border-border bg-background flex items-center justify-between px-3 shrink-0 text-foreground select-none">
      {/* Left: Back button & Left pane toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to editor"
          className="flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-muted hover:bg-muted/80 text-foreground text-12 font-medium transition-colors cursor-pointer outline-none border border-border focus-visible:ring-1 focus-visible:ring-primary"
        >
          <ArrowLeft className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Back to editor</span>
        </button>

        <button
          type="button"
          onClick={onToggleLeftPane}
          aria-label={isLeftPaneOpen ? 'Hide changed files pane' : 'Show changed files pane'}
          title={isLeftPaneOpen ? 'Hide changed files' : 'Show changed files'}
          className={cn(
            'size-7 flex items-center justify-center rounded-md border border-border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
            isLeftPaneOpen
              ? 'bg-muted text-foreground'
              : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <PanelLeft className="size-3.5 shrink-0" />
        </button>
      </div>

      {/* Center: Title */}
      <div className="flex items-center gap-1.5 text-13 font-heading font-semibold text-foreground/90 truncate max-w-md">
        <GitBranch className="size-3.5 text-primary shrink-0" />
        <span className="truncate">{projectTitle || 'Project History'}</span>
        <span className="text-11 font-mono font-normal text-muted-foreground shrink-0 hidden md:inline">
          / Version History
        </span>
      </div>

      {/* Right: Timeline pane toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleRightPane}
          aria-label={isRightPaneOpen ? 'Hide timeline pane' : 'Show timeline pane'}
          title={isRightPaneOpen ? 'Hide timeline' : 'Show timeline'}
          className={cn(
            'size-7 flex items-center justify-center rounded-md border border-border transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary',
            isRightPaneOpen
              ? 'bg-muted text-foreground'
              : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <PanelRight className="size-3.5 shrink-0" />
        </button>
      </div>
    </header>
  );
}

export default HistoryHeader;
