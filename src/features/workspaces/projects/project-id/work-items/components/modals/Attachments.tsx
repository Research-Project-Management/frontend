'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  BookOpen,
  Paperclip,
  Link2,
  ExternalLink,
  Plus,
  Trash2,
  Upload,
  Globe,
  Loader2,
} from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { Input } from "@/shared/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";
import { PageService } from '@/features/workspaces/projects/project-id/pages/services/page.service';
import { useUploadFilesWithToast } from '../../hooks/use-tasks';
import type {
  AttachPageItem,
  AttachPaperItem,
  AttachFileItem,
  AttachLinkItem,
} from '../../types/types';

export type TaskAttachment = {
  id: string;
  name: string;
  type?: string | null;
  size?: string | number | null;
  createdAt?: string;
  uploadedAt?: string;
  url: string;
};

export type AttachCenterData = {
  pages?: AttachPageItem[];
  papers?: AttachPaperItem[];
  files?: (TaskAttachment | AttachFileItem)[];
  links?: AttachLinkItem[];
};

export type TaskAttachmentsProps = {
  attachments?: AttachCenterData | TaskAttachment[];
  taskId?: string;
  projectId?: string;
  workspaceId?: string;
  onRenameAttachment?: (attachmentId: string, newName: string) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onAttachPage?: (page: { pageId: string; title: string }) => void;
  onDetachPage?: (pageId: string) => void;
  onAttachPaper?: (paper: { paperId: string; title: string; doi?: string; citationKey?: string }) => void;
  onDetachPaper?: (paperId: string) => void;
  onAttachFile?: (file: { name: string; url: string; size?: number; type?: string }) => void;
  onDetachFile?: (fileId: string) => void;
  onAttachLink?: (link: { title: string; url: string }) => void;
  onDetachLink?: (linkIndex: number) => void;
  onCommentAttachment?: (attachment: TaskAttachment) => void;
  onDownloadAttachment?: (attachment: TaskAttachment) => void;
  isReadOnly?: boolean;
};

export type AttachmentsProps = TaskAttachmentsProps;

function getAttachmentTypeLabel(attachment: TaskAttachment | AttachFileItem) {
  const name = attachment.name?.trim() || '';
  const extension = name.includes('.') ? name.split('.').pop()?.toUpperCase() : '';
  const mimeType = attachment.type?.split('/')[0] || '';

  if (extension) return extension;
  if (mimeType === 'image') return 'IMG';
  if (mimeType === 'video') return 'VID';
  if (mimeType === 'audio') return 'AUD';
  if (mimeType === 'application') return 'FILE';

  return 'FILE';
}

