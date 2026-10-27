'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  Database,
  Search,
  Upload,
  FileText,
  FileCode,
  FileSpreadsheet,
  FileImage,
  File,
  Trash2,
  Eye,
  Check,
  Plus,
  Loader2,
  RefreshCw,
  X,
  Copy,
  Layers,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import {
  fetchDocuments,
  deleteDocument,
  fetchDocumentContent,
  uploadDocument,
} from '../../services/chat.service';
import type { DocumentItem } from '../../types/chat.types';
import { useChatMode } from '../../hooks/use-chat-mode';

export interface DocumentLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSelectItem?: (item: { id: string; name: string; size: number }) => void;
}

type FileFormatCategory = 'all' | 'pdf' | 'doc' | 'sheet' | 'code' | 'image';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const SHEET_EXTS = new Set(['xls', 'xlsx', 'csv', 'tsv']);
const DOC_EXTS = new Set(['doc', 'docx', 'txt', 'md', 'rtf']);
const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'sql', 'html', 'css',
]);

const ACCEPTED_TYPES =
  '.pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.json,.ts,.tsx,.js,.py';

function formatBytes(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentVisuals(title: string, type?: string) {
  const parts = (title || '').split('.');
  const ext = (parts.length > 1 ? parts.pop() || '' : type || '').toLowerCase();

  if (ext === 'pdf') {
    return {
      category: 'pdf' as FileFormatCategory,
      label: 'PDF',
      icon: FileText,
      iconColor: 'text-destructive',
    };
  }

  if (IMAGE_EXTS.has(ext)) {
    return {
      category: 'image' as FileFormatCategory,
      label: ext.toUpperCase(),
      icon: FileImage,
      iconColor: 'text-primary',
    };
  }

  if (SHEET_EXTS.has(ext)) {
    return {
      category: 'sheet' as FileFormatCategory,
      label: ext.toUpperCase(),
      icon: FileSpreadsheet,
      iconColor: 'text-success',
    };
  }

  if (CODE_EXTS.has(ext)) {
    return {
      category: 'code' as FileFormatCategory,
      label: ext.toUpperCase(),
      icon: FileCode,
      iconColor: 'text-warning',
    };
  }

  if (DOC_EXTS.has(ext)) {
    return {
      category: 'doc' as FileFormatCategory,
      label: ext.toUpperCase(),
      icon: FileText,
      iconColor: 'text-primary',
    };
  }

  return {
    category: 'doc' as FileFormatCategory,
    label: ext ? ext.toUpperCase() : 'DOC',
    icon: File,
    iconColor: 'text-muted-foreground',
  };
}

export function DocumentLibraryModal({
  open,
  onOpenChange,
  projectId,
  onSelectItem,
}: DocumentLibraryModalProps) {
  const { sources, addSource, removeSource, setFluxDataEnabled } = useChatMode();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FileFormatCategory>('all');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content Preview state
  const [previewDoc, setPreviewDoc] = useState<{ title: string; content: string } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await fetchDocuments(projectId);
      setDocuments(docs || []);
    } catch (err: unknown) {
      toast.error('Failed to load documents: ' + (err instanceof Error ? err.message : 'Network error'));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      loadDocuments();
    } else {
      setSearchQuery('');
      setSelectedCategory('all');
    }
  }, [open, loadDocuments]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts: Record<FileFormatCategory, number> = {
      all: documents.length,
      pdf: 0,
      doc: 0,
      sheet: 0,
      code: 0,
      image: 0,
    };

    for (const doc of documents) {
      const vis = getDocumentVisuals(doc.title, doc.type);
      counts[vis.category] = (counts[vis.category] || 0) + 1;
    }

    return counts;
  }, [documents]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    let result = documents;

    if (selectedCategory !== 'all') {
      result = result.filter((doc) => {
        const vis = getDocumentVisuals(doc.title, doc.type);
        return vis.category === selectedCategory;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((doc) => {
        const titleMatch = (doc.title || '').toLowerCase().includes(q);
        const tagMatch = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
        const typeMatch = (doc.type || '').toLowerCase().includes(q);
        return titleMatch || tagMatch || typeMatch;
      });
    }

    return result;
  }, [documents, selectedCategory, searchQuery]);

  const activeSourceIds = useMemo(() => {
    return new Set(sources.filter((s) => s.enabled).map((s) => s.id));
  }, [sources]);

  const handleToggleSourceInChat = (doc: DocumentItem) => {
    if (onSelectItem) {
      onSelectItem({ id: doc.id, name: doc.title, size: doc.size || 0 });
      return;
    }

    if (activeSourceIds.has(doc.id)) {
      removeSource(doc.id);
      toast.info(`Removed "${doc.title}" from chat context`);
    } else {
      addSource(doc.id, doc.title, { size: doc.size, sourceType: 'upload' });
      setFluxDataEnabled(true);
      toast.success(`Attached "${doc.title}" to chat context`);
    }
  };

  const handleDelete = async (docId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      return;
    }
    setIsDeletingId(docId);
    try {
      await deleteDocument(docId, projectId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      removeSource(docId);
      toast.success(`Deleted "${title}" successfully`);
    } catch (err: unknown) {
      toast.error('Failed to delete document: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsDeletingId(null);
    }
  };

  const handlePreview = async (docId: string, title: string) => {
    setIsPreviewLoading(true);
    setPreviewDoc({ title, content: '' });
    try {
      const res = await fetchDocumentContent(docId);
      setPreviewDoc({
        title,
        content: res?.text || 'No readable text content extracted.',
      });
    } catch {
      setPreviewDoc({
        title,
        content: 'Unable to load preview content for this document.',
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    if (!files.length) return;

    setIsUploading(true);
    let successCount = 0;

    for (const file of files) {
      try {
        const targetScope = projectId === 'all' || !projectId ? 'me' : projectId;
        const res = await uploadDocument(targetScope, file, (progress) => {
          setUploadProgress(progress);
        });
        successCount++;
        addSource(res.id, res.name, {
          size: res.size || file.size,
          sourceType: 'upload',
        });
      } catch (err: unknown) {
        toast.error(`Error uploading ${file.name}: ${err instanceof Error ? err.message : 'Upload error'}`);
      }
    }

    setIsUploading(false);
    setUploadProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} document${successCount > 1 ? 's' : ''}`);
      loadDocuments();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleUploadFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      handleUploadFiles(files);
    }
  };

  const categories: Array<{ id: FileFormatCategory; label: string }> = [
    { id: 'all', label: `All (${categoryCounts.all})` },
    { id: 'pdf', label: `PDF (${categoryCounts.pdf})` },
    { id: 'doc', label: `Documents (${categoryCounts.doc})` },
    { id: 'sheet', label: `Sheets (${categoryCounts.sheet})` },
    { id: 'code', label: `Code (${categoryCounts.code})` },
    { id: 'image', label: `Images (${categoryCounts.image})` },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="w-[94vw] sm:max-w-[760px] md:max-w-[820px] max-h-[85vh] h-[640px] flex flex-col p-0 overflow-hidden rounded-lg border border-border bg-background shadow-raised-200 duration-150 gap-0 z-50 select-none"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileInputChange}
          />

          {/* ── 1. Modal Header (Hairline border, 13px/32px cadence per DESIGN.md) ────── */}
          <DialogHeader className="h-12 px-4.5 border-b border-border bg-background flex flex-row items-center justify-between shrink-0 select-none">
            <div className="flex items-center gap-2.5 min-w-0">
              <Database className="size-4 text-foreground shrink-0" />
              <DialogTitle className="text-13 font-semibold text-foreground tracking-tight">
                Uploaded documents
              </DialogTitle>
              <span className="text-11 font-mono font-medium px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground border border-border tabular-nums">
                {documents.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label="Close dialog"
              >
                <X className="size-3.5 shrink-0" />
              </button>
            </div>
          </DialogHeader>

          {/* ── 2. Toolbar: Search + Actions ───────────────────────────────────── */}
          <div className="px-4 py-2 border-b border-border bg-background flex items-center justify-between gap-2.5 shrink-0">
            {/* Search Input (No blue border, rounded-md) */}
            <div className="flex-1 max-w-sm relative flex items-center h-8 rounded-md border border-border bg-background px-2.5 transition-colors">
              <Search className="size-3.5 text-muted-foreground shrink-0 mr-2 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents..."
                className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer rounded ml-1"
                  aria-label="Clear search"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Actions: Refresh & Upload */}
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={loadDocuments}
                    disabled={isLoading}
                    className="size-8 flex items-center justify-center rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
                    aria-label="Refresh list"
                  >
                    <RefreshCw className={cn("size-3.5 text-foreground", isLoading && "animate-spin")} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Refresh documents
                </TooltipContent>
              </Tooltip>

              <Button
                type="button"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-8 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary-hover text-12 font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-none active:scale-95 disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                <span>Upload document</span>
              </Button>
            </div>
          </div>

          {/* ── 3. Category Filter Tabs ────────────────────────────────────────── */}
          <div className="px-4 py-1.5 border-b border-border bg-background flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    'h-6.5 px-2 rounded-md text-11 transition-colors cursor-pointer shrink-0 font-medium',
                    isActive
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* ── Drag & Drop Active Overlay ─────────────────────────────────────── */}
          {isDragging && (
            <div className="absolute inset-0 z-30 bg-background/90 backdrop-blur-xs border-2 border-dashed border-primary flex flex-col items-center justify-center gap-2 pointer-events-none">
              <Upload className="size-8 text-primary animate-bounce" />
              <p className="text-13 font-semibold text-foreground">Drop files to upload to knowledge base</p>
              <p className="text-11 text-muted-foreground">PDF, Word, Text, CSV, Excel, Code</p>
            </div>
          )}

          {/* ── Uploading Progress Bar ─────────────────────────────────────────── */}
          {isUploading && uploadProgress && (
            <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center gap-3 shrink-0 text-11">
              <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between font-medium text-foreground mb-1">
                  <span className="truncate">
                    {uploadProgress.stage === 'processing'
                      ? 'Extracting content & indexing vector store...'
                      : 'Uploading files...'}
                  </span>
                  <span className="font-mono">{uploadProgress.percent}%</span>
                </div>
                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── 4. Main Body: High-density Document List ───────────────────────── */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading && documents.length === 0 ? (
              <div className="h-full flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="size-5 animate-spin mr-2 text-foreground" />
                <span className="text-12">Loading documents...</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="h-full flex items-center justify-center p-6">
                <PlaneEmptyState
                  variant="document"
                  isCompact
                  title={searchQuery ? "No matching documents" : "No documents uploaded yet"}
                  description={
                    searchQuery
                      ? "Try searching with a different filename or keyword."
                      : "Upload research papers, PDF, DOCX, or code files to index into your AI knowledge base."
                  }
                  action={{
                    label: "Upload document",
                    icon: Upload,
                    onClick: () => fileInputRef.current?.click(),
                  }}
                />
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {filteredDocs.map((doc) => {
                  const visuals = getDocumentVisuals(doc.title, doc.type);
                  const Icon = visuals.icon;
                  const isAttached = activeSourceIds.has(doc.id);
                  const formattedSize = formatBytes(doc.size);

                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "group h-11 px-4 flex items-center justify-between gap-3 text-12 transition-colors",
                        isAttached
                          ? "bg-primary/[0.03] hover:bg-primary/[0.06]"
                          : "hover:bg-muted/50"
                      )}
                    >
                      {/* Left: Icon + Title + Meta */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <Icon className={cn("size-4 shrink-0", visuals.iconColor)} />
                        <span
                          className="font-medium text-foreground truncate text-12 tracking-tight"
                          title={doc.title}
                        >
                          {doc.title}
                        </span>

                        <span className="text-10 font-mono uppercase px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/60 shrink-0">
                          {visuals.label}
                        </span>

                        {formattedSize && (
                          <span className="text-11 font-mono text-muted-foreground shrink-0 hidden sm:inline">
                            {formattedSize}
                          </span>
                        )}

                        {doc.created_at && (
                          <span className="text-11 text-muted-foreground/70 shrink-0 hidden md:inline">
                            {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {/* Right: Attach status & actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Attach/Detach Toggle Button */}
                        <Button
                          type="button"
                          size="sm"
                          variant={isAttached ? "secondary" : "outline"}
                          onClick={() => handleToggleSourceInChat(doc)}
                          className={cn(
                            "h-7 px-2.5 text-11 font-medium rounded-md gap-1 transition-colors cursor-pointer",
                            isAttached
                              ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                              : "border-border bg-background hover:bg-muted text-foreground"
                          )}
                        >
                          {isAttached ? (
                            <>
                              <Check className="size-3 text-primary shrink-0" />
                              <span>Attached</span>
                            </>
                          ) : (
                            <>
                              <Plus className="size-3 shrink-0" />
                              <span>Attach</span>
                            </>
                          )}
                        </Button>

                        {/* Preview Content Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handlePreview(doc.id, doc.title)}
                              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer outline-none"
                              aria-label="Preview extracted text"
                            >
                              <Eye className="size-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Preview extracted text
                          </TooltipContent>
                        </Tooltip>

                        {/* Delete Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => handleDelete(doc.id, doc.title)}
                              disabled={isDeletingId === doc.id}
                              className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer outline-none disabled:opacity-50"
                              aria-label="Delete document"
                            >
                              {isDeletingId === doc.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            Delete from knowledge base
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 5. Modal Footer ────────────────────────────────────────────────── */}
          <div className="h-11 px-4 border-t border-border bg-background flex items-center justify-between shrink-0 text-12 text-muted-foreground">
            <div>
              <span>
                Attached in current chat: <strong className="text-foreground font-semibold">{activeSourceIds.size}</strong> document{activeSourceIds.size !== 1 ? 's' : ''}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-7.5 px-3 rounded-md border-border bg-background hover:bg-muted text-foreground text-12 font-medium"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Document Content Preview Sub-Dialog ───────────────────────────────── */}
      <Dialog open={Boolean(previewDoc)} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent
          showCloseButton={false}
          className="w-[94vw] sm:max-w-2xl max-h-[80vh] flex flex-col p-0 overflow-hidden rounded-lg border border-border bg-background shadow-raised-200 duration-150 gap-0 z-50 select-none"
        >
          <DialogHeader className="h-11 px-4 border-b border-border flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="size-4 text-foreground shrink-0" />
              <DialogTitle className="text-13 font-semibold text-foreground truncate max-w-md">
                {previewDoc?.title}
              </DialogTitle>
            </div>

            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewDoc?.content) {
                        navigator.clipboard.writeText(previewDoc.content);
                        toast.success('Copied text to clipboard');
                      }
                    }}
                    className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none"
                    aria-label="Copy text"
                  >
                    <Copy className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Copy text
                </TooltipContent>
              </Tooltip>

              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="size-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none"
                aria-label="Close preview"
              >
                <X className="size-3.5 shrink-0" />
              </button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 bg-muted/20 font-mono text-12 leading-relaxed whitespace-pre-wrap select-text max-h-[55vh] text-foreground">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center p-8 gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-foreground" />
                <span className="text-12">Extracting content from vector store...</span>
              </div>
            ) : (
              previewDoc?.content
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DocumentLibraryModal;
