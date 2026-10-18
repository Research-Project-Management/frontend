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
import { Input } from '@/shared/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import {
  Database,
  Search,
  UploadCloud,
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
  FolderArchive,
  Layers,
  Calendar,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
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
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const SHEET_EXTS = new Set(['xls', 'xlsx', 'csv']);
const CODE_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'md', 'txt',
]);

function getDocumentVisuals(title: string, type?: string) {
  const parts = (title || '').split('.');
  const ext = (parts.length > 1 ? parts.pop() || '' : type || '').toLowerCase();

  if (ext === 'pdf') {
    return {
      label: 'PDF',
      icon: FileText,
      color: 'text-destructive',
      bg: 'bg-destructive/10 border-destructive/20',
    };
  }

  if (IMAGE_EXTS.has(ext)) {
    return {
      label: ext.toUpperCase(),
      icon: FileImage,
      color: 'text-primary',
      bg: 'bg-primary/10 border-primary/20',
    };
  }

  if (SHEET_EXTS.has(ext)) {
    return {
      label: 'Spreadsheet',
      icon: FileSpreadsheet,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
    };
  }

  if (CODE_EXTS.has(ext)) {
    return {
      label: ext.toUpperCase(),
      icon: FileCode,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 border-amber-500/20',
    };
  }

  return {
    label: ext ? ext.toUpperCase() : 'DOC',
    icon: File,
    color: 'text-muted-foreground',
    bg: 'bg-muted border-border',
  };
}

