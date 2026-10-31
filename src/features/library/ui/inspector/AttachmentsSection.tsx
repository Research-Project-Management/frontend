"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  BookOpen,
  Download,
  ExternalLink,
  MoreVertical,
  Loader2,
  Globe,
  Star,
  FolderSync,
  Plus,
  Upload,
  Link2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { Document, Page } from "react-pdf";
import {
  setupPdfWorker,
  getSharedPdfDocumentOptions,
  getCappedDevicePixelRatio,
  releaseCanvasMemory,
} from "@/shared/lib/pdfjs-worker";
import { usePdf } from "@/features/library/core/coordinator/reader/use-reader";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useAttachmentCoordinator } from "@/features/library/core/coordinator/attachment.coordinator";
import { classifyAttachmentDescriptor } from "@/features/library/domain/reader.domain";
import type { Item } from "@/features/library/domain/types/core.types";

import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

setupPdfWorker();
const SHARED_PDF_OPTIONS = getSharedPdfDocumentOptions();

export interface PdfPageCanvasProps {
  paperUrl: string;
  scopeId?: string;
}

export function PdfPageCanvas({
  paperUrl,
  scopeId,
}: PdfPageCanvasProps) {
  const {
    blobUrl: pdfBlobUrl,
    isLoading: pdfLoading,
    error: pdfError,
    retry: retryPdf,
  } = usePdf(paperUrl || null, scopeId);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<{
    cleanup?: () => Promise<void> | void;
    destroy?: () => Promise<void> | void;
  } | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(280);

  useEffect(() => {
    setCurrentPage(1);
    setNumPages(0);
  }, [paperUrl]);

  useEffect(() => {
    return () => {
      if (pageCanvasRef.current) {
        pageCanvasRef.current.width = 0;
        pageCanvasRef.current.height = 0;
        pageCanvasRef.current = null;
      }
      const doc = pdfDocRef.current;
      pdfDocRef.current = null;
      void doc?.cleanup?.();
      void doc?.destroy?.();
    };
  }, [paperUrl, pdfBlobUrl]);

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    let rafId: number | null = null;
    const updateWidth = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (canvasContainerRef.current) {
          const w = Math.floor(canvasContainerRef.current.getBoundingClientRect().width);
          if (w > 0) {
            setContainerWidth((prev) => (Math.abs(prev - w) >= 4 ? w : prev));
          }
        }
      });
    };
    updateWidth();
    const obs = new ResizeObserver(updateWidth);
    obs.observe(el);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      obs.disconnect();
      if (pageCanvasRef.current) {
        pageCanvasRef.current.width = 0;
        pageCanvasRef.current.height = 0;
        pageCanvasRef.current = null;
      }
      releaseCanvasMemory(el);
    };
  }, []);

  return (
    <div ref={canvasContainerRef} className="relative w-full flex flex-col items-center justify-center min-h-[220px]">
      {pdfLoading ? (
        <div className="h-60 flex flex-col items-center justify-center gap-2 text-foreground">
          <Loader2 className="size-5 animate-spin text-foreground shrink-0" />
          <span className="text-12 font-medium">Loading document...</span>
        </div>
      ) : pdfBlobUrl ? (
        <Document
          file={pdfBlobUrl}
          options={SHARED_PDF_OPTIONS}
          onLoadSuccess={(doc) => {
            pdfDocRef.current = doc;
            setNumPages(doc.numPages);
            setCurrentPage(1);
          }}
          loading={
            <div className="h-60 flex flex-col items-center justify-center gap-2 text-foreground">
              <Loader2 className="size-5 animate-spin text-foreground shrink-0" />
              <span className="text-12 font-medium">Loading preview...</span>
            </div>
          }
          error={
            <div className="h-60 flex flex-col items-center justify-center p-4 text-center text-12 text-foreground">
              <span>Document preview unavailable</span>
            </div>
          }
        >
          <Page
            pageNumber={currentPage}
            width={Math.max(200, containerWidth)}
            devicePixelRatio={getCappedDevicePixelRatio(1.5)}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            canvasRef={(node) => {
              if (node) {
                pageCanvasRef.current = node;
              } else if (pageCanvasRef.current) {
                pageCanvasRef.current.width = 0;
                pageCanvasRef.current.height = 0;
                pageCanvasRef.current = null;
              }
            }}
          />
        </Document>
      ) : (
        <div className="h-60 flex flex-col items-center justify-center gap-2 px-4 text-center text-12 text-foreground">
          <span>{pdfError || "Preview unavailable"}</span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              retryPdf();
            }}
            className="h-7 px-2.5 rounded-md border border-border text-foreground hover:bg-muted cursor-pointer transition-colors"
          >
            Retry preview
          </button>
        </div>
      )}

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
            className="size-7 rounded-md bg-background border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronLeft className="size-4 shrink-0" />
          </button>
          <button
            type="button"
            disabled={currentPage >= numPages}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentPage((p) => Math.min(numPages, p + 1));
            }}
            aria-label="Next page"
            className="size-7 rounded-md bg-background border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronRight className="size-4 shrink-0" />
          </button>
        </div>
      )}
    </div>
  );
}

