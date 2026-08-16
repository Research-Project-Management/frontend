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
} from 'lucide-react';
import { Badge, Button, Separator } from '@/shared/components/ui';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui';
import { cn } from '@/shared/lib/utils';
import type { Paper } from '../../../types/library.types';
import type { ReaderPanel } from '../../../types/reader.types';

// ── Helpers ──────────────────────────────────────────────────

const RAG_STYLES: Record<string, string> = {
  indexed: 'border-border bg-muted text-muted-foreground',
  pending: 'border-[#f9ab00]/25 bg-[#f9ab00]/10 text-[#9a6700]',
  failed: 'border-destructive/20 bg-destructive/10 text-destructive',
  idle: 'border-border bg-muted text-muted-foreground',
};

const RAG_LABELS: Record<string, string> = {
  indexed: 'Indexed',
  pending: 'Indexing',
  failed: 'Index failed',
  idle: 'Not indexed',
};

function PanelButton({
  panel,
  activePanel,
  onToggle,
  icon: Icon,
  label,
  count,
}: {
  panel: ReaderPanel;
  activePanel: ReaderPanel | null;
  onToggle: (panel: ReaderPanel) => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
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
              'relative flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
              active && 'bg-accent text-primary',
            )}
            aria-pressed={active}
          >
            <Icon className="size-4" />
            {count ? (
              <span className="absolute -right-1 -top-1 min-w-4 rounded-full border border-background bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
                {count}
              </span>
            ) : null}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
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
    <header className="flex h-[53px] shrink-0 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur">
      {/* Left: back + title */}
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to library">
          <ChevronLeft className="size-4" />
        </Button>

        <div className="min-w-0 max-w-[34vw] sm:max-w-[42vw] lg:max-w-[520px] xl:max-w-[640px]">
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
              className="h-7 w-full rounded-md border border-primary/40 bg-background px-2 text-sm font-semibold leading-tight text-foreground outline-none focus:ring-2 focus:ring-primary/10"
              autoFocus
            />
          ) : (
            <h1
              className="truncate text-sm font-semibold leading-tight text-foreground"
              title={paper?.title ? `${paper.title} - double click to rename` : undefined}
              onDoubleClick={() => {
                if (!paper) return;
                setDraftTitle(paper.title);
                setIsEditingTitle(true);
              }}
            >
              {paper?.title || 'Loading paper...'}
            </h1>
          )}
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {paper?.authors?.length
              ? paper.authors.join(', ')
              : paper?.year
                ? String(paper.year)
                : 'Reader'}
          </p>
        </div>
      </div>

      {/* Right: actions + panels */}
      <div className="flex shrink-0 items-center gap-2">
        {paper ? (
          <Badge
            variant="outline"
            className={cn(
              'h-6 rounded-md px-2 text-xs font-semibold',
              ragStatus === 'pending' && 'animate-pulse',
              RAG_STYLES[ragStatus],
            )}
          >
            {ragStatus === 'pending' ? <Loader2 className="size-3 animate-spin" /> : null}
            {RAG_LABELS[ragStatus]}
          </Badge>
        ) : null}

        {/* Index / Retry button */}
        {paper && ragStatus !== 'pending' && ragStatus !== 'indexed' ? (
          <Button variant="outline" size="sm" onClick={onReindex} disabled={isReindexing} className="hidden sm:inline-flex">
            {isReindexing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
            {ragStatus === 'failed' ? 'Retry index' : 'Index'}
          </Button>
        ) : null}

        {/* Download */}
        {paperUrl ? (
          <Button variant="ghost" size="icon-sm" asChild>
            <a href={paperUrl} download={paper?.filename || 'paper.pdf'} title="Download PDF">
              <Download className="size-4" />
            </a>
          </Button>
        ) : null}

        {/* BibTeX */}
        {paper ? (
          <Button variant="ghost" size="icon-sm" onClick={() => setBibtexOpen(true)} title="Export BibTeX">
            <FileJson className="size-4" />
          </Button>
        ) : null}

        <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />

        {/* Panel toggles */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
          <PanelButton panel="ai" activePanel={activePanel} onToggle={onPanelToggle} icon={MessageSquare} label="AI" />
          <PanelButton panel="details" activePanel={activePanel} onToggle={onPanelToggle} icon={Info} label="Details" />
          <PanelButton panel="notes" activePanel={activePanel} onToggle={onPanelToggle} icon={StickyNote} label="Notes" count={paper?.notes?.length} />
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setActivePanel((current: any) => (current ? null : 'details'))}

          aria-label={activePanel ? 'Close panel' : 'Open details'}
        >
          {activePanel ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
