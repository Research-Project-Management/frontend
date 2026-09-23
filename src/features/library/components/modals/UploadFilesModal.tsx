'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Loader2,
  FileCode2,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Progress,
  ScrollArea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui';

import {
  useCollectionsQuery,
  uploadLibraryFileMultipart,
  IngestionService,
  itemKeys,
  invalidateCollections,
} from '../../data';
import { useLibrarySidebarStore } from '../../store';
import type { Collection } from '../../types';

export interface QueuedUploadItem {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'extracting' | 'completed' | 'error';
  progress: number;
  error?: string;
  extractedTitle?: string;
  extractedAuthors?: string;
  abortController?: AbortController;
}

export interface UploadFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeId?: string;
  defaultCollectionId?: string;
  initialFiles?: File[];
  onSuccess?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.bib') || lower.endsWith('.bibtex') || lower.endsWith('.ris')) {
    return <FileCode2 className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />;
  }
  return <FileText className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />;
}

export default function UploadFilesModal({
  open,
  onOpenChange,
  scopeId,
  defaultCollectionId,
  initialFiles = [],
  onSuccess,
}: UploadFilesModalProps) {
  const queryClient = useQueryClient();
  const routeParams = useParams() as { collectionId?: string };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: collections = [] } = useCollectionsQuery(scopeId);

  const activeScope = useLibrarySidebarStore((s) => s.activeScope);
  const rootLibraryName =
    activeScope?.name || (activeScope?.type === 'project' ? 'Project Library' : 'My Library');

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(() => {
    return defaultCollectionId || routeParams?.collectionId || '';
  });
  const [items, setItems] = useState<QueuedUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const selectedCollectionIdRef = useRef(selectedCollectionId);
  selectedCollectionIdRef.current = selectedCollectionId;

  const isProcessingRef = useRef(false);

  // Sync selected collection when modal opens or collections change
  useEffect(() => {
    if (open) {
      const activeId = defaultCollectionId || routeParams?.collectionId;
      if (activeId && collections.some((c: Collection) => c.id === activeId)) {
        setSelectedCollectionId(activeId);
      } else {
        setSelectedCollectionId('');
      }
    }
  }, [open, defaultCollectionId, routeParams?.collectionId, collections]);

  const addFilesToQueue = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setItems((prev) => {
      const existingNames = new Set(prev.map((i) => i.file.name + i.file.size));
      const newItems: QueuedUploadItem[] = [];

      for (const file of fileArray) {
        const key = file.name + file.size;
        if (!existingNames.has(key)) {
          newItems.push({
            id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            status: 'queued',
            progress: 0,
          });
          existingNames.add(key);
        }
      }

      return [...prev, ...newItems];
    });
  }, []);

  // Append initial files if provided when opening modal
  useEffect(() => {
    if (open && initialFiles.length > 0) {
      addFilesToQueue(initialFiles);
    }
  }, [open, initialFiles, addFilesToQueue]);

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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
      e.target.value = '';
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.abortController) {
        target.abortController.abort();
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearCompleted = () => {
    setItems((prev) => prev.filter((item) => item.status !== 'completed'));
  };

  // Upload a single file item with live progress and metadata extraction
  const processSingleItem = useCallback(
    async (item: QueuedUploadItem, targetCollection?: string): Promise<boolean> => {
      const abortController = new AbortController();

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: 'uploading', progress: 5, abortController, error: undefined }
            : i
        )
      );

      const file = item.file;
      const lowerName = file.name.toLowerCase();
      const effectiveCollection = targetCollection || undefined;

      try {
        if (lowerName.endsWith('.bib') || lowerName.endsWith('.bibtex')) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'extracting', progress: 50 } : i
            )
          );
          const content = await file.text();
          const res = await IngestionService.ingest(scopeId, {
            source: 'bibtex',
            content,
            collectionId: effectiveCollection,
          });

          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: 'completed',
                    progress: 100,
                    extractedTitle: (res?.data?.item as any)?.title || file.name,
                  }
                : i
            )
          );
          return true;
        }

        if (lowerName.endsWith('.ris')) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'extracting', progress: 50 } : i
            )
          );
          const content = await file.text();
          const res = await IngestionService.ingest(scopeId, {
            source: 'ris',
            content,
            collectionId: effectiveCollection,
          });

          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: 'completed',
                    progress: 100,
                    extractedTitle: (res?.data?.item as any)?.title || file.name,
                  }
                : i
            )
          );
          return true;
        }

        // Binary Document / PDF upload with live multipart progress
        const uploadRes = await uploadLibraryFileMultipart(scopeId, file, {
          signal: abortController.signal,
          onProgress: (percent) => {
            setItems((prev) =>
              prev.map((i) =>
                i.id === item.id
                  ? {
                      ...i,
                      progress: Math.min(Math.max(percent, 5), 90),
                    }
                  : i
              )
            );
          },
        });

        if (!uploadRes?.fileId) {
          throw new Error('Upload succeeded without file identifier');
        }

        // Extraction stage
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'extracting', progress: 95 }
              : i
          )
        );

        const ingestRes = await IngestionService.ingest(scopeId, {
          source: 'pdf',
          fileId: uploadRes.fileId,
          filename: file.name,
          collectionId: effectiveCollection,
        });

        const resItem = ingestRes?.data?.item as any;
        const identifiedTitle =
          resItem?.title ||
          file.name.replace(/\.[^/.]+$/, '');
        const authors =
          resItem?.creators?.map((c: any) => c.fullName || `${c.lastName || ''} ${c.firstName || ''}`.trim()).filter(Boolean).join(', ') ||
          resItem?.firstAuthor ||
          undefined;

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'completed',
                  progress: 100,
                  extractedTitle: identifiedTitle,
                  extractedAuthors: authors,
                }
              : i
          )
        );
        return true;
      } catch (err: any) {
        if (err.message === 'Upload aborted by user') {
          return false;
        }
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  error: err?.message || 'Failed to process document',
                }
              : i
          )
        );
        return false;
      }
    },
    [scopeId]
  );

  // Auto-process queue
  const triggerQueue = useCallback(async () => {
    if (isProcessingRef.current) return;

    const queuedItems = itemsRef.current.filter((i) => i.status === 'queued');
    if (queuedItems.length === 0) return;

    isProcessingRef.current = true;
    setIsProcessingBatch(true);

    const queue = [...queuedItems];
    const concurrency = 2;
    let successCount = 0;

    const runWorker = async () => {
      while (queue.length > 0) {
        const nextItem = queue.shift();
        if (!nextItem) break;
        // Verify item hasn't been removed from queue
        if (!itemsRef.current.some((i) => i.id === nextItem.id)) continue;
        const ok = await processSingleItem(nextItem, selectedCollectionIdRef.current);
        if (ok) successCount++;
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, queue.length) },
      () => runWorker()
    );

    await Promise.all(workers);

    isProcessingRef.current = false;
    setIsProcessingBatch(false);

    // Invalidate queries so library table immediately displays new items
    queryClient.invalidateQueries({ queryKey: itemKeys.all(scopeId) });
    queryClient.invalidateQueries({ queryKey: ['items', scopeId] });
    if (selectedCollectionIdRef.current) {
      queryClient.invalidateQueries({
        queryKey: itemKeys.byCollection(scopeId, selectedCollectionIdRef.current),
      });
    }
    invalidateCollections(queryClient, scopeId);

    if (successCount > 0 && onSuccess) {
      onSuccess();
    }

    // Check if more items arrived while batch was running
    const remainingQueued = itemsRef.current.filter((i) => i.status === 'queued');
    if (remainingQueued.length > 0) {
      triggerQueue();
    }
  }, [processSingleItem, queryClient, scopeId, onSuccess]);

  // Reactive trigger: automatically start whenever new items enter 'queued' state
  useEffect(() => {
    const hasQueued = items.some((i) => i.status === 'queued');
    if (hasQueued && !isProcessingRef.current) {
      triggerQueue();
    }
  }, [items, triggerQueue]);

  const handleRetry = (item: QueuedUploadItem) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? { ...i, status: 'queued', progress: 0, error: undefined }
          : i
      )
    );
  };

  const completedCount = items.filter((i) => i.status === 'completed').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const isUploading = items.some(
    (i) => i.status === 'uploading' || i.status === 'extracting'
  );

  const canClose = !isUploading;

  return (
    <Dialog open={open} onOpenChange={(v) => canClose && onOpenChange(v)}>
      <DialogContent
        className="sm:max-w-[580px] max-h-[85vh] flex flex-col p-6 overflow-hidden gap-4 rounded-xl border border-border bg-background shadow-raised-200"
        onEscapeKeyDown={(e) => !canClose && e.preventDefault()}
        onPointerDownOutside={(e) => !canClose && e.preventDefault()}
      >
        <DialogHeader className="p-0 shrink-0">
          <DialogTitle className="text-15 font-semibold text-foreground tracking-tight">
            Upload Files
          </DialogTitle>
          <DialogDescription className="sr-only">
            Upload files to library
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 min-h-0 overflow-y-auto">
          {/* Target Collection Selector */}
          <div className="flex items-center gap-2.5 text-12">
            <span className="text-muted-foreground shrink-0 font-medium">Collection:</span>
            <Select
              value={selectedCollectionId || 'root'}
              onValueChange={(val) => setSelectedCollectionId(val === 'root' ? '' : val)}
              disabled={isUploading}
            >
              <SelectTrigger
                aria-label="Collection"
                className="h-8 text-12 text-foreground min-w-[180px] max-w-[260px] justify-between rounded-md border-border bg-background shadow-2xs hover:border-foreground/30"
              >
                <SelectValue placeholder={rootLibraryName} />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                <SelectItem value="root" className="rounded-md text-12">
                  {rootLibraryName}
                </SelectItem>
                {collections.map((c: Collection) => (
                  <SelectItem key={c.id} value={c.id} className="rounded-md text-12">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed rounded-xl py-10 px-6 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50 hover:bg-muted/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.bib,.bibtex,.ris"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <div className="flex flex-col items-center justify-center gap-2.5">
              <UploadCloud className="size-7 text-muted-foreground/60 mb-0.5" strokeWidth={1.5} />
              <div className="space-y-1">
                <p className="text-13 font-medium text-foreground">
                  Drop files or click to browse
                </p>
                <p className="text-12 text-muted-foreground">
                  PDF, BibTeX, or RIS (max 100MB)
                </p>
              </div>
            </div>
          </div>

          {/* File Queue List */}
          {items.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-11 text-muted-foreground px-0.5">
                <span>
                  {items.length} {items.length === 1 ? 'file' : 'files'}
                  {completedCount > 0 && ` · ${completedCount} complete`}
                  {errorCount > 0 && ` · ${errorCount} failed`}
                </span>
                {completedCount > 0 && (
                  <button
                    type="button"
                    onClick={clearCompleted}
                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    Clear completed
                  </button>
                )}
              </div>

              <ScrollArea className="max-h-[260px] rounded-md border border-border divide-y divide-border/60">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 flex items-start gap-2.5 text-12 hover:bg-muted/20 transition-colors"
                  >
                    <div className="pt-0.5">{getFileIcon(item.file.name)}</div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground truncate" title={item.file.name}>
                          {item.file.name}
                        </span>
                        <span className="text-11 text-muted-foreground shrink-0 font-mono">
                          {formatFileSize(item.file.size)}
                        </span>
                      </div>

                      {/* Status row */}
                      {item.status === 'queued' && (
                        <div className="flex items-center justify-between text-muted-foreground text-11">
                          <span>Queued</span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors"
                            title="Remove"
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      )}

                      {item.status === 'uploading' && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-11 text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="size-3 animate-spin text-muted-foreground" />
                              Uploading
                            </span>
                            <span className="font-mono">{item.progress}%</span>
                          </div>
                          <Progress value={item.progress} className="h-1" />
                        </div>
                      )}

                      {item.status === 'extracting' && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-11 text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Loader2 className="size-3 animate-spin text-muted-foreground" />
                              Processing
                            </span>
                          </div>
                          <Progress value={95} className="h-1" />
                        </div>
                      )}

                      {item.status === 'completed' && (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-12 font-medium text-foreground">
                            <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate">
                              {item.extractedTitle || item.file.name}
                            </span>
                          </div>
                          {item.extractedAuthors && (
                            <p className="text-11 text-muted-foreground truncate pl-5">
                              {item.extractedAuthors}
                            </p>
                          )}
                        </div>
                      )}

                      {item.status === 'error' && (
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <div className="flex items-center gap-1 text-destructive text-11">
                            <AlertCircle className="size-3 shrink-0" />
                            <span className="truncate">{item.error || 'Failed'}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRetry(item)}
                            className="h-5 text-11 px-1.5 gap-1 shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <RefreshCw className="size-2.5" />
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