export function DocumentLibraryModal({
  open,
  onOpenChange,
  projectId,
}: DocumentLibraryModalProps) {
  const { sources, addSource, removeSource, setFluxDataEnabled } = useChatMode();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ percent: number; stage: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Content Preview state
  const [previewDoc, setPreviewDoc] = useState<{ title: string; content: string } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const docs = await fetchDocuments(projectId);
      setDocuments(docs);
    } catch (err: unknown) {
      toast.error('Failed to load documents: ' + (err instanceof Error ? err.message : 'Network error'));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      loadDocuments();
    }
  }, [open, loadDocuments]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => {
      const titleMatch = (doc.title || '').toLowerCase().includes(q);
      const tagMatch = (doc.tags || []).some((t) => t.toLowerCase().includes(q));
      const typeMatch = (doc.type || '').toLowerCase().includes(q);
      return titleMatch || tagMatch || typeMatch;
    });
  }, [documents, searchQuery]);

  const activeSourceIds = useMemo(() => {
    return new Set(sources.filter((s) => s.enabled).map((s) => s.id));
  }, [sources]);

  const handleToggleSourceInChat = (doc: DocumentItem) => {
    if (activeSourceIds.has(doc.id)) {
      removeSource(doc.id);
      toast.info(`Removed "${doc.title}" from chat session`);
    } else {
      addSource(doc.id, doc.title, { sourceType: 'upload' });
      setFluxDataEnabled(true);
      toast.success(`Added "${doc.title}" to Q&A context`);
    }
  };

  const handleDelete = async (docId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}" from the vector knowledge base?`)) {
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
        content: res.text || 'No text content could be extracted.',
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
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
      toast.success(`Added ${successCount} new documents to knowledge base`);
      loadDocuments();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
          {/* Header */}
          <DialogHeader className="px-6 py-4 border-b border-border/80 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                  <Database className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base font-semibold text-foreground">
                      AI Document Library
                    </DialogTitle>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground font-medium">
                      {documents.length} documents
                    </span>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Manage uploaded research documents for AI analysis and accurate retrieval-augmented generation (RAG).
                  </DialogDescription>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadDocuments}
                  disabled={isLoading}
                  className="h-8 gap-1.5 text-xs"
                >
                  <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
                  <span>Refresh</span>
                </Button>

                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isUploading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="size-3.5" />
                  )}
                  <span>Upload documents</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.json,.ts,.tsx,.js,.py"
                />
              </div>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && uploadProgress && (
              <div className="mt-3 p-2.5 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-3 text-xs">
                <Loader2 className="size-4 text-primary animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between font-medium text-foreground mb-1">
                    <span>
                      {uploadProgress.stage === 'processing'
                        ? 'Extracting content & indexing vector store...'
                        : 'Uploading files...'}
                    </span>
                    <span>{uploadProgress.percent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Search bar */}
            <div className="relative mt-3">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documents by filename, topic, or label..."
                className="pl-9 h-8.5 text-xs bg-muted/40 border-border/70"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </DialogHeader>

          {/* Body List */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading && documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-xs">Loading document library...</p>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-6 border border-dashed rounded-xl border-border/80">
                <div className="size-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-3">
                  <FolderArchive className="size-6" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {searchQuery ? 'No matching documents found' : 'No documents in library yet'}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                  {searchQuery
                    ? `Try searching with different keywords.`
                    : 'Upload PDF, Word, reports, or code files for intelligent AI search and retrieval.'}
                </p>
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2 text-xs"
                >
                  <UploadCloud className="size-4" />
                  <span>Upload first document</span>
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredDocs.map((doc) => {
                  const visuals = getDocumentVisuals(doc.title, doc.type);
                  const Icon = visuals.icon;
                  const isAttached = activeSourceIds.has(doc.id);

                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        "group relative flex flex-col justify-between p-3.5 rounded-xl border transition-all text-left bg-card hover:shadow-xs",
                        isAttached
                          ? "border-primary/50 bg-primary/[0.02] ring-1 ring-primary/20"
                          : "border-border/80 hover:border-border"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "size-10 rounded-lg flex items-center justify-center shrink-0 border",
                            visuals.bg,
                            visuals.color
                          )}
                        >
                          <Icon className="size-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-xs font-semibold text-foreground truncate"
                            title={doc.title}
                          >
                            {doc.title}
                          </h4>

                          <div className="flex items-center gap-2 text-10 text-muted-foreground mt-1 flex-wrap">
                            <span className="font-medium px-1.5 py-0.5 rounded bg-muted border border-border/50 text-foreground/80">
                              {visuals.label}
                            </span>
                            <span className="flex items-center gap-1">
                              <Layers className="size-3 text-muted-foreground/80" />
                              {doc.chunk_count || 1} chunks
                            </span>
                            {doc.created_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3 text-muted-foreground/80" />
                                {new Date(doc.created_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          {/* Tags if any */}
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex items-center gap-1 mt-2 flex-wrap">
                              {doc.tags.map((tag, tIdx) => (
                                <span
                                  key={tIdx}
                                  className="text-9 px-1.5 py-0.5 rounded-md bg-secondary text-secondary-foreground"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/50">
                        <Button
                          variant={isAttached ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => handleToggleSourceInChat(doc)}
                          className={cn(
                            "h-7 text-xs gap-1.5 px-2.5 font-medium transition-colors",
                            isAttached
                              ? "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                              : "hover:bg-muted"
                          )}
                        >
                          {isAttached ? (
                            <>
                              <Check className="size-3 text-primary shrink-0" />
                              <span>In Chat</span>
                            </>
                          ) : (
                            <>
                              <Plus className="size-3 shrink-0" />
                              <span>Add to Chat</span>
                            </>
                          )}
                        </Button>

                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreview(doc.id, doc.title)}
                                className="size-7 p-0 text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="size-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              View extracted content
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(doc.id, doc.title)}
                                disabled={isDeletingId === doc.id}
                                className="size-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                {isDeletingId === doc.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="size-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              Delete from knowledge base
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Content Preview Sub-Dialog */}
      <Dialog open={Boolean(previewDoc)} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-5 bg-background">
          <DialogHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary shrink-0" />
              <DialogTitle className="text-sm font-semibold truncate">
                {previewDoc?.title}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Text has been extracted and chunked in the vector store.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 rounded-lg bg-muted/40 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text max-h-[55vh]">
            {isPreviewLoading ? (
              <div className="flex items-center justify-center p-8 gap-2 text-muted-foreground">
                <Loader2 className="size-4.5 animate-spin text-primary" />
                <span>Extracting content from vector store...</span>
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
