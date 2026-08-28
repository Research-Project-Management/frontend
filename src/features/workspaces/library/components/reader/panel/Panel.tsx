'use client';

import React, { useState } from 'react';
import {
  Check,
  Info,
  Loader2,
  MessageSquare,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { Paper, Collection } from '../../../types/library.types';
import type { ReaderPanel } from '../../../types/reader.types';
import { CopilotDrawer } from '../../copilot/CopilotDrawer';
import InfoSection from '../../panel/sections/InfoSection';
import NotesPanel from './NotesPanel';

const PANEL_ICONS: Record<ReaderPanel, React.ComponentType<{ className?: string }>> = {
  ai: MessageSquare,
  details: Info,
  notes: StickyNote,
};

const PANEL_TITLES: Record<ReaderPanel, string> = {
  ai: 'Assistant',
  details: 'Info',
  notes: 'Notes',
};

// ── Props ────────────────────────────────────────────────────

interface SidebarProps {
  paper: Paper | null;
  collection: Collection | null;
  workspaceId: string;
  activePanel: ReaderPanel;
  panelWidth: number;
  isResizing: boolean;
  isLoading: boolean;
  isReindexing: boolean;
  selectionContext: string | null;
  pendingNoteText?: string;
  clearSelectionContext: () => void;
  clearPendingNoteText?: () => void;
  setActivePanel: (v: ReaderPanel | null) => void;
  onReindex: () => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}

// ── Component ────────────────────────────────────────────────

export default function Sidebar({
  paper,
  collection,
  workspaceId,
  activePanel,
  panelWidth,
  isResizing,
  isLoading,
  isReindexing,
  selectionContext,
  pendingNoteText,
  clearSelectionContext,
  clearPendingNoteText,
  setActivePanel,
  onReindex,
  onResizeMouseDown,
}: SidebarProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const IconComponent = PANEL_ICONS[activePanel];

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex w-[min(100%,420px)] flex-col border-l border-border bg-background lg:relative lg:w-auto"
      style={{ width: `min(100%, ${panelWidth}px)` }}
    >
      {/* Resize handle */}
      <div
        className={cn(
          'absolute left-[-3px] top-0 z-20 hidden h-full w-1.5 cursor-col-resize items-center justify-center lg:flex group',
          isResizing && 'bg-primary/10',
        )}
        onMouseDown={onResizeMouseDown}
      >
        <div
          className={cn(
            'h-full w-px transition-colors',
            isResizing ? 'bg-primary' : 'bg-transparent group-hover:bg-border',
          )}
        />
      </div>

      {/* Panel header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3.5 select-none">
        <div className="flex min-w-0 items-center gap-2">
          {IconComponent && <IconComponent className="size-4 text-muted-foreground" />}
          <h2 className="truncate text-xs font-semibold text-foreground">
            {PANEL_TITLES[activePanel]}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {activePanel === 'ai' && paper?.ragDocId && (
            showClearConfirm ? (
              <div className="flex h-6 items-center gap-0.5 rounded border border-destructive/30 bg-destructive/10 px-1 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('clear-reader-chat'));
                    setShowClearConfirm(false);
                  }}
                  title="Confirm clear conversation"
                  aria-label="Confirm clear conversation"
                  className="flex size-4.5 items-center justify-center rounded text-destructive hover:bg-destructive/20 transition-colors cursor-pointer"
                >
                  <Check className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  title="Cancel"
                  aria-label="Cancel"
                  className="flex size-4.5 items-center justify-center rounded text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowClearConfirm(true)}
                title="Clear conversation"
                aria-label="Clear conversation"
                className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </Button>
            )
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setActivePanel(null)}
            aria-label="Close panel"
            className="size-6 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {/* Assistant panel */}
        <div className={cn('h-full', activePanel !== 'ai' && 'hidden')}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : paper ? (
            <CopilotDrawer
              paperId={paper.id}
              paperTitle={paper.title || 'Document'}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center text-muted-foreground text-xs">
              No document selected
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className={cn('h-full overflow-y-auto p-3.5', activePanel !== 'details' && 'hidden')}>
          {paper ? <InfoSection paper={paper} /> : null}
        </div>

        {/* Notes panel */}
        <div className={cn('h-full', activePanel !== 'notes' && 'hidden')}>
          {paper ? (
            <NotesPanel
              paper={paper}
              workspaceId={workspaceId}
              pendingText={pendingNoteText}
              onClearPendingText={clearPendingNoteText}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
