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
import type { Paper } from '../../../types/library.types';
import type { ReaderPanel } from '../../../types/reader.types';

// ── Status Helpers ──────────────────────────────────────────

function RagStatusIndicator({ status }: { status: string }) {
  if (status === 'indexed') {
    return (
      <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-muted-foreground border border-border/40 bg-muted/20">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        <span>Indexed</span>
      </div>
    );
  }

  if (status === 'pending' || status === 'indexing') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20 bg-amber-500/10">
        <Loader2 className="size-3 animate-spin" />
        <span>Indexing</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-destructive border border-destructive/20 bg-destructive/10">
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
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onToggle(panel)}
            className={cn(
              'relative flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground cursor-pointer',
              active && 'bg-background text-foreground shadow-xs font-medium',
            )}
            aria-pressed={active}
            aria-label={label}
          >
            <Icon className="size-3.5" />
            {count ? (
              <span className="absolute -right-1 -top-1 min-w-3.5 h-3.5 flex items-center justify-center rounded-full border border-background bg-primary px-1 text-[8px] font-semibold text-primary-foreground leading-none">
                {count}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs flex items-center gap-1.5">
          <span>{label}</span>
          {shortcut && <kbd className="text-[10px] opacity-60 font-mono">{shortcut}</kbd>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Props ────────────────────────────────────────────────────

interface TopbarProps {
  paper: Paper | null;
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
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onBack}
                aria-label="Back to library"
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <ChevronLeft className="size-4" />
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
              className="h-6 w-full rounded border border-primary/40 bg-background px-1.5 text-xs font-semibold leading-tight text-foreground outline-none focus:ring-1 focus:ring-primary/20"
              autoFocus
            />
          ) : (
            <h1
              className="truncate text-xs font-semibold leading-tight text-foreground cursor-pointer hover:text-foreground/80 transition-colors"
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
          <p className="truncate text-[11px] text-muted-foreground leading-none mt-0.5">
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
            className="hidden sm:inline-flex h-7 text-xs font-medium gap-1.5 px-2.5 shadow-none cursor-pointer"
          >
            {isReindexing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCcw className="size-3 text-muted-foreground" />}
            <span>{ragStatus === 'failed' ? 'Retry index' : 'Index'}</span>
          </Button>
        )}

        {/* Download PDF */}
        {paperUrl && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7 text-muted-foreground hover:text-foreground cursor-pointer" asChild>
                  <a href={paperUrl} download={paper?.filename || 'document.pdf'} aria-label="Download document">
                    <Download className="size-3.5" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Download document</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* BibTeX */}
        {paper && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBibtexOpen(true)}
                  className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Export BibTeX"
                >
                  <FileJson className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs flex items-center gap-1">
                <span>Export BibTeX</span>
                <kbd className="text-[10px] opacity-60 font-mono">⌘B</kbd>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Separator orientation="vertical" className="mx-0.5 h-4" />

        {/* Segmented panel toggles */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
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
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer ml-0.5"
                onClick={() => setActivePanel((current: ReaderPanel | null) => (current ? null : 'details'))}
                aria-label={activePanel ? 'Close panel' : 'Open details'}
              >
                {activePanel ? <PanelRightClose className="size-3.5" /> : <PanelRightOpen className="size-3.5" />}
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
