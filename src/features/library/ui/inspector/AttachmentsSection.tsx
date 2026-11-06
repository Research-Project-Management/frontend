"use client";

import React, { useEffect } from "react";
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
  Copy,
} from "lucide-react";
import { toast } from "sonner";
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
import type { Item } from "@/features/library/types/core.types";
import {
  PdfPageCanvas,
  PdfPagePreview,
  type PdfPageCanvasProps,
  type PdfPagePreviewProps,
} from "./InfoSection";

export {
  PdfPageCanvas,
  PdfPagePreview,
  type PdfPageCanvasProps,
  type PdfPagePreviewProps,
};

function isSafeBrowserUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
  if (trimmed.startsWith("blob:")) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
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
                        className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                        aria-label="Add attachment"
                      >
                        {isUploadingFile ? (
                          <Loader2 className="size-3.5 animate-spin shrink-0" />
                        ) : (
                          <Plus
                            className="size-3.5 shrink-0"
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
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                handleCancelLink();
              }
            }}
            className="p-2 rounded-md border border-border bg-muted flex flex-col gap-1.5"
          >
            <input
              type="url"
              required
              autoFocus
              aria-label="External resource URL"
              value={linkUrlInput}
              onChange={(e) => setLinkUrlInput(e.target.value)}
              placeholder="https://example.com/resource"
              className="h-7 px-2 rounded border border-border bg-background text-11 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="text"
              aria-label="Attachment label or title (optional)"
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
              } else if (isLink && targetUrl && isSafeBrowserUrl(targetUrl)) {
                window.open(targetUrl, "_blank", "noopener,noreferrer");
              }
            };

            const handleRowDoubleClick = () => {
              if (canOpenInReader) {
                handleOpenReader(att.id);
              } else if (isLink && targetUrl && isSafeBrowserUrl(targetUrl)) {
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
                      className="size-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground border border-transparent hover:border-border hover:bg-background hover:shadow-2xs transition-all duration-150 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-background data-[state=open]:border-border data-[state=open]:text-foreground data-[state=open]:shadow-2xs relative before:absolute before:-inset-2 md:before:hidden"
                    >
                      <MoreVertical className="size-3.5 shrink-0" strokeWidth={1.5} />
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
                    {downloadUrl && isSafeBrowserUrl(downloadUrl) && (
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
                    {(targetUrl || (downloadUrl && isSafeBrowserUrl(downloadUrl))) && (
                      <DropdownMenuItem
                        onClick={() => {
                          const urlToCopy = targetUrl || downloadUrl;
                          if (urlToCopy) {
                            void navigator.clipboard.writeText(urlToCopy);
                            toast.success("Attachment link copied to clipboard");
                          }
                        }}
                        className="gap-2 cursor-pointer"
                      >
                        <Copy className="size-3.5 text-foreground shrink-0" />
                        <span>Copy Link</span>
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