export interface PdfPagePreviewProps {
  paper: Item;
  paperUrl: string;
  scopeId?: string | null;
  previewTitle?: string;
  onOpenReader: () => void;
}

export function PdfPagePreview({
  paper,
  paperUrl,
  scopeId,
  previewTitle,
  onOpenReader,
}: PdfPagePreviewProps) {
  const [previewRequested, setPreviewRequested] = useState(false);

  useEffect(() => {
    setPreviewRequested(false);
  }, [paperUrl, paper.id]);

  return (
    <div
      onClick={onOpenReader}
      className="relative w-full rounded-md border border-border bg-background overflow-hidden shadow-none flex flex-col items-center justify-center min-h-[220px] cursor-pointer group"
    >
      {!previewRequested ? (
        <div className="h-52 w-full flex flex-col items-center justify-center gap-2.5 px-4 text-center select-none">
          <div className="size-9 rounded-md border border-border bg-muted/60 flex items-center justify-center text-muted-foreground">
            <FileText className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
          </div>
          <div className="space-y-0.5 max-w-[220px]">
            <p className="text-12 font-medium text-foreground truncate">
              {previewTitle || paper.filename || paper.title || "PDF Document"}
            </p>
            <p className="text-11 text-muted-foreground">
              Click to open in Reader or load page preview
            </p>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setPreviewRequested(true);
            }}
            className="h-7 px-2.5 rounded-md border border-border bg-background text-11 font-medium text-foreground hover:bg-muted inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Eye className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <span>Load Preview</span>
          </button>
        </div>
      ) : (
        <PdfPageCanvas paperUrl={paperUrl} scopeId={scopeId || paper.projectId || undefined} />
      )}
    </div>
  );
}

interface AttachmentsSectionProps {
  item: Item;
  scopeId?: string;
  hideHeader?: boolean;
  hidePdfPreview?: boolean;
  canEdit?: boolean;
  onRegisterAdd?: (trigger: () => void) => void;
  onRegisterAddLink?: (trigger: () => void) => void;
  onRegisterFindOaPdf?: (trigger: () => void) => void;
}

