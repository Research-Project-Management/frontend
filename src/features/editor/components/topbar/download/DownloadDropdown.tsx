'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Download,
  Archive,
  FileText,
  FileDown,
  Loader2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/shared/components/ui';
import { usePageStore, useCompileStore } from '@/features/editor/store';
import {
  exportProjectAsZip,
  exportArxivSubmissionZip,
  getExportFilename,
} from '@/features/editor/utils';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';

export interface DownloadDropdownProps {
  className?: string;
  variant?: 'topbar' | 'compact';
}

import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';

export function DownloadDropdown({
  className,
  variant = 'topbar',
}: DownloadDropdownProps) {
  const params = useParams<{ pageId?: string; projectId?: string }>();
  const { currentPage, activeFilePage } = usePageStore();
  const { getContent } = useEditorInstance();
  const { pdfUrl, compileStatus } = useCompileStore();

  const [isZipping, setIsZipping] = useState(false);
  const [isArxivZipping, setIsArxivZipping] = useState(false);

  const rootId =
    params?.pageId ||
    currentPage?.id ||
    (typeof currentPage?.projectId === 'string'
      ? currentPage.projectId
      : (currentPage?.projectId as any)?.id) ||
    '';

  const isPending = isZipping || isArxivZipping;

  // 1. Download Compiled PDF
  const handleDownloadPdf = () => {
    if (!pdfUrl) {
      toast.error('No compiled PDF available. Please compile first (Ctrl+Enter).');
      return;
    }
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = getExportFilename(currentPage?.title, 'pdf');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Downloaded compiled PDF');
  };

  // 2. Download Full Project ZIP (Overleaf standard)
  const handleDownloadSourceZip = async () => {
    if (!rootId) {
      toast.error('Document root ID not found');
      return;
    }
    setIsZipping(true);
    try {
      await exportProjectAsZip({
        parentPageId: rootId,
        projectTitle: currentPage?.title,
        currentContent: getContent(),
        activeFileId: activeFilePage?.id,
        activeFileTitle: activeFilePage?.title,
      });
    } finally {
      setIsZipping(false);
    }
  };

  // 3. Download Clean arXiv Submission ZIP
  const handleDownloadArxivZip = async () => {
    if (!rootId) {
      toast.error('Document root ID not found');
      return;
    }
    setIsArxivZipping(true);
    try {
      await exportArxivSubmissionZip({
        parentPageId: rootId,
        projectTitle: currentPage?.title,
        currentContent: getContent(),
        activeFileId: activeFilePage?.id,
        activeFileTitle: activeFilePage?.title,
      });
    } finally {
      setIsArxivZipping(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          aria-label="Download or export document options"
          className={cn(
            variant === 'topbar'
              ? 'flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-foreground/80 hover:text-foreground hover:bg-sidebar-hover transition-colors cursor-pointer outline-none select-none disabled:opacity-50'
              : 'flex items-center gap-1 h-6 px-2 rounded-sm border border-border bg-background text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer shadow-2xs disabled:opacity-50',
            className,
          )}
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
          ) : (
            <Download className="size-3.5 shrink-0" />
          )}
          <span className="hidden sm:inline">Download</span>
          <ChevronDown className="size-2.5 opacity-60 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 text-xs z-[9999] p-1 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200">
        <DropdownMenuLabel className="text-11 font-medium text-muted-foreground px-2 py-1">
          Export & Archiving (Overleaf 1:1)
        </DropdownMenuLabel>

        {/* ── 1. Source ZIP ── */}
        <DropdownMenuItem
          onClick={handleDownloadSourceZip}
          disabled={isPending}
          className="flex items-start gap-2.5 p-2 rounded-sm cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <div className="size-7 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Archive className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>Source (.zip)</span>
              <span className="px-1 py-px rounded-sm text-9 bg-primary/15 text-primary font-mono">
                Full
              </span>
            </div>
            <p className="text-11 text-muted-foreground leading-tight">
              All LaTeX files, .bib and image assets
            </p>
          </div>
        </DropdownMenuItem>

        {/* ── 2. arXiv Submission ZIP ── */}
        <DropdownMenuItem
          onClick={handleDownloadArxivZip}
          disabled={isPending}
          className="flex items-start gap-2.5 p-2 rounded-sm cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <div className="size-7 rounded-sm bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>arXiv Package (.zip)</span>
              <Sparkles className="size-3 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-11 text-muted-foreground leading-tight">
              Clean bundle ready for arXiv.org submission
            </p>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-border" />

        {/* ── 3. Compiled PDF ── */}
        <DropdownMenuItem
          onClick={handleDownloadPdf}
          disabled={!pdfUrl || isPending}
          className="flex items-start gap-2.5 p-2 rounded-sm cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <div className="size-7 rounded-sm bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
            <FileDown className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <span>PDF Document (.pdf)</span>
              {!pdfUrl && (
                <span className="text-10 text-muted-foreground font-normal">
                  (uncompiled)
                </span>
              )}
            </div>
            <p className="text-11 text-muted-foreground leading-tight">
              {pdfUrl ? 'Download the latest compiled output' : 'Compile first to generate PDF'}
            </p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
