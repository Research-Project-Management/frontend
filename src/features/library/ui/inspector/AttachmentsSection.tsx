"use client";

import React from "react";
import {
  FileText,
  BookOpen,
  Download,
  ExternalLink,
  MoreVertical,
  Loader2,
  Globe,
  Star,
  FileDown,
  FolderSync,
  Plus,
  Upload,
  Link2,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/shared/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useAttachmentCoordinator } from "./useAttachmentCoordinator";
import { PdfPagePreview } from "./PdfPagePreview";
import type {
  Item,
  ItemAttachment,
} from "@/features/library/domain/types/library.types";

interface AttachmentsSectionProps {
  item: Item;
  scopeId?: string;
  onAddAttachment?: () => void;
  isUploading?: boolean;
  hideHeader?: boolean;
  hidePdfPreview?: boolean;
  canEdit?: boolean;
  onRegisterAdd?: (trigger: () => void) => void;
}

const EMPTY_ATTACHMENTS: ItemAttachment[] = [];

export default function AttachmentsSection(props: AttachmentsSectionProps) {
  const {
    item: paper,
    scopeId,
    hideHeader = false,
    hidePdfPreview = false,
    canEdit = true,
    onRegisterAdd,
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
    primaryAttachment,
    otherAttachments,
    hasSnapshot,
    paperUrl,
    handleOpenReader,
    handleDownload,
    isDownloadingAnnotated,
    handleDownloadAnnotatedPdf,
    isSettingPrimary,
    handleSetPrimary,
    isCapturingSnapshot,
    handleCaptureSnapshot,
    renameAttachmentMutation,
  } = useAttachmentCoordinator({
    item: paper,
    scopeId,
    onRegisterAdd,
  });

  if (
    !paperUrl &&
    otherAttachments.length === 0 &&
    !paper.url &&
    !isAddingLink
  ) {
    return (
      <div className="py-2 px-1.5 text-center text-11 text-foreground flex flex-col items-center justify-center gap-1.5 font-sans">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
        <span>No attached files or snapshots.</span>
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-6 text-11 text-foreground hover:bg-muted px-2 gap-1 cursor-pointer font-normal"
              disabled={isUploadingFile}
            >
              <Plus className="size-3 text-foreground" strokeWidth={1.5} />
              <span>Upload file</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenLinkForm}
              className="h-6 text-11 text-foreground hover:bg-muted px-2 gap-1 cursor-pointer font-normal"
            >
              <Link2 className="size-3 text-foreground" strokeWidth={1.5} />
              <span>Attach link</span>
            </Button>
          </div>
        )}
      </div>
    );
  }

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

        {/* PDF Page Preview Card */}
        {!hidePdfPreview && paperUrl ? (
          <PdfPagePreview
            paper={paper}
            paperUrl={paperUrl}
            onOpenReader={handleOpenReader}
          />
        ) : null}

        {/* Attachments List */}
        <div className="flex flex-col gap-1.5 w-full">
          {/* Primary PDF Row */}
          {paperUrl ? (
            <div className="flex items-center justify-between px-2 py-1 min-h-[28px] rounded-md hover:bg-muted border border-border">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <div className="size-4 shrink-0 flex items-center justify-center">
                  <FileText className="size-4 text-foreground shrink-0" />
                </div>
                <div className="min-w-0 flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs font-medium text-foreground break-all leading-snug">
                        {primaryAttachment?.title ||
                          paper.filename ||
                          (paper.openAccessPdfUrl ? "Open Access PDF" : "PDF")}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {primaryAttachment?.title ||
                        paper.filename ||
                        (paper.openAccessPdfUrl ? "Open Access PDF" : "PDF")}
                    </TooltipContent>
                  </Tooltip>
                  {primaryAttachment?.title &&
                    paper.filename &&
                    primaryAttachment.title !== paper.filename && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-10 text-foreground truncate">
                            {paper.filename}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {paper.filename}
                        </TooltipContent>
                      </Tooltip>
                    )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Attachment options"
                    className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-0 relative before:absolute before:-inset-2 md:before:hidden"
                  >
                    <MoreVertical className="size-3.5 text-foreground shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64 p-1.5 text-xs font-sans rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-0.5"
                >
                  <DropdownMenuItem
                    onClick={handleOpenReader}
                    className="gap-2 cursor-pointer"
                  >
                    <BookOpen className="size-3.5 text-foreground shrink-0" />
                    <span>Open in Reader</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleDownload(
                        paperUrl,
                        paper.filename || `${paper.title || "document"}.pdf`,
                      )
                    }
                    className="gap-2 cursor-pointer"
                  >
                    <Download className="size-3.5 text-foreground shrink-0" />
                    <span>Download</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDownloadAnnotatedPdf}
                    disabled={isDownloadingAnnotated}
                    className="gap-2 cursor-pointer"
                  >
                    {isDownloadingAnnotated ? (
                      <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
                    ) : (
                      <FileDown className="size-3.5 text-foreground shrink-0" />
                    )}
                    <span>Download with Annotations</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      window.open(paperUrl, "_blank", "noopener,noreferrer")
                    }
                    className="gap-2 cursor-pointer"
                  >
                    <ExternalLink className="size-3.5 text-foreground shrink-0" />
                    <span>Open in New Tab</span>
                  </DropdownMenuItem>
                  {canEdit && primaryAttachment && (
                    <DropdownMenuItem
                      onClick={() =>
                        renameAttachmentMutation.mutate({
                          attachmentId: primaryAttachment.id,
                        })
                      }
                      disabled={renameAttachmentMutation.isPending}
                      className="gap-2 cursor-pointer"
                    >
                      <FolderSync className="size-3.5 text-foreground shrink-0" />
                      <span>Rename File from Parent Metadata</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}

          {/* Other Attachments */}
          {otherAttachments.map((att) => {
            const downloadUrl = att.fileUrl || att.url;
            const isSnapshot =
              att.attachmentType === "web_snapshot" ||
              att.attachmentType === "snapshot" ||
              att.linkMode === "imported_url" ||
              att.mimeType === "text/html" ||
              att.filename?.toLowerCase().endsWith(".html");
            const isEpub =
              att.mimeType?.toLowerCase().includes("epub") ||
              att.filename?.toLowerCase().endsWith(".epub");
            const isLink =
              att.linkMode === "linked_url" ||
              (!att.fileId &&
                att.url &&
                /^https?:\/\//i.test(att.url) &&
                !isSnapshot &&
                !isEpub);

            return (
              <div
                key={att.id}
                className="flex items-center justify-between px-2 py-1 min-h-[28px] rounded-md hover:bg-muted border border-border transition-colors"
              >
                <div
                  className={`flex items-center gap-2 min-w-0 flex-1 mr-2 ${isSnapshot || isEpub || isLink ? "cursor-pointer" : ""}`}
                  onClick={
                    isEpub || isSnapshot
                      ? handleOpenReader
                      : isLink && downloadUrl
                        ? () =>
                            window.open(
                              downloadUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                        : undefined
                  }
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p className="text-xs font-medium text-foreground break-all leading-snug">
                          {att.title || att.filename || att.name}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {att.title || att.filename || att.name}
                      </TooltipContent>
                    </Tooltip>
                    <p className="text-10 text-foreground flex items-center gap-1.5 truncate">
                      {att.title &&
                        (att.filename || att.name) &&
                        att.title !== (att.filename || att.name) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="truncate max-w-[140px]">
                                {att.filename || att.name} •
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {att.filename || att.name}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      {isSnapshot && (
                        <span className="text-foreground font-medium">
                          Snapshot •
                        </span>
                      )}
                      {isLink && (
                        <span className="text-foreground font-medium">
                          Link •
                        </span>
                      )}
                      {att.size ? <span>{formatSize(att.size)}</span> : null}
                    </p>
                  </div>
                </div>

                {downloadUrl && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Attachment options"
                        className="size-6 rounded-md flex items-center justify-center text-foreground hover:bg-muted cursor-pointer focus-visible:outline-none focus-visible:ring-0 relative before:absolute before:-inset-2 md:before:hidden"
                      >
                        <MoreVertical className="size-3.5 text-foreground shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-64 p-1.5 text-xs font-sans rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 space-y-0.5"
                    >
                      {(isSnapshot || isEpub) && (
                        <DropdownMenuItem
                          onClick={handleOpenReader}
                          className="gap-2 cursor-pointer"
                        >
                          <BookOpen className="size-3.5 text-foreground shrink-0" />
                          <span>{isEpub ? 'Open EPUB in Reader' : 'Open Snapshot in Reader'}</span>
                        </DropdownMenuItem>
                      )}
                      {!isLink && (
                        <DropdownMenuItem
                          onClick={() =>
                            handleDownload(
                              downloadUrl,
                              att.filename ||
                                att.name ||
                                (isSnapshot ? "snapshot.html" : "file"),
                            )
                          }
                          className="gap-2 cursor-pointer"
                        >
                          <Download className="size-3.5 text-foreground shrink-0" />
                          <span>Download</span>
                        </DropdownMenuItem>
                      )}
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
                      {canEdit &&
                        rawScopeId &&
                        att.id &&
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
                      {canEdit &&
                        rawScopeId &&
                        att.id &&
                        !isLink && (
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </div>

        {/* Capture Snapshot Action for Web URLs */}
        {canEdit && paper.url && (
          <button
            type="button"
            disabled={isCapturingSnapshot}
            onClick={handleCaptureSnapshot}
            className="w-full mt-1 h-8 flex items-center justify-center gap-1.5 px-2 rounded-md border border-dashed border-border hover:bg-muted text-12 text-foreground transition-colors disabled:opacity-50 cursor-pointer relative before:absolute before:-inset-1 md:before:hidden"
          >
            {isCapturingSnapshot ? (
              <>
                <Loader2 className="size-3.5 animate-spin text-foreground shrink-0" />
                <span>Capturing Web Snapshot...</span>
              </>
            ) : (
              <>
                <Globe className="size-3.5 text-foreground shrink-0" />
                <span>
                  {hasSnapshot ? "Update Web Snapshot" : "Capture Web Snapshot"}
                </span>
              </>
            )}
          </button>
        )}
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