export default function AttachmentsSection(props: AttachmentsSectionProps) {
  const {
    item: paper,
    scopeId,
    hideHeader = false,
    hidePdfPreview = false,
    canEdit = true,
    onRegisterAdd,
    onRegisterAddLink,
    onRegisterFindOaPdf,
  } = props;
  const {
    rawScopeId,
    fileInputRef,
    isUploadingFile,
    handleFileSelect,
    isAddingLink,
    linkUrlInput,
    setLinkUrlInput,
    linkTitleInput,
    setLinkTitleInput,
    isSubmittingLink,
    handleOpenLinkForm,
    handleCancelLink,
    handleSubmitLinkAttachment,
    allAttachments,
    primaryAttachment,
    activePreviewAttachment,
    activePreviewUrl,
    setSelectedAttachmentId,
    getAttachmentDownloadUrl,
    handleOpenReader,
    handleDownload,
    isSettingPrimary,
    handleSetPrimary,
    isDeleting,
    handleDeleteAttachment,
    renameAttachmentMutation,
    reResolveMetadataMutation,
  } = useAttachmentCoordinator({
    item: paper,
    scopeId,
    onRegisterAdd,
  });

  useEffect(() => {
    if (onRegisterAddLink) {
      onRegisterAddLink(handleOpenLinkForm);
    }
  }, [onRegisterAddLink, handleOpenLinkForm]);

  useEffect(() => {
    if (onRegisterFindOaPdf && paper.id) {
      onRegisterFindOaPdf(() => {
        void reResolveMetadataMutation.mutateAsync({
          itemId: paper.id,
          attachOaPdf: true,
        });
      });
    }
  }, [onRegisterFindOaPdf, paper.id, reResolveMetadataMutation]);

  if (allAttachments.length === 0 && !isAddingLink) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className="flex items-center justify-between px-1.5 py-1 text-12 text-muted-foreground select-none">
          <span>No attachments</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-11 font-medium text-foreground hover:underline cursor-pointer"
            >
              Attach file
            </button>
          )}
        </div>
      </>
    );
  }

  const multipleAttachments = allAttachments.length > 1;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
      <div className="flex flex-col gap-2 text-xs font-sans select-none w-full">
        {!hideHeader && (
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-12 font-medium text-foreground">Attachments</h3>
            {canEdit && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={isUploadingFile}
                        className="size-5 flex items-center justify-center rounded text-foreground hover:bg-muted cursor-pointer transition-colors"
                        aria-label="Add attachment"
                      >
                        {isUploadingFile ? (
                          <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
                        ) : (
                          <Plus
                            className="size-3.5 text-foreground shrink-0"
                            strokeWidth={1.5}
                          />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">Add attachment</TooltipContent>
                </Tooltip>
                <DropdownMenuContent
                  align="end"
                  className="w-56 p-1.5 text-xs font-sans rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-0.5"
                >
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2 cursor-pointer"
                  >
                    <Upload className="size-3.5 text-foreground shrink-0" />
                    <span>Attach Stored File...</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleOpenLinkForm}
                    className="gap-2 cursor-pointer"
                  >
                    <Link2 className="size-3.5 text-foreground shrink-0" />
                    <span>Attach Link to URI...</span>
                  </DropdownMenuItem>
                  {paper.id && (
                    <DropdownMenuItem
                      disabled={reResolveMetadataMutation.isPending}
                      onClick={() =>
                        void reResolveMetadataMutation.mutateAsync({
                          itemId: paper.id,
                          attachOaPdf: true,
                        })
                      }
                      className="gap-2 cursor-pointer"
                    >
                      <FolderSync className="size-3.5 text-foreground shrink-0" />
                      <span>Find Available Open Access PDF...</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {isAddingLink && (
          <form
            onSubmit={handleSubmitLinkAttachment}
            className="p-2 rounded-md border border-border bg-muted flex flex-col gap-1.5"
          >
            <input
              type="url"
              required
              autoFocus
              value={linkUrlInput}
              onChange={(e) => setLinkUrlInput(e.target.value)}
              placeholder="https://example.com/resource"
              className="h-7 px-2 rounded border border-border bg-background text-11 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              value={linkTitleInput}
              onChange={(e) => setLinkTitleInput(e.target.value)}
              placeholder="Label / title (optional)"
              className="h-7 px-2 rounded border border-border bg-background text-11 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex items-center justify-end gap-1.5 pt-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelLink}
                disabled={isSubmittingLink}
                className="h-6 px-2 text-11"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingLink || !linkUrlInput.trim()}
                className="h-6 px-2.5 text-11"
              >
                {isSubmittingLink ? "Saving..." : "Attach"}
              </Button>
            </div>
          </form>
        )}

        {!hidePdfPreview && activePreviewUrl ? (
          <PdfPagePreview
            paper={paper}
            paperUrl={activePreviewUrl}
            scopeId={rawScopeId}
            previewTitle={
              activePreviewAttachment?.title ||
              activePreviewAttachment?.filename ||
              activePreviewAttachment?.name ||
              paper.filename
            }
            onOpenReader={() => handleOpenReader(activePreviewAttachment?.id)}
          />
        ) : null}

        <div className="flex flex-col gap-1.5 w-full">
          {allAttachments.map((att, index) => {
            const downloadUrl = getAttachmentDownloadUrl(att);
            const isPrimary = att === primaryAttachment;
            const isPreviewSelected =
              multipleAttachments && att === activePreviewAttachment;
            const descriptor = classifyAttachmentDescriptor(att, downloadUrl);
            const {
              isPdf,
              isEpub,
              isSnapshot,
              isExternalLink: isLink,
              canOpenInReader,
              targetUrl,
            } = descriptor;

            const displayTitle =
              att.title ||
              att.filename ||
              att.name ||
              paper.filename ||
              "Attachment";

            const handleRowClick = () => {
              if (isPdf) {
                if (multipleAttachments && att.id && att !== activePreviewAttachment) {
                  setSelectedAttachmentId(att.id);
                } else {
                  handleOpenReader(att.id);
                }
              } else if (canOpenInReader) {
                handleOpenReader(att.id);
              } else if (isLink && targetUrl) {
                window.open(targetUrl, "_blank", "noopener,noreferrer");
              }
            };

            const handleRowDoubleClick = () => {
              if (canOpenInReader) {
                handleOpenReader(att.id);
              } else if (isLink && targetUrl) {
                window.open(targetUrl, "_blank", "noopener,noreferrer");
              }
            };

            return (
              <div
                key={att.id || `${att.filename}-${index}`}
                className={`flex items-center justify-between px-2.5 py-1.5 min-h-[32px] rounded-md border transition-colors ${
                  isPreviewSelected
                    ? "bg-muted/70 border-foreground/25"
                    : "bg-background hover:bg-muted border-border"
                }`}
              >
                <div
                  className={`flex items-center gap-2 min-w-0 flex-1 mr-2 ${
                    isSnapshot || isEpub || isPdf || isLink ? "cursor-pointer" : ""
                  }`}
                  onClick={handleRowClick}
                  onDoubleClick={handleRowDoubleClick}
                >
                  <div className="size-4 shrink-0 flex items-center justify-center">
                    {isSnapshot ? (
                      <Globe className="size-3.5 text-foreground shrink-0" />
                    ) : isLink ? (
                      <ExternalLink className="size-3.5 text-foreground shrink-0" />
                    ) : (
                      <FileText className="size-3.5 text-foreground shrink-0" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs font-medium text-foreground truncate leading-snug">
                            {displayTitle}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {displayTitle}
                        </TooltipContent>
                      </Tooltip>
                      {multipleAttachments && isPrimary && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Star className="size-3 text-foreground fill-foreground shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Primary Document
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {(att.size ||
                      isSnapshot ||
                      isLink ||
                      (att.title &&
                        (att.filename || att.name) &&
                        att.title !== (att.filename || att.name))) && (
                      <p className="text-10 text-muted-foreground flex items-center gap-1.5 truncate">
                        {att.title &&
                          (att.filename || att.name) &&
                          att.title !== (att.filename || att.name) && (
                            <span className="truncate max-w-[140px]">
                              {att.filename || att.name}
                            </span>
                          )}
                        {isSnapshot && (
                          <span className="font-medium">Snapshot</span>
                        )}
                        {isLink && <span className="font-medium">Link</span>}
                        {att.size ? <span>{formatSize(att.size)}</span> : null}
                      </p>
                    )}
                  </div>
                </div>

                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Attachment options"
                      onClick={(e) => e.stopPropagation()}
                      className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-0 relative before:absolute before:-inset-2 md:before:hidden"
                    >
                      <MoreVertical className="size-3.5 text-foreground shrink-0" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                    className="w-60 p-1.5 text-xs font-sans rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-0.5"
                  >
                    {(isSnapshot || isEpub || isPdf) && (
                      <DropdownMenuItem
                        onClick={() => handleOpenReader(att.id || undefined)}
                        className="gap-2 cursor-pointer"
                      >
                        <BookOpen className="size-3.5 text-foreground shrink-0" />
                        <span>
                          {isEpub
                            ? "Open EPUB in Reader"
                            : isSnapshot
                              ? "Open Snapshot in Reader"
                              : "Open in Reader"}
                        </span>
                      </DropdownMenuItem>
                    )}
                    {downloadUrl && (
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            downloadUrl,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                        className="gap-2 cursor-pointer"
                      >
                        <ExternalLink className="size-3.5 text-foreground shrink-0" />
                        <span>Open in New Tab</span>
                      </DropdownMenuItem>
                    )}
                    {!isLink && downloadUrl && (
                      <DropdownMenuItem
                        onClick={() =>
                          handleDownload(
                            downloadUrl,
                            att.filename ||
                              att.name ||
                              paper.filename ||
                              (isSnapshot
                                ? "snapshot.html"
                                : `${paper.title || "document"}.pdf`),
                          )
                        }
                        className="gap-2 cursor-pointer"
                      >
                        <Download className="size-3.5 text-foreground shrink-0" />
                        <span>Download</span>
                      </DropdownMenuItem>
                    )}
                    {canEdit &&
                      rawScopeId &&
                      att.id &&
                      !isPrimary &&
                      !isSnapshot &&
                      !isLink && (
                        <DropdownMenuItem
                          onClick={() => handleSetPrimary(att.id)}
                          disabled={isSettingPrimary}
                          className="gap-2 cursor-pointer"
                        >
                          <Star className="size-3.5 text-foreground shrink-0" />
                          <span>Set as Primary Document</span>
                        </DropdownMenuItem>
                      )}
                    {canEdit && rawScopeId && att.id && !isLink && (
                      <DropdownMenuItem
                        onClick={() =>
                          renameAttachmentMutation.mutate({
                            attachmentId: att.id,
                          })
                        }
                        disabled={renameAttachmentMutation.isPending}
                        className="gap-2 cursor-pointer"
                      >
                        <FolderSync className="size-3.5 text-foreground shrink-0" />
                        <span>Rename File from Parent Metadata</span>
                      </DropdownMenuItem>
                    )}
                    {canEdit && att.id && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteAttachment(att.id)}
                          disabled={isDeleting}
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="size-3.5 shrink-0" />
                          <span>Delete Attachment</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
