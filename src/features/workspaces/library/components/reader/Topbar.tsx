'use client';

import React from 'react';
import {
  ChevronLeft,
  Download,
  FileJson,
  Info,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  RefreshCcw,
  StickyNote,
  Highlighter,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import type { CatalogItem } from '../../types/library.types';
import type { ReaderPanel } from '../../types/reader.types';

// ── Status Helpers ──────────────────────────────────────────

function RagStatusIndicator({ status }: { status: string }) {
  if (status === 'indexed') {
    return (
      <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-mono font-medium text-foreground border border-border/60 bg-muted">
        <span className="size-1.5 rounded-full bg-primary" />
        <span>Indexed</span>
      </div>
    );
  }

  if (status === 'pending' || status === 'indexing') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-mono font-medium text-foreground border border-border/60 bg-muted">
        <Loader2 className="size-3 animate-spin text-foreground" />
        <span>Indexing</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-mono font-medium text-destructive border border-destructive/30 bg-destructive/10">
        <span className="size-1.5 rounded-full bg-destructive" />
        <span>Index failed</span>
      </div>
    );
  }

  return null;
}

function PanelButton({
  panel,
  activePanel,
  onToggle,
  icon: Icon,
  label,
  shortcut,
  count,
}: {
  panel: ReaderPanel;
  activePanel: ReaderPanel | null;
  onToggle: (panel: ReaderPanel) => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  count?: number;
}) {
  const active = activePanel === panel;
  return (
    <TooltipProvider delayDuration={700}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onToggle(panel)}
            className={cn(
              'relative flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background cursor-pointer',
              active && 'bg-background text-foreground shadow-none border border-border/60 font-medium',
            )}
            aria-pressed={active}
            aria-label={label}
          >
            <Icon className="size-3.5" />
            {count ? (
              <span className="absolute -right-1 -top-1 min-w-3.5 h-3.5 flex items-center justify-center rounded-full border border-background bg-primary px-1 text-xs font-semibold text-primary-foreground leading-none">
                {count}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs flex items-center gap-1.5">
          <span>{label}</span>
          {shortcut && <kbd className="text-xs opacity-60 font-mono">{shortcut}</kbd>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Props ────────────────────────────────────────────────────

interface TopbarProps {
  paper: CatalogItem | null;
  paperUrl: string | null;
  activePanel: ReaderPanel | null;
  isReindexing: boolean;
  isEditingTitle: boolean;
  draftTitle: string;
  setActivePanel: (updater: ReaderPanel | null | ((current: ReaderPanel | null) => ReaderPanel | null)) => void;
  setIsEditingTitle: (v: boolean) => void;
  setDraftTitle: (v: string) => void;
  setBibtexOpen: (v: boolean) => void;
  onPanelToggle: (panel: ReaderPanel) => void;
  onReindex: () => void;
  onTitleSave: () => void;
  onBack: () => void;
}

// ── Component ────────────────────────────────────────────────

export default function Topbar({
  paper,
  paperUrl,
  activePanel,
  isReindexing,
  isEditingTitle,
  draftTitle,
  setActivePanel,
  setIsEditingTitle,
  setDraftTitle,
  setBibtexOpen,
  onPanelToggle,
  onReindex,
  onTitleSave,
  onBack,
}: TopbarProps) {
  const ragStatus = paper?.ragStatus ?? 'idle';

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-3 select-none">
      {/* Left: back + paper title & metadata */}
      <div className="flex min-w-0 flex-1 items-center gap-2 pr-3">
        <TooltipProvider delayDuration={700}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onBack}
                aria-label="Back to library"
                className="size-7 text-foreground hover:bg-muted cursor-pointer"
              >
                <ChevronLeft className="size-4 text-foreground shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Back to library</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="min-w-0 max-w-[40vw] md:max-w-[50vw] lg:max-w-[600px]">
          {isEditingTitle && paper ? (
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={onTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onTitleSave();
                if (e.key === 'Escape') {
                  setDraftTitle(paper.title);
                  setIsEditingTitle(false);
                }
              }}
              className="h-6 w-full rounded-sm border border-border/60 bg-background px-1.5 text-[13px] font-medium leading-tight text-foreground outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          ) : (
            <h1
              className="truncate text-[13px] font-medium leading-tight text-foreground cursor-pointer hover:opacity-80 transition-opacity"
              title={paper?.title ? `${paper.title} (Double-click to rename)` : undefined}
              onDoubleClick={() => {
                if (!paper) return;
                setDraftTitle(paper.title);
                setIsEditingTitle(true);
              }}
            >
              {paper?.title || 'Loading document...'}
            </h1>
          )}
          <p className="truncate text-xs text-muted-foreground leading-none mt-0.5">
            {paper?.authors?.length
              ? paper.authors.slice(0, 3).join(', ') + (paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : '')
              : paper?.publicationTitle || (paper?.year ? String(paper.year) : 'Reference')}
          </p>
        </div>
      </div>

      {/* Right: actions + panel toggles */}
      <div className="flex shrink-0 items-center gap-1.5">
        {/* Status Indicator */}
        {paper ? <RagStatusIndicator status={ragStatus} /> : null}

        {/* Index / Retry button */}
        {paper && ragStatus !== 'pending' && ragStatus !== 'indexed' && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReindex}
            disabled={isReindexing}
            className="hidden sm:inline-flex h-7 text-xs font-medium gap-1.5 px-2.5 shadow-none cursor-pointer text-foreground rounded-md border-border/60"
          >
            {isReindexing ? <Loader2 className="size-3 animate-spin text-foreground" /> : <RefreshCcw className="size-3 text-foreground" />}
            <span>{ragStatus === 'failed' ? 'Retry index' : 'Index'}</span>
          </Button>
        )}

        {/* Download PDF */}
        {paperUrl && (
          <TooltipProvider delayDuration={700}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7 text-foreground hover:bg-muted cursor-pointer rounded-sm" asChild>
                  <a href={paperUrl} download={paper?.filename || 'document.pdf'} aria-label="Download document">
                    <Download className="size-3.5 text-foreground shrink-0" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Download document</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* BibTeX */}
        {paper && (
          <TooltipProvider delayDuration={700}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBibtexOpen(true)}
                  className="size-7 text-foreground hover:bg-muted cursor-pointer rounded-sm"
                  aria-label="Export BibTeX"
                >
                  <FileJson className="size-3.5 text-foreground shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs flex items-center gap-1">
                <span>Export BibTeX</span>
                <kbd className="text-xs opacity-60 font-mono">⌘B</kbd>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Separator orientation="vertical" className="mx-0.5 h-4" />

        {/* Segmented panel toggles */}
        <div className="flex items-center gap-0.5 rounded-md border border-border/60 bg-muted/40 p-0.5">
          <PanelButton
            panel="ai"
            activePanel={activePanel}
            onToggle={onPanelToggle}
            icon={MessageSquare}
            label="Assistant"
            shortcut="⌘⇧A"
          />
          <PanelButton
            panel="details"
            activePanel={activePanel}
            onToggle={onPanelToggle}
            icon={Info}
            label="Info"
            shortcut="⌘⇧D"
          />
          <PanelButton
            panel="notes"
            activePanel={activePanel}
            onToggle={onPanelToggle}
            icon={StickyNote}
            label="Notes"
            shortcut="⌘⇧N"
            count={paper?.notes?.length}
          />
          <PanelButton
            panel="annotations"
            activePanel={activePanel}
            onToggle={onPanelToggle}
            icon={Highlighter}
            label="Annotations"
            shortcut="⌘⇧H"
          />
        </div>

        {/* Expand/Collapse sidebar toggle */}
        <TooltipProvider delayDuration={700}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 text-foreground hover:bg-muted cursor-pointer ml-0.5 rounded-sm"
                onClick={() => setActivePanel((current: ReaderPanel | null) => (current ? null : 'details'))}
                aria-label={activePanel ? 'Close panel' : 'Open details'}
              >
                {activePanel ? <PanelRightClose className="size-3.5 text-foreground" /> : <PanelRightOpen className="size-3.5 text-foreground" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {activePanel ? 'Close panel (Esc)' : 'Open panel'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}


