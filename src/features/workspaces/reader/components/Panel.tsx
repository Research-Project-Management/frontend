'use client';

import React, { useState } from 'react';
import {
  Check,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import type { ReaderDocument, ReaderPanel } from '../types/reader.types';
import ChatPanel from './panel/ChatPanel';
import DocInfoPanel from './panel/DocInfoPanel';
import NotesPanel from './panel/NotesPanel';
import AnnotationsPanel from './panel/AnnotationsPanel';

interface TabItem {
  id: ReaderPanel;
  label: string;
  count?: number;
}

interface PanelProps {
  paper: ReaderDocument | null;
  workspaceId: string;
  activePanel: ReaderPanel;
  panelWidth: number;
  isResizing: boolean;
  isLoading: boolean;
  pendingNoteText?: string;
  clearPendingNoteText?: () => void;
  setActivePanel: (v: ReaderPanel | null) => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}

export default function Panel({
  paper,
  workspaceId,
  activePanel,
  panelWidth,
  isResizing,
  isLoading,
  pendingNoteText,
  clearPendingNoteText,
  setActivePanel,
  onResizeMouseDown,
}: PanelProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const tabs: TabItem[] = [
    {
      id: 'ai',
      label: 'Assistant',
    },
    {
      id: 'notes',
      label: 'Notes',
      count: paper?.notes?.length,
    },
    {
      id: 'details',
      label: 'Info',
    },
    {
      id: 'annotations',
      label: 'Marks',
    },
  ];

  return (
    <aside
      className="absolute inset-y-0 right-0 z-30 flex w-[min(100%,440px)] flex-col border-l border-border bg-background lg:relative lg:w-auto"
      style={{ width: `min(100%, ${panelWidth}px)` }}
    >
      {/* Resize handle: Flat 1px indicator */}
      <div
        className={cn(
          'absolute left-[-3px] top-0 z-20 hidden h-full w-1.5 cursor-col-resize items-center justify-center lg:flex group select-none',
          isResizing && 'bg-primary/10',
        )}
        onMouseDown={onResizeMouseDown}
        title="Drag to resize panel"
      >
        <div
          className={cn(
            'h-full w-px transition-colors',
            isResizing ? 'bg-primary' : 'bg-transparent group-hover:bg-primary/60',
          )}
        />
      </div>

      {/* Flat Header: Underline tab strip */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-2 select-none bg-background">
        <div className="flex items-center h-full gap-0.5" role="tablist" aria-label="Document tools">
          {tabs.map((tab) => {
            const active = activePanel === tab.id;
            return (
              <button
                key={tab.id}
                id={`reader-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={active}
                aria-controls={`reader-panel-${tab.id}`}
                onClick={() => setActivePanel(tab.id)}
                className={cn(
                  'relative flex items-center gap-1.5 h-full px-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{tab.label}</span>
                {tab.count ? (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    ({tab.count})
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {activePanel === 'ai' && paper?.ragDocId && (
            showClearConfirm ? (
              <div className="flex h-6 items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('clear-reader-chat'));
                    setShowClearConfirm(false);
                  }}
                  title="Confirm clear"
                  aria-label="Confirm clear"
                  className="flex size-5 items-center justify-center rounded text-destructive hover:bg-destructive/20 focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none transition-colors cursor-pointer"
                >
                  <Check className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  title="Cancel"
                  aria-label="Cancel"
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <TooltipProvider delayDuration={500}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowClearConfirm(true)}
                      aria-label="Clear chat"
                      className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 focus-visible:ring-1 focus-visible:ring-destructive focus-visible:outline-none cursor-pointer rounded-sm"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Clear conversation
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          )}

          <TooltipProvider delayDuration={500}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setActivePanel(null)}
                  aria-label="Close panel"
                  className="size-7 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none cursor-pointer rounded-sm"
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Close panel
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {/* Assistant panel */}
        <div
          id="reader-panel-ai"
          role="tabpanel"
          aria-labelledby="reader-tab-ai"
          className={cn('h-full', activePanel !== 'ai' && 'hidden')}
        >
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : paper ? (
            <ChatPanel
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
        <div
          id="reader-panel-details"
          role="tabpanel"
          aria-labelledby="reader-tab-details"
          className={cn('h-full overflow-y-auto p-3.5', activePanel !== 'details' && 'hidden')}
        >
          {paper ? <DocInfoPanel paper={paper} /> : null}
        </div>

        {/* Notes panel */}
        <div
          id="reader-panel-notes"
          role="tabpanel"
          aria-labelledby="reader-tab-notes"
          className={cn('h-full', activePanel !== 'notes' && 'hidden')}
        >
          {paper ? (
            <NotesPanel
              paper={paper}
              workspaceId={workspaceId}
              pendingText={pendingNoteText}
              onClearPendingText={clearPendingNoteText}
            />
          ) : null}
        </div>

        {/* Annotations panel */}
        <div
          id="reader-panel-annotations"
          role="tabpanel"
          aria-labelledby="reader-tab-annotations"
          className={cn('h-full', activePanel !== 'annotations' && 'hidden')}
        >
          {paper ? (
            <AnnotationsPanel
              paper={paper}
              workspaceId={workspaceId}
              attachmentId={paper.attachments?.[0]?.id}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
