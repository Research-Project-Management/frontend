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
} from '@/shared/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { useParams } from 'next/navigation';
import { usePageStore } from '../../../store';
import {
  exportProjectAsZip,
  exportArxivSubmissionZip,
  exportDocumentAsWord,
  exportDocumentAsMarkdown,
  getExportFilename,
} from '../../../utils';
import { useProjectExport } from '../../../hooks/use-export';

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
  const { exportZip, exportArxiv, exportWord, exportMarkdown } = useProjectExport();

  const handleExportZip = () => {
    if (!projectId) return;
    exportZip({ parentPageId: projectId, projectTitle: docTitle });
  };

  const handleExportArxiv = () => {
    if (!projectId) return;
    exportArxiv({ parentPageId: projectId, projectTitle: docTitle });
  };

  const handleExportWord = () => {
    if (!projectId) return;
    exportWord({ pageId: projectId, projectTitle: docTitle });
  };

  const handleExportMarkdown = () => {
    if (!projectId) return;
    exportMarkdown({ pageId: projectId, projectTitle: docTitle });
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
              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
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
        <DropdownMenuLabel className="text-12 font-medium text-muted-foreground tracking-normal">
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

        <DropdownMenuLabel className="text-12 font-medium text-muted-foreground tracking-normal">
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

        <DropdownMenuLabel className="text-12 font-medium text-muted-foreground tracking-normal">
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
