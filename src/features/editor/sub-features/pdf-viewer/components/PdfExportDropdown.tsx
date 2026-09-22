'use client';

/**
 * PdfExportDropdown.tsx
 *
 * Multi-format export dropdown:
 * - Compiled PDF
 * - Project Source ZIP
 * - arXiv Submission Bundle
 * - Pandoc Word (.docx)
 * - Markdown (.md)
 */

import React from 'react';
import { Download, FileText, Archive, Sparkles, FileCode, FileType } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui';
import { useParams } from 'next/navigation';
import { usePageStore } from '../../../store';
import {
  exportProjectAsZip,
  exportArxivSubmissionZip,
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
  getExportFilename,
} from '../../../utils';
import { toast } from 'sonner';

export interface PdfExportDropdownProps {
  pdfUrl: string | null;
  onDownloadPdf: () => void;
}

export const PdfExportDropdown = React.memo(function PdfExportDropdown({
  pdfUrl,
  onDownloadPdf,
}: PdfExportDropdownProps) {
  const { projectId } = useParams<{ projectId?: string }>();
  const currentPage = usePageStore((s) => s.currentPage);
  const docTitle = currentPage?.title || 'document';

  const handleExportZip = async () => {
    if (!projectId) return;
    try {
      await exportProjectAsZip({ parentPageId: projectId, projectTitle: docTitle });
      toast.success('Project source exported as ZIP');
    } catch {
      toast.error('Failed to export ZIP');
    }
  };

  const handleExportArxiv = async () => {
    if (!projectId) return;
    try {
      await exportArxivSubmissionZip({ parentPageId: projectId, projectTitle: docTitle });
      toast.success('arXiv submission bundle ready');
    } catch {
      toast.error('Failed to generate arXiv bundle');
    }
  };

  const handleExportWord = async () => {
    if (!projectId) return;
    try {
      await exportDocumentAsWord({ pageId: projectId, projectTitle: docTitle });
      toast.success('Exported as Microsoft Word');
    } catch {
      toast.error('Word export failed');
    }
  };

  const handleExportMarkdown = async () => {
    if (!projectId) return;
    try {
      await exportDocumentAsMarkdown({ pageId: projectId, projectTitle: docTitle });
      toast.success('Exported as Markdown');
    } catch {
      toast.error('Markdown export failed');
    }
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              disabled={!pdfUrl}
              aria-label="Download options"
              className="size-7 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Download className="size-4" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Download PDF / Export files
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-56 text-xs">
        <DropdownMenuLabel className="text-11 font-semibold text-muted-foreground uppercase tracking-wider">
          Download Output
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={onDownloadPdf}
          disabled={!pdfUrl}
          className="flex items-center gap-2 cursor-pointer font-medium"
        >
          <FileText className="size-3.5 text-primary" />
          <span>Download PDF</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-11 font-semibold text-muted-foreground uppercase tracking-wider">
          Source & Submission
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleExportZip} className="flex items-center gap-2 cursor-pointer">
          <Archive className="size-3.5 text-muted-foreground" />
          <span>Source (ZIP)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportArxiv} className="flex items-center gap-2 cursor-pointer">
          <Sparkles className="size-3.5 text-amber-500" />
          <span>arXiv Submission (ZIP)</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-11 font-semibold text-muted-foreground uppercase tracking-wider">
          Convert Format
        </DropdownMenuLabel>
        <DropdownMenuItem onClick={handleExportWord} className="flex items-center gap-2 cursor-pointer">
          <FileType className="size-3.5 text-blue-500" />
          <span>Microsoft Word (.docx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportMarkdown} className="flex items-center gap-2 cursor-pointer">
          <FileCode className="size-3.5 text-emerald-500" />
          <span>Markdown (.md)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