function formatAttachmentMeta(dateStr?: string) {
  if (!dateStr) return 'Added';
  const createdDate = new Date(dateStr);
  if (Number.isNaN(createdDate.getTime())) return 'Added';

  const diffInMinutes = Math.floor((Date.now() - createdDate.getTime()) / 60000);
  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export function Attachments({
  attachments,
  taskId,
  projectId,
  workspaceId,
  onRenameAttachment,
  onRemoveAttachment,
  onAttachPage,
  onDetachPage,
  onAttachPaper,
  onDetachPaper,
  onAttachFile,
  onDetachFile,
  onAttachLink,
  onDetachLink,
  onCommentAttachment,
  onDownloadAttachment,
  isReadOnly = false,
}: TaskAttachmentsProps) {
  // Normalize attachments input (supporting both structured object and legacy flat array)
  const normalized: AttachCenterData = React.useMemo(() => {
    if (!attachments) return { pages: [], papers: [], files: [], links: [] };
    if (Array.isArray(attachments)) {
      return { pages: [], papers: [], files: attachments, links: [] };
    }
    return {
      pages: Array.isArray(attachments.pages) ? attachments.pages : [],
      papers: Array.isArray(attachments.papers) ? attachments.papers : [],
      files: Array.isArray(attachments.files) ? attachments.files : [],
      links: Array.isArray(attachments.links) ? attachments.links : [],
    };
  }, [attachments]);

  const [activeTab, setActiveTab] = useState<'pages' | 'papers' | 'files' | 'links'>('pages');

  // Dialog states for attaching
  const [openPageDialog, setOpenPageDialog] = useState(false);
  const [openPaperDialog, setOpenPaperDialog] = useState(false);
  const [openLinkDialog, setOpenLinkDialog] = useState(false);

  // Attach Page State
  const [projectPages, setProjectPages] = useState<Array<{ id: string; title: string }>>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [customPageTitle, setCustomPageTitle] = useState('');

  // Attach Paper State
  const [paperTitle, setPaperTitle] = useState('');
  const [paperDoi, setPaperDoi] = useState('');
  const [paperCitationKey, setPaperCitationKey] = useState('');

  // Attach Link State
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  // File rename state
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [renameItem, setRenameItem] = useState<TaskAttachment | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // File direct upload state
  const uploadFilesWithToast = useUploadFilesWithToast();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    setUploadingFiles(true);
    try {
      const results = await uploadFilesWithToast(fileList, {
        showSuccessToast: true,
        successMessage: 'File attached successfully',
        errorMessage: 'Failed to upload file',
      });
      results.forEach(({ file: f, url: uploadedUrl }) => {
        onAttachFile?.({
          name: f.name,
          url: uploadedUrl,
          size: f.size,
          type: f.type,
        });
      });
    } catch {
      // Toast already handled by uploadFilesWithToast
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch project pages when opening page dialog
  useEffect(() => {
    if (openPageDialog && projectId) {
      setLoadingPages(true);
      PageService.getProjectPages(projectId)
        .then((pages) => {
          setProjectPages(
            pages.map((p) => ({
              id: p.id,
              title: p.title || 'Untitled Page',
            })),
          );
        })
        .catch(() => setProjectPages([]))
        .finally(() => setLoadingPages(false));
    }
  }, [openPageDialog, projectId]);

  const handleConfirmAttachPage = () => {
    if (!selectedPageId) return;
    const found = projectPages.find((p) => p.id === selectedPageId);
    const title = found?.title || customPageTitle.trim() || 'Untitled Page';
    onAttachPage?.({ pageId: selectedPageId, title });
    setOpenPageDialog(false);
    setSelectedPageId('');
    setCustomPageTitle('');
  };

  const handleConfirmAttachPaper = () => {
    if (!paperTitle.trim()) return;
    const paperId = `paper-${Date.now()}`;
    onAttachPaper?.({
      paperId,
      title: paperTitle.trim(),
      doi: paperDoi.trim() || undefined,
      citationKey: paperCitationKey.trim() || undefined,
    });
    setOpenPaperDialog(false);
    setPaperTitle('');
    setPaperDoi('');
    setPaperCitationKey('');
  };

  const handleConfirmAttachLink = () => {
    if (!linkUrl.trim()) return;
    onAttachLink?.({
      title: linkTitle.trim() || linkUrl.trim(),
      url: linkUrl.trim(),
    });
    setOpenLinkDialog(false);
    setLinkTitle('');
    setLinkUrl('');
  };

  const pagesCount = normalized.pages?.length || 0;
  const papersCount = normalized.papers?.length || 0;
  const filesCount = normalized.files?.length || 0;
  const linksCount = normalized.links?.length || 0;
  const totalAttachments = pagesCount + papersCount + filesCount + linksCount;

  return (
    <div className="mt-8 border-t border-border pt-6">
      {/* Attach Center Header & Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Paperclip className="size-4 text-foreground shrink-0" />
          <h3 className="text-sm font-semibold text-foreground">
            Attach Center
          </h3>
          {totalAttachments > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              {totalAttachments}
            </span>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center rounded-md border border-border bg-muted p-0.5 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('pages')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
              activeTab === 'pages'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="size-3.5 shrink-0" />
            <span>Pages</span>
            {pagesCount > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-10 font-semibold">
                {pagesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('papers')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
              activeTab === 'papers'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen className="size-3.5 shrink-0" />
            <span>Papers</span>
            {papersCount > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-10 font-semibold">
                {papersCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
              activeTab === 'files'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Paperclip className="size-3.5 shrink-0" />
            <span>Files</span>
            {filesCount > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-10 font-semibold">
                {filesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('links')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
              activeTab === 'links'
                ? 'bg-background text-foreground shadow-none font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link2 className="size-3.5 shrink-0" />
            <span>Links</span>
            {linksCount > 0 && (
              <span className="ml-0.5 rounded-full bg-muted px-1.5 py-0.5 text-10 font-semibold">
                {linksCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── TAB 1: EDITOR PAGES (Academic / LaTeX Editor Manuscripts) ─────── */}
      {activeTab === 'pages' && (
        <div className="space-y-2">
          {pagesCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-6 px-4 text-center">
              <FileText className="size-8 text-muted-foreground mb-2 shrink-0" />
              <p className="text-xs text-muted-foreground font-medium">No Editor Pages attached</p>
              <p className="text-11 text-muted-foreground mt-0.5">
                Link LaTeX chapters, manuscripts, or research drafts to this work item.
              </p>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenPageDialog(true)}
                  className="mt-3 h-7 text-xs gap-1.5"
                >
                  <Plus className="size-3.5 shrink-0" />
                  Attach Page
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                {normalized.pages?.map((page) => (
                  <div
                    key={page.id}
                    className="group flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2.5 transition-colors hover:bg-muted"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileText className="size-4 shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {page.title}
                        </p>
                        <p className="text-10 text-muted-foreground">
                          {formatAttachmentMeta(page.addedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {workspaceId && (
                        <Link
                          href={`/${workspaceId}/editor/${page.id}`}
                          target="_blank"
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                          title="Open in LaTeX Editor"
                        >
                          <ExternalLink className="size-3.5 shrink-0" />
                        </Link>
                      )}
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => onDetachPage?.((page as any).pageId || page.id || '')}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                          title="Detach Page"
                        >
                          <Trash2 className="size-3.5 shrink-0" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenPageDialog(true)}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground mt-1"
                >
                  <Plus className="size-3.5 shrink-0" />
                  Attach Another Page
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: RESEARCH PAPERS (Library Citations) ────────────────────── */}
      {activeTab === 'papers' && (
        <div className="space-y-2">
          {papersCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-6 px-4 text-center">
              <BookOpen className="size-8 text-muted-foreground mb-2 shrink-0" />
              <p className="text-xs text-muted-foreground font-medium">No Research Papers attached</p>
              <p className="text-11 text-muted-foreground mt-0.5">
                Link reference citations with DOI and BibTeX keys.
              </p>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenPaperDialog(true)}
                  className="mt-3 h-7 text-xs gap-1.5"
                >
                  <Plus className="size-3.5 shrink-0" />
                  Attach Paper
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                {normalized.papers?.map((paper) => (
                  <div
                    key={paper.id}
                    className="group flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2.5 transition-colors hover:bg-muted"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <BookOpen className="size-4 shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {paper.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {paper.citationKey && (
                            <span className="font-mono text-10 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              @{paper.citationKey}
                            </span>
                          )}
                          {paper.doi && (
                            <span className="font-mono text-10 text-muted-foreground">
                              DOI: {paper.doi}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => onDetachPaper?.((paper as any).paperId || paper.id || '')}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                        title="Detach Paper"
                      >
                        <Trash2 className="size-3.5 shrink-0" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenPaperDialog(true)}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground mt-1"
                >
                  <Plus className="size-3.5 shrink-0" />
                  Attach Another Paper
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── TAB 3: FILES (Data, Media & Assets) ────────────────────────────── */}
      {activeTab === 'files' && (
        <div className="space-y-2">
          {!isReadOnly && (
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleDirectFileUpload}
            />
          )}
          {filesCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-6 px-4 text-center">
              <Paperclip className="size-8 text-muted-foreground mb-2 shrink-0" />
              <p className="text-xs text-muted-foreground font-medium">No files attached</p>
              <p className="text-11 text-muted-foreground mt-0.5">
                Upload experimental datasets, figures, or document assets.
              </p>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingFiles}
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 h-7 text-xs gap-1.5"
                >
                  {uploadingFiles ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin shrink-0" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5 shrink-0" />
                      Upload File
                    </>
                  )}
                </Button>
              )}
            </div>
          ) : (
            <>
              {!isReadOnly && (
                <div className="flex justify-end mb-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingFiles}
                    onClick={() => fileInputRef.current?.click()}
                    className="h-7 text-xs gap-1.5"
                  >
                    {uploadingFiles ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin shrink-0" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="size-3.5 shrink-0" />
                        Upload File
                      </>
                    )}
                  </Button>
                </div>
              )}
              <div className="space-y-1.5">
              {normalized.files?.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2.5 transition-colors hover:bg-muted"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-10 font-bold text-muted-foreground border border-border">
                      {getAttachmentTypeLabel(item)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-xs font-semibold text-foreground hover:underline"
                        title={item.name}
                      >
                        {item.name}
                      </a>
                      <p className="text-10 text-muted-foreground">
                        {formatAttachmentMeta(item.uploadedAt || (item as any).createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Open file"
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          const id = item.id;
                          if (!id) return;
                          if (onDetachFile) onDetachFile(id);
                          else if (onRemoveAttachment) onRemoveAttachment(id);
                        }}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                        title="Remove file"
                      >
                        <Trash2 className="size-3.5 shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        </div>
      )}

      {/* ── TAB 4: EXTERNAL LINKS ─────────────────────────────────────────── */}
      {activeTab === 'links' && (
        <div className="space-y-2">
          {linksCount === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-6 px-4 text-center">
              <Globe className="size-8 text-muted-foreground mb-2 shrink-0" />
              <p className="text-xs text-muted-foreground font-medium">No external links attached</p>
              <p className="text-11 text-muted-foreground mt-0.5">
                Attach ArXiv preprints, GitHub repositories, or journal articles.
              </p>
              {!isReadOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenLinkDialog(true)}
                  className="mt-3 h-7 text-xs gap-1.5"
                >
                  <Plus className="size-3.5 shrink-0" />
                  Add Link
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                {normalized.links?.map((link, idx) => (
                  <div
                    key={`${link.url}-${idx}`}
                    className="group flex items-center justify-between gap-3 rounded-md border border-border bg-card p-2.5 transition-colors hover:bg-muted"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Link2 className="size-4 shrink-0" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">
                          {link.title}
                        </p>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block truncate text-10 text-primary hover:underline"
                        >
                          {link.url}
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Open Link"
                      >
                        <ExternalLink className="size-3.5 shrink-0" />
                      </a>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => onDetachLink?.(idx)}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                          title="Remove Link"
                        >
                          <Trash2 className="size-3.5 shrink-0" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpenLinkDialog(true)}
                  className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground mt-1"
                >
                  <Plus className="size-3.5 shrink-0" />
                  Add Another Link
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* ── DIALOG: ATTACH EDITOR PAGE ─────────────────────────────────────── */}
      <Dialog open={openPageDialog} onOpenChange={setOpenPageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="size-4 text-primary shrink-0" />
              Attach Editor Page
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select a LaTeX manuscript or document from this project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {loadingPages ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-5 animate-spin text-muted-foreground shrink-0" />
              </div>
            ) : projectPages.length > 0 ? (
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {projectPages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => setSelectedPageId(page.id)}
                    className={`w-full text-left p-2.5 rounded-md border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      selectedPageId === page.id
                        ? 'border-primary bg-primary/5 text-foreground font-semibold'
                        : 'border-border hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span className="truncate">{page.title}</span>
                    {selectedPageId === page.id && (
                      <span className="size-2 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  No existing project pages found. Enter page ID or title manually:
                </p>
                <Input
                  placeholder="Page ID"
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Page Title"
                  value={customPageTitle}
                  onChange={(e) => setCustomPageTitle(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenPageDialog(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!selectedPageId}
              onClick={handleConfirmAttachPage}
              className="h-8 text-xs"
            >
              Attach Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: ATTACH RESEARCH PAPER ──────────────────────────────────── */}
      <Dialog open={openPaperDialog} onOpenChange={setOpenPaperDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="size-4 text-amber-500 shrink-0" />
              Attach Research Paper
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Link a research publication or citation to this work item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-11 font-medium text-foreground block mb-1">
                Paper Title *
              </label>
              <Input
                placeholder="e.g. Observation of Gravitational Waves"
                value={paperTitle}
                onChange={(e) => setPaperTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-11 font-medium text-foreground block mb-1">
                DOI (Digital Object Identifier)
              </label>
              <Input
                placeholder="e.g. 10.1103/PhysRevLett.116.061102"
                value={paperDoi}
                onChange={(e) => setPaperDoi(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-11 font-medium text-foreground block mb-1">
                BibTeX Citation Key
              </label>
              <Input
                placeholder="e.g. Abbott2016"
                value={paperCitationKey}
                onChange={(e) => setPaperCitationKey(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenPaperDialog(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!paperTitle.trim()}
              onClick={handleConfirmAttachPaper}
              className="h-8 text-xs"
            >
              Attach Paper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG: ATTACH EXTERNAL LINK ───────────────────────────────────── */}
      <Dialog open={openLinkDialog} onOpenChange={setOpenLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Link2 className="size-4 text-primary shrink-0" />
              Add External Link
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Attach an external reference URL to this work item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-11 font-medium text-foreground block mb-1">
                URL *
              </label>
              <Input
                placeholder="https://arxiv.org/abs/..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div>
              <label className="text-11 font-medium text-foreground block mb-1">
                Title / Label
              </label>
              <Input
                placeholder="e.g. ArXiv Preprint"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpenLinkDialog(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!linkUrl.trim()}
              onClick={handleConfirmAttachLink}
              className="h-8 text-xs"
            >
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const TaskAttachments = Attachments;
export default Attachments;
