'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  FileText,
  BookOpen,
  Download,
  ExternalLink,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { API_BASE_URL } from '@/config/env';
import { usePdf } from '@/features/workspaces/library/hooks/reader/use-pdf';
import { getPaperFileUrl } from '@/features/workspaces/library/utils/library.util';
import type { Paper, PaperAttachment } from '@/features/workspaces/library/types/library.types';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Configure worker matching exact react-pdf bundled pdfjs-dist version
if (
  typeof window !== 'undefined' &&
  pdfjs &&
  typeof pdfjs === 'object' &&
  'GlobalWorkerOptions' in pdfjs &&
  pdfjs.GlobalWorkerOptions
) {
  try {
    pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  } catch {
    // Ignore worker assignment error
  }
}

interface FilesSectionProps {
  paper: Paper;
  hideHeader?: boolean;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FilesSection({ paper, hideHeader = false }: FilesSectionProps) {
  const router = useRouter();
  const { workspaceId: workspaceUrl } = useParams();
  const paperId = paper.id;
  const attachments: PaperAttachment[] = paper.attachments || [];

  const paperUrl = getPaperFileUrl(paper);
  const { blobUrl: pdfBlobUrl, isLoading: pdfLoading } = usePdf(
    paperUrl || null,
    paper
      ? {
          title: paper.title,
          authors: paper.authors,
          year: paper.year,
          journal: paper.journal || paper.publisher,
          doi: paper.doi,
          abstract: paper.abstract,
        }
      : undefined
  );

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(280);

  useEffect(() => {
    if (!previewRef.current) return;
    const updateWidth = () => {
      if (previewRef.current) {
        const w = previewRef.current.getBoundingClientRect().width;
        if (w > 0) setContainerWidth(Math.floor(w));
      }
    };
    updateWidth();
    const obs = new ResizeObserver(updateWidth);
    obs.observe(previewRef.current);
    return () => obs.disconnect();
  }, []);

  // Filter out any attachment that represents the primary file
  const supplementaryAttachments = attachments.filter((att) => {
    if ((att as any).isPrimary || att.attachmentType === 'primary_pdf' || (att as any).type === 'primary') return false;
    if (
      paper.fileUrl &&
      att.url &&
      (att.url === paper.fileUrl ||
        att.url.endsWith(paper.fileUrl) ||
        paper.fileUrl.endsWith(att.url))
    ) {
      return false;
    }
    if (paper.filename && att.filename && att.filename === paper.filename) {
      return false;
    }
    return true;
  });

  const resolveFileUrl = (url?: string) => {
    if (!url) return '';
    return url.startsWith('/api/files/') ? `${API_BASE_URL}${url}` : url;
  };

  const handleOpenReader = () => {
    if (paperId) {
      router.push(`/${workspaceUrl}/library/papers/${paperId}`);
    }
  };

  return (
    <div className="space-y-3 text-xs font-sans select-none">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">
            Attachments
          </h3>
        </div>
      )}

