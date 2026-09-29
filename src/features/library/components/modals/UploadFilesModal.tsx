'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  UploadCloud,
  FileText,
  X,
  Upload,
  Folder,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui';

import { useCollectionsQuery } from '../../data';
import { useLibrarySidebarStore, useProcessModalStore } from '../../store';
import type { Collection } from '../../types';

export interface StagedUploadItem {
  id: string;
  file: File;
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

function getFileTypeBadge(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return (
      <span className="px-1.5 py-0.5 rounded text-10 font-semibold bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
        PDF
      </span>
    );
  }
  if (lower.endsWith('.bib') || lower.endsWith('.bibtex')) {
    return (
      <span className="px-1.5 py-0.5 rounded text-10 font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
        BIB
      </span>
    );
  }
  if (lower.endsWith('.ris')) {
    return (
      <span className="px-1.5 py-0.5 rounded text-10 font-semibold bg-muted text-foreground border border-border shrink-0">
        RIS
      </span>
    );
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
  const startBatchUpload = useProcessModalStore((s) => s.startBatchUpload);

  const { data: collections = [] } = useCollectionsQuery(scopeId);

  const activeScope = useLibrarySidebarStore((s) => s.activeScope);
  const rootLibraryName =
    activeScope?.name || (activeScope?.type === 'project' ? 'Project Library' : 'My Library');

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(() => {
    return defaultCollectionId || routeParams?.collectionId || '';
  });
  const [items, setItems] = useState<StagedUploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);

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
      const newItems: StagedUploadItem[] = [];

      for (const file of fileArray) {
        const key = file.name + file.size;
        if (!existingNames.has(key)) {
          newItems.push({
            id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
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

  // Reset items when modal closes
  useEffect(() => {
    if (!open) {
      setItems([]);
      setIsDragging(false);
    }
  }, [open]);

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
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    setItems([]);
  };

  const totalBytes = useMemo(() => {
    return items.reduce((acc, it) => acc + it.file.size, 0);
  }, [items]);

  // Submit staged files: close Upload modal & initiate background batch processing
  const handleStartUpload = () => {
    if (items.length === 0) return;
    const filesToUpload = items.map((i) => i.file);
    const targetCollection = selectedCollectionId || undefined;

    // Close upload modal immediately and reset staging state
    onOpenChange(false);
    setItems([]);

    // Trigger separate ProcessModal & background worker
    void startBatchUpload(filesToUpload, {
      scopeId,
      collectionId: targetCollection,
      queryClient,
      onSuccess,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[540px] max-h-[85vh] flex flex-col p-6 overflow-hidden gap-4 rounded-lg border border-border bg-background shadow-raised-200"
      >
        <DialogHeader className="p-0 shrink-0 text-left">
          <DialogTitle className="text-15 font-semibold text-foreground tracking-tight">
            Upload Documents
          </DialogTitle>
          <DialogDescription className="text-12 text-muted-foreground mt-0.5">
            Add papers or bibliographic files. Raw files appear in your library immediately while metadata is extracted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 min-h-0 flex-1 overflow-y-auto pr-0.5">
          {/* Target Collection Selector */}
          <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border/70 bg-muted/20 text-12">
            <div className="flex items-center gap-2 text-muted-foreground font-medium shrink-0">
              <Folder className="size-3.5 text-foreground/70" />
              <span>Target Collection:</span>
            </div>
            <Select
              value={selectedCollectionId || 'root'}
              onValueChange={(val) => setSelectedCollectionId(val === 'root' ? '' : val)}
            >
              <SelectTrigger
                aria-label="Collection"
                className="h-7 text-12 text-foreground min-w-[160px] max-w-[240px] justify-between rounded-md border-border/80 bg-background shadow-2xs hover:border-foreground/30 cursor-pointer"
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
            className={`border border-dashed rounded-lg transition-all text-center cursor-pointer select-none ${
              items.length > 0 ? 'py-4 px-4' : 'py-7 px-6'
            } ${
              isDragging
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20 scale-[0.99]'
                : 'border-border/80 hover:border-muted-foreground/60 hover:bg-muted/20'
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
            <div className="flex flex-col items-center justify-center gap-2">
              <UploadCloud
                className={`${items.length > 0 ? 'size-5' : 'size-6'} text-muted-foreground/70 transition-all`}
                strokeWidth={1.5}
              />
              <div className="space-y-1">
                <p className="text-13 font-medium text-foreground">
                  Drag and drop files here, or <span className="text-primary underline-offset-2 hover:underline">browse</span>
                </p>
                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                  <span className="text-11 text-muted-foreground">Supported formats:</span>
                  <span className="px-1.5 py-0.5 rounded text-10 font-medium bg-destructive/10 text-destructive">PDF</span>
                  <span className="px-1.5 py-0.5 rounded text-10 font-medium bg-primary/10 text-primary">BibTeX</span>
                  <span className="px-1.5 py-0.5 rounded text-10 font-medium bg-muted text-foreground">RIS</span>
                  <span className="text-11 text-muted-foreground">• max 100MB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Staged File List */}
          {items.length > 0 && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-11 text-muted-foreground px-0.5 font-medium">
                <span>
                  {items.length} {items.length === 1 ? 'file' : 'files'} selected • {formatFileSize(totalBytes)}
                </span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              </div>

              <div className="rounded-lg border border-border bg-background overflow-hidden shadow-2xs">
                <div className="max-h-[200px] overflow-y-auto divide-y divide-border/60">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 flex items-center justify-between gap-2.5 text-12 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {getFileTypeBadge(item.file.name)}
                        <span className="font-medium text-foreground truncate" title={item.file.name}>
                          {item.file.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-11 text-muted-foreground font-mono tabular-nums">
                          {formatFileSize(item.file.size)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          title="Remove file"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-12 h-8 px-3.5 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={items.length === 0}
            onClick={handleStartUpload}
            className="text-12 h-8 px-4 gap-1.5 cursor-pointer font-medium"
          >
            <Upload className="size-3.5" />
            <span>
              Upload{items.length > 0 ? ` ${items.length} ${items.length === 1 ? 'File' : 'Files'}` : ''}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
