'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/select';

import { useCollectionsQuery } from '../../data';
import { useLibrarySidebarStore, useProcessModalStore } from '../../store';
import type { Collection } from '../../types';
import { cn } from '@/shared/lib/utils';

export interface UploadFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeId?: string;
  defaultCollectionId?: string;
  initialFiles?: File[];
  onSuccess?: () => void;
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

  // Direct upload handler: closes modal and triggers ProcessModal directly
  const handleUploadFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const targetCollection = selectedCollectionId || undefined;

      // Close upload modal immediately
      onOpenChange(false);

      // Trigger ProcessModal & background batch upload
      void startBatchUpload(fileArray, {
        scopeId,
        collectionId: targetCollection,
        queryClient,
        onSuccess,
      });
    },
    [selectedCollectionId, onOpenChange, startBatchUpload, scopeId, queryClient, onSuccess],
  );

  // If initial files were provided when opening modal, immediately upload them
  useEffect(() => {
    if (open && initialFiles.length > 0) {
      handleUploadFiles(initialFiles);
    }
  }, [open, initialFiles, handleUploadFiles]);

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
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleUploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[480px] flex flex-col p-6 overflow-hidden gap-4 rounded-lg border border-border bg-background shadow-raised-200"
      >
        <DialogHeader className="p-0 shrink-0 text-left">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Upload Documents
          </DialogTitle>
          <DialogDescription className="sr-only">
            Upload papers or bibliographic files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 min-h-0 flex-1">
          {/* Target Collection Selector */}
          <div className="flex items-center gap-2.5">
            <span className="text-11 font-medium text-foreground shrink-0">
              Target Collection:
            </span>
            <Select
              value={selectedCollectionId || 'root'}
              onValueChange={(val) => setSelectedCollectionId(val === 'root' ? '' : val)}
            >
              <SelectTrigger
                aria-label="Collection"
                className="h-8 text-13 text-foreground w-auto min-w-[150px] max-w-[240px] justify-between rounded-md border-border/80 bg-background shadow-none hover:border-foreground/30 focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 cursor-pointer"
              >
                <SelectValue placeholder={rootLibraryName} />
              </SelectTrigger>
              <SelectContent className="max-h-60 bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                <SelectItem value="root" className="rounded-md text-13 py-1.5 px-2">
                  {rootLibraryName}
                </SelectItem>
                {collections.map((c: Collection) => (
                  <SelectItem key={c.id} value={c.id} className="rounded-md text-13 py-1.5 px-2">
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
            className={cn(
              'border border-dashed rounded-lg transition-all text-center cursor-pointer select-none py-10 px-6',
              isDragging
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20 scale-[0.99]'
                : 'border-border/80 hover:border-foreground/30 hover:bg-muted/20',
            )}
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
              <UploadCloud
                className="size-8 text-foreground transition-colors"
                strokeWidth={1.5}
              />
              <div className="space-y-1">
                <p className="text-13 font-medium text-foreground">
                  Drag and drop files here, or <span className="text-primary underline-offset-2 hover:underline">browse</span>
                </p>
                <p className="text-11 text-foreground pt-0.5">
                  Supported formats: PDF, BibTeX, RIS • max 100MB
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-13 h-8 px-3.5 cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
