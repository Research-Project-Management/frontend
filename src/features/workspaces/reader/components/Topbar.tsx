'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ChevronLeft,
  Download,
  FileJson,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { normalizeAuthors } from '../utils/reader.util';
import { documentRenameFormSchema } from '../schemas/reader.schema';
import type { ReaderDocument, ReaderPanel, DocumentRenameFormData } from '../types/reader.types';

function RagStatusIndicator({ status }: { status: string }) {
  if (status === 'indexed') {
    return (
      <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 text-11 font-mono text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary" />
        <span>Indexed</span>
      </div>
    );
  }

  if (status === 'pending' || status === 'indexing') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-11 font-mono text-foreground">
        <Loader2 className="size-3 animate-spin text-primary shrink-0" />
        <span>Indexing</span>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-11 font-mono text-destructive">
        <span className="size-1.5 rounded-full bg-destructive" />
        <span>Index failed</span>
      </div>
    );
  }

  return null;
}

function TitleRenameForm({
  initialTitle,
  onSubmitTitle,
  onCancel,
}: {
  initialTitle: string;
  onSubmitTitle: (title: string) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, reset } = useForm<DocumentRenameFormData>({
    resolver: zodResolver(documentRenameFormSchema),
    defaultValues: { title: initialTitle },
  });

  const onSubmit = (data: DocumentRenameFormData) => {
    onSubmitTitle(data.title);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full">
      <input
        {...register('title')}
        aria-label="Document title"
        onBlur={handleSubmit(onSubmit)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            reset({ title: initialTitle });
            onCancel();
          }
        }}
        className="h-6 w-full rounded-sm border border-border bg-background px-1.5 text-13 font-medium leading-tight text-foreground outline-none focus:ring-1 focus:ring-ring"
        autoFocus
      />
    </form>
  );
}

interface TopbarProps {
  paper: ReaderDocument | null;
  paperUrl: string | null;
  activePanel: ReaderPanel | null;
  isReindexing: boolean;
  setActivePanel: (updater: ReaderPanel | null | ((current: ReaderPanel | null) => ReaderPanel | null)) => void;
  setBibtexOpen: (v: boolean) => void;
  onPanelToggle?: (panel: ReaderPanel) => void;
  onReindex: () => void;
  onUpdateTitle: (title: string) => Promise<void>;
  onBack: () => void;
}

export default function Topbar({
  paper,
  paperUrl,
  activePanel,
  isReindexing,
  setActivePanel,
  setBibtexOpen,
  onReindex,
  onUpdateTitle,
  onBack,
}: TopbarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const ragStatus = paper?.ragStatus ?? 'idle';
  const authors = paper ? normalizeAuthors(paper.authors, paper.creators) : [];

  const handleTitleSubmit = async (newTitle: string) => {
    setIsEditingTitle(false);
    if (newTitle !== paper?.title) {
      await onUpdateTitle(newTitle);
    }
  };

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-background px-3 select-none">
      {/* Left: back + paper title & authors */}
      <div className="flex min-w-0 flex-1 items-center gap-2 pr-3">
        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onBack}
                aria-label="Back to library"
                className="size-7 text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none cursor-pointer rounded-sm"
              >
                <ChevronLeft className="size-4 text-foreground shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Back to library</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="min-w-0 max-w-[50vw] lg:max-w-[650px]">
          {isEditingTitle && paper ? (
            <TitleRenameForm
              initialTitle={paper.title}
              onSubmitTitle={handleTitleSubmit}
              onCancel={() => setIsEditingTitle(false)}
            />
          ) : (
            <div className="group flex items-center gap-1.5">
              <h1
                className="truncate text-13 font-medium leading-tight text-foreground cursor-pointer hover:opacity-90 transition-colors"
                title={paper?.title}
                onClick={() => {
                  if (paper) setIsEditingTitle(true);
                }}
              >
                {paper?.title || 'Loading document...'}
              </h1>
              {paper && (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity p-0.5 text-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none rounded-sm cursor-pointer"
                  title="Rename title"
                  aria-label="Rename title"
                >
                  <Pencil className="size-3 shrink-0" />
                </button>
              )}
            </div>
          )}
          <p className="truncate text-xs text-muted-foreground leading-none mt-0.5">
            {authors.length
              ? authors.slice(0, 3).join(', ') + (authors.length > 3 ? ` +${authors.length - 3}` : '')
              : paper?.publicationTitle || (paper?.year ? String(paper.year) : 'Reference')}
          </p>
        </div>
      </div>

      {/* Right: metadata actions + panel toggle */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Status Indicator */}
        {paper ? <RagStatusIndicator status={ragStatus} /> : null}

        {/* Index / Retry button */}
        {paper && ragStatus !== 'pending' && ragStatus !== 'indexed' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReindex}
            disabled={isReindexing}
            className="h-7 text-xs font-medium gap-1.5 px-2 text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none cursor-pointer rounded-sm"
          >
            {isReindexing ? <Loader2 className="size-3 animate-spin shrink-0" /> : <RefreshCcw className="size-3 shrink-0" />}
            <span>{ragStatus === 'failed' ? 'Retry index' : 'Index'}</span>
          </Button>
        )}

        {/* Download PDF */}
        {paperUrl && (
          <TooltipProvider delayDuration={500}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-7 text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none cursor-pointer rounded-sm" asChild>
                  <a href={paperUrl} download={paper?.filename || 'document.pdf'} aria-label="Download document">
                    <Download className="size-3.5 shrink-0" />
                  </a>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Download document</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* BibTeX */}
        {paper && (
          <TooltipProvider delayDuration={500}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setBibtexOpen(true)}
                  className="size-7 text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none cursor-pointer rounded-sm"
                  aria-label="Export BibTeX"
                >
                  <FileJson className="size-3.5 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Export BibTeX
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Separator orientation="vertical" className="mx-1 h-3.5" />

        {/* Single Panel Toggle Button */}
        <TooltipProvider delayDuration={500}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  'size-7 text-foreground hover:bg-muted focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none cursor-pointer rounded-sm transition-colors',
                  activePanel && 'bg-muted text-foreground',
                )}
                onClick={() => setActivePanel((current: ReaderPanel | null) => (current ? null : 'ai'))}
                aria-label={activePanel ? 'Close panel' : 'Open panel'}
              >
                {activePanel ? (
                  <PanelRightClose className="size-3.5 shrink-0" />
                ) : (
                  <PanelRightOpen className="size-3.5 shrink-0" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {activePanel ? 'Close panel' : 'Open panel'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
