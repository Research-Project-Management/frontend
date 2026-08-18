'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  RefreshCcw,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { Paper, Collection } from '../../../types/library.types';
import type { ReaderPanel } from '../../../types/reader.types';
import ChatPanel from './ChatPanel';
import InfoSection from '../../panel/sections/InfoSection';
import NotesPanel from './NotesPanel';

const PANEL_ICONS: Record<ReaderPanel, React.ReactNode> = {
  ai: <img src="/Chat.svg" alt="AI" className="size-4" />,
  details: <Info className="size-4 text-foreground" />,
  notes: <StickyNote className="size-4 text-foreground" />,
};

const PANEL_TITLES: Record<ReaderPanel, string> = {
  ai: 'AI',
  details: 'Details',
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
  const ragStatus = paper?.ragStatus ?? 'idle';

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex w-[min(100%,420px)] flex-col border-l border-border bg-background shadow-lg lg:relative lg:w-auto lg:shadow-none"
      style={{ width: `min(100%, ${panelWidth}px)` }}
    >
      {/* Resize handle */}
      <div
        className={cn(
          'absolute left-[-4px] top-0 z-20 hidden h-full w-2 cursor-col-resize items-center justify-center lg:flex',
          isResizing && 'bg-primary/5',
        )}
        onMouseDown={onResizeMouseDown}
      >
        <div
          className={cn(
            'h-full w-px transition-colors',
            isResizing ? 'bg-primary' : 'bg-transparent hover:bg-primary/40',
          )}
        />
      </div>

      {/* Panel header */}
      <div className="flex h-[53px] shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          {PANEL_ICONS[activePanel]}
          <h2 className="truncate text-sm font-semibold text-foreground">
            {PANEL_TITLES[activePanel]}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {activePanel === 'ai' && paper?.ragDocId && (
            showClearConfirm ? (
              <div className="flex h-7 items-center gap-0.5 rounded-md border border-destructive/20 bg-destructive/10 px-1 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('clear-reader-chat'));
                    setShowClearConfirm(false);
                  }}
                  title="Confirm clear conversation"
                  className="flex size-5 items-center justify-center rounded text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <Check className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  title="Cancel"
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-secondary transition-colors"
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
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            )
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setActivePanel(null)}
            aria-label="Close panel"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {/* AI panel */}
        <div className={cn('h-full', activePanel !== 'ai' && 'hidden')}>
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-primary/60" />
            </div>
          ) : paper?.ragDocId ? (
            <ChatPanel
              ragDocId={paper.ragDocId}
              paperTitle={paper.title}
              selectionContext={selectionContext ?? ''}
              onClearSelectionContext={clearSelectionContext}
              showHeader={false}
              autoFocus={activePanel === 'ai'}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-card">
                {ragStatus === 'pending' ? (
                  <Loader2 className="size-6 animate-spin text-primary" />
                ) : ragStatus === 'failed' ? (
                  <AlertTriangle className="size-6 text-destructive" />
                ) : (
                  <img src="/Chat.svg" alt="AI" className="size-7" />
                )}
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {ragStatus === 'pending'
                  ? 'Indexing this paper'
                  : ragStatus === 'failed'
                    ? 'Indexing failed'
                    : 'Index to chat with AI'}
              </h3>
              <p className="mt-2 max-w-64 text-xs leading-relaxed text-muted-foreground">
                {ragStatus === 'pending'
                  ? 'AI is preparing the document. This panel will unlock when indexing finishes.'
                  : 'AI needs an indexed copy of the PDF before it can answer with paper context.'}
              </p>
              {ragStatus !== 'pending' ? (
                <Button className="mt-4" size="sm" onClick={onReindex} disabled={isReindexing}>
                  {isReindexing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
                  {ragStatus === 'failed' ? 'Retry index' : 'Index paper'}
                </Button>
              ) : null}
            </div>
          )}
        </div>

        {/* Details panel */}
        <div className={cn('h-full overflow-y-auto p-4', activePanel !== 'details' && 'hidden')}>
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
