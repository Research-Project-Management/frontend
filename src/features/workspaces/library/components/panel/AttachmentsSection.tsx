'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useParams } from 'next/navigation';
import {
  FileText,
  BookOpen,
  Download,
  ExternalLink,
  MoreVertical,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { getPaperFileUrl } from '@/features/workspaces/library/utils/library.util';
import { usePdf } from '@/features/workspaces/reader/hooks/use-pdf';
import { useAttachments, useAttachmentRevisions } from '@/features/workspaces/library/hooks/use-attachments';
import SnapshotViewerModal from '../modals/SnapshotViewerModal';
import type { CatalogItem, ItemAttachment } from '@/features/workspaces/library/types/library.types';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Use the application-hosted worker. Preview must remain available when a
// browser blocks third-party scripts or the machine has no Internet access.
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

interface PdfPagePreviewProps {
  paper: CatalogItem;
  paperUrl: string;
  onOpenReader: () => void;
}

function PdfViewerInternal({ paperUrl, onOpenReader }: PdfPagePreviewProps) {
  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: retryPdf,
  } = usePdf(paperUrl || null);

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

  return (
    <div
      ref={previewRef}
      onClick={onOpenReader}
      className="relative w-full rounded-md border border-border/60 bg-white dark:bg-zinc-950 overflow-hidden shadow-none flex flex-col items-center justify-center min-h-[220px] cursor-pointer group"
    >
      {pdfLoading ? (
        <div className="h-60 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-5 animate-spin text-foreground" />
          <span className="text-xs font-medium">Loading document...</span>
        </div>
      ) : pdfBlobUrl ? (
        <Document
          file={pdfBlobUrl}
          onLoadSuccess={({ numPages: total }) => {
            setNumPages(total);
            setCurrentPage(1);
          }}
          loading={
            <div className="h-60 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-foreground" />
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
      ) : (
        <div className="h-60 flex flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
          <span>{pdfError || 'Preview unavailable'}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              retryPdf();
            }}
            className="h-7 px-2.5 rounded-md border border-border/60 text-foreground hover:bg-black/5 dark:hover:bg-white/5"
          >
            Retry preview
          </button>
        </div>
      )}

      {/* Navigation Arrows: [<] [>] floating at bottom center */}
      {numPages > 1 && (
        <div
          className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage((p) => Math.max(1, p - 1));
            }}
            aria-label="Previous page"
            className="size-7 rounded-md bg-neutral-800/75 hover:bg-neutral-900 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center cursor-pointer shadow-none"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            disabled={currentPage >= numPages}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage((p) => Math.min(numPages, p + 1));
            }}
            aria-label="Next page"
            className="size-7 rounded-md bg-neutral-800/75 hover:bg-neutral-900 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center cursor-pointer shadow-none"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

const PdfPagePreview = dynamic(
  () => Promise.resolve(PdfViewerInternal),
  {
    ssr: false,
    loading: () => (
      <div className="h-60 flex flex-col items-center justify-center gap-2 text-muted-foreground border border-border/50 rounded-md bg-card">
        <Loader2 className="size-5 animate-spin text-foreground" />
        <span className="text-xs font-medium">Loading preview...</span>
      </div>
    ),
  }
);