      {/* PDF Page Preview Card */}
      {paperUrl ? (
        <div
          ref={previewRef}
          className="relative w-full rounded-md border border-border/50 bg-card overflow-hidden shadow-xs flex flex-col items-center justify-center min-h-[220px]"
        >
          {pdfBlobUrl ? (
            <Document
              file={pdfBlobUrl}
              onLoadSuccess={({ numPages: total }) => {
                setNumPages(total);
                setCurrentPage(1);
              }}
              loading={
                <div className="h-60 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-xs font-medium">Loading preview...</span>
                </div>
              }
              error={
                <div className="h-60 flex flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground">
                  <span>Document preview unavailable</span>
                </div>
              }
            >
              <Page
                pageNumber={currentPage}
                width={Math.max(200, containerWidth)}
                renderAnnotationLayer={false}
                renderTextLayer={false}
              />
            </Document>
          ) : pdfLoading ? (
            <div className="h-60 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs font-medium">Loading document...</span>
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-xs text-muted-foreground">
              <span>Preview unavailable</span>
            </div>
          )}

          {/* Navigation Arrows: [<] [>] floating at bottom center */}
          {numPages > 1 && (
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
                className="size-7 rounded bg-black/70 hover:bg-black/90 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center cursor-pointer transition-colors shadow-md"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= numPages}
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                aria-label="Next page"
                className="size-7 rounded bg-black/70 hover:bg-black/90 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center cursor-pointer transition-colors shadow-md"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Attachments List */}
      <div className="space-y-1.5">
        {/* Primary PDF Row */}
        {paperUrl ? (
          <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 transition-colors border border-border/40 bg-card/60">
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              <FileText className="size-4 text-rose-500 shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate" title={paper.filename || 'PDF'}>
                {paper.filename || 'PDF'}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Attachment options"
                  className="size-6 rounded flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer focus-visible:outline-none"
                >
                  <MoreVertical className="size-3.5 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1 text-xs font-medium bg-popover text-popover-foreground border border-border shadow-none rounded-md z-50">
                <DropdownMenuItem
                  onClick={handleOpenReader}
                  className="gap-2 px-2.5 py-1.5 cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted font-medium"
                >
                  <BookOpen className="size-3.5 text-foreground" />
                  <span>Open Reader</span>
                </DropdownMenuItem>

                {paper.fileUrl && (
                  <DropdownMenuItem asChild className="gap-2 px-2.5 py-1.5 cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted font-medium">
                    <a
                      href={resolveFileUrl(paper.fileUrl)}
                      download={paper.filename || `${paper.title || 'paper'}.pdf`}
                    >
                      <Download className="size-3.5 text-foreground" />
                      <span>Download PDF</span>
                    </a>
                  </DropdownMenuItem>
                )}

                {paper.fileUrl && (
                  <DropdownMenuItem asChild className="gap-2 px-2.5 py-1.5 cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted font-medium">
                    <a
                      href={resolveFileUrl(paper.fileUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3.5 text-foreground" />
                      <span>Open in new tab</span>
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : supplementaryAttachments.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground text-xs bg-muted/10 rounded-md border border-dashed border-border/40">
            No attachments
          </div>
        ) : null}

        {/* Supplementary Attachments */}
        {supplementaryAttachments.map((att) => {
          const attName = att.filename || 'Attachment';
          const attUrl = att.url;
          return (
            <div
              key={att.id}
              className="flex items-center justify-between p-2 rounded-md hover:bg-muted/40 transition-colors border border-border/40 bg-card/60"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <FileText className="size-4 text-foreground/70 shrink-0" />
                <span className="text-xs font-medium text-foreground truncate" title={attName}>
                  {attName}
                </span>
                {att.size && (
                  <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                    ({formatSize(att.size)})
                  </span>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Attachment options"
                    className="size-6 rounded flex items-center justify-center text-foreground hover:bg-muted/80 transition-colors cursor-pointer focus-visible:outline-none"
                  >
                    <MoreVertical className="size-3.5 text-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 p-1 text-xs font-medium bg-popover text-popover-foreground border border-border shadow-none rounded-md z-50">
                  {attUrl && (
                    <DropdownMenuItem asChild className="gap-2 px-2.5 py-1.5 cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted font-medium">
                      <a href={resolveFileUrl(attUrl)} download={attName}>
                        <Download className="size-3.5 text-foreground" />
                        <span>Download file</span>
                      </a>
                    </DropdownMenuItem>
                  )}
                  {attUrl && (
                    <DropdownMenuItem asChild className="gap-2 px-2.5 py-1.5 cursor-pointer text-foreground rounded-sm hover:bg-muted focus:bg-muted font-medium">
                      <a href={resolveFileUrl(attUrl)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3.5 text-foreground" />
                        <span>Open in new tab</span>
                      </a>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </div>
  );
}