function AttachmentRevisions({
  workspaceId,
  attachmentId,
}: {
  workspaceId: string;
  attachmentId: string;
}) {
  const { data: revisionsData, isLoading } = useAttachmentRevisions(workspaceId, attachmentId);
  const revisions = Array.isArray(revisionsData) ? revisionsData : [];

  if (isLoading) {
    return (
      <div className="p-2 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
        <Loader2 className="size-3 animate-spin text-foreground" />
        <span>Loading history...</span>
      </div>
    );
  }

  if (!revisions || revisions.length === 0) {
    return null;
  }

  return (
    <div className="p-2 space-y-1 text-xs">
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
        Revision History
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {revisions.map((rev: any) => (
          <div
            key={rev.id || rev.version}
            className="flex items-center justify-between p-1 rounded hover:bg-muted text-xs"
          >
            <span className="font-mono text-[11px]">v{rev.version}</span>
            <span className="text-muted-foreground text-[10px]">
              {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface AttachmentsSectionProps {
  paper: CatalogItem;
  workspaceId?: string;
  onAddAttachment?: () => void;
  isUploading?: boolean;
  hideHeader?: boolean;
}

const EMPTY_ATTACHMENTS: ItemAttachment[] = [];

export default function AttachmentsSection({
  paper,
  workspaceId,
  hideHeader = false,
}: AttachmentsSectionProps) {
  const router = RouterHookWrapper();
  const params = useParams();
  const rawWorkspaceId = (workspaceId || (params as any)?.workspaceId || 'ws-default') as string;

  const { captureSnapshot, isCapturingSnapshot } = useAttachments(rawWorkspaceId, paper.id || '');
  const [activeSnapshot, setActiveSnapshot] = useState<{ url: string; title: string; sourceUrl?: string } | null>(null);

  const rawAttachments = paper.attachments || (paper as any).files || EMPTY_ATTACHMENTS;
  const paperUrl = getPaperFileUrl(paper);

  const otherAttachments = useMemo(() => {
    return rawAttachments.filter((att: ItemAttachment | any) => {
      if (att.attachmentType === 'primary_pdf' || att.type === 'primary_pdf') return false;
      if (paper.filename && (att.filename === paper.filename || att.name === paper.filename)) return false;
      return true;
    });
  }, [rawAttachments, paper.filename]);

  const hasSnapshot = useMemo(() => {
    return rawAttachments.some(
      (att: any) =>
        att.attachmentType === 'web_snapshot' ||
        att.mimeType === 'text/html' ||
        att.filename?.toLowerCase().endsWith('.html'),
    );
  }, [rawAttachments]);

  const handleOpenReader = () => {
    if (!paper.id) return;
    router.push(`/${rawWorkspaceId}/library/papers/${paper.id}`);
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCaptureSnapshot = async () => {
    if (!paper.id || !paper.url) return;
    await captureSnapshot(paper.url);
  };

  if (!paperUrl && otherAttachments.length === 0 && !paper.url) {
    return null;
  }

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
        <PdfPagePreview
          paper={paper}
          paperUrl={paperUrl}
          onOpenReader={handleOpenReader}
        />
      ) : null}

      {/* Attachments List */}
      <div className="space-y-1.5">

        {/* Primary PDF Row */}
        {paperUrl ? (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 border border-border/60">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
              <div className="size-4 shrink-0 flex items-center justify-center">
                <FileText className="size-4 text-foreground shrink-0" />
              </div>
              <span className="text-xs font-medium text-foreground truncate" title={paper.filename || 'PDF'}>
                {paper.filename || 'PDF'}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Attachment options"
                  className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer focus-visible:outline-none focus-visible:ring-0"
                >
                  <MoreVertical className="size-3.5 text-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs font-sans">
                <DropdownMenuItem
                  onClick={handleOpenReader}
                  className="gap-2 cursor-pointer"
                >
                  <BookOpen className="size-3.5 text-foreground" />
                  <span>Open in Reader</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDownload(paperUrl, paper.filename || `${paper.title || 'document'}.pdf`)}
                  className="gap-2 cursor-pointer"
                >
                  <Download className="size-3.5 text-foreground" />
                  <span>Download</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => window.open(paperUrl, '_blank', 'noopener,noreferrer')}
                  className="gap-2 cursor-pointer"
                >
                  <ExternalLink className="size-3.5 text-foreground" />
                  <span>Open in New Tab</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        {/* Other Attachments */}
        {otherAttachments.map((att: any) => {
          const downloadUrl = att.fileUrl || att.url;
          const isSnapshot =
            att.attachmentType === 'web_snapshot' ||
            att.mimeType === 'text/html' ||
            att.filename?.toLowerCase().endsWith('.html');

          return (
            <div
              key={att.id}
              className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 border border-border/60 transition-colors"
            >
              <div
                className={`flex items-center gap-1.5 min-w-0 flex-1 mr-2 ${isSnapshot ? 'cursor-pointer' : ''}`}
                onClick={isSnapshot ? () => setActiveSnapshot({
                  url: downloadUrl,
                  title: att.filename || paper.title,
                  sourceUrl: paper.url,
                }) : undefined}
              >
                <div className="size-4 shrink-0 flex items-center justify-center">
                  {isSnapshot ? (
                    <Globe className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                  ) : (
                    <FileText className="size-3.5 text-foreground shrink-0" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate" title={att.filename || att.name}>
                    {att.filename || att.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    {isSnapshot && (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">Snapshot •</span>
                    )}
                    <span>{formatSize(att.size)}</span>
                  </p>
                </div>
              </div>

              {downloadUrl && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Attachment options"
                      className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer focus-visible:outline-none focus-visible:ring-0"
                    >
                      <MoreVertical className="size-3.5 text-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 text-xs font-sans">
                    {isSnapshot && (
                      <DropdownMenuItem
                        onClick={() =>
                          setActiveSnapshot({
                            url: downloadUrl,
                            title: att.filename || paper.title,
                            sourceUrl: paper.url,
                          })
                        }
                        className="gap-2 cursor-pointer"
                      >
                        <BookOpen className="size-3.5 text-foreground" />
                        <span>View Snapshot</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleDownload(downloadUrl, att.filename || att.name || (isSnapshot ? 'snapshot.html' : 'file'))}
                      className="gap-2 cursor-pointer"
                    >
                      <Download className="size-3.5 text-foreground" />
                      <span>Download</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => window.open(downloadUrl, '_blank', 'noopener,noreferrer')}
                      className="gap-2 cursor-pointer"
                    >
                      <ExternalLink className="size-3.5 text-foreground" />
                      <span>Open in New Tab</span>
                    </DropdownMenuItem>
                    {rawWorkspaceId && att.id && (
                      <>
                        <DropdownMenuSeparator />
                        <AttachmentRevisions
                          workspaceId={rawWorkspaceId}
                          attachmentId={att.id}
                        />
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      {/* Capture Snapshot Action for Web URLs */}
      {paper.url && (
        <button
          type="button"
          disabled={isCapturingSnapshot}
          onClick={handleCaptureSnapshot}
          className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md border border-dashed border-border/80 hover:bg-black/5 dark:hover:bg-white/5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 cursor-pointer"
        >
          {isCapturingSnapshot ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-foreground" />
              <span>Capturing Web Snapshot...</span>
            </>
          ) : (
            <>
              <Globe className="size-3.5 text-blue-600 dark:text-blue-400" />
              <span>{hasSnapshot ? 'Update Web Snapshot' : 'Capture Web Snapshot'}</span>
            </>
          )}
        </button>
      )}

      {/* Snapshot Viewer Modal */}
      <SnapshotViewerModal
        open={Boolean(activeSnapshot)}
        onOpenChange={(open) => {
          if (!open) setActiveSnapshot(null);
        }}
        snapshotUrl={activeSnapshot?.url || null}
        title={activeSnapshot?.title || 'Web Snapshot'}
        sourceUrl={activeSnapshot?.sourceUrl}
      />
    </div>
  );
}

function RouterHookWrapper() {
  return useRouter();
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
