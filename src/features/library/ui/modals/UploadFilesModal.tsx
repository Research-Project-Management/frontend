'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UploadCloud, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Form } from '@/shared/components/ui/form';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/shared/components/ui/select';

import { useCollectionsQuery } from '@/features/library/sdk/queries/collections.queries';
import { useLibraryCacheSynchronizer } from '@/features/library/sdk/queries/catalog.queries';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import { useProcessModalStore } from '@/features/library/core/store/process-modal.store';
import {
  addLinkSchema,
  type AddLinkFormValues,
  type Collection,
} from '@/features/library/domain/types/core.types';
import { cn } from '@/shared/lib/utils';

export interface AddLinkData {
  url: string;
  title?: string;
  attachOaPdf?: boolean;
  saveSnapshot?: boolean;
  fileUrl?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  [key: string]: unknown;
}

export interface AddLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddLinkData) => Promise<unknown> | void;
  isPending?: boolean;
}

export function AddLinkModal({
  open,
  onOpenChange,
  onSubmit,
  isPending = false,
}: AddLinkModalProps) {
  const form = useForm<AddLinkFormValues>({
    resolver: zodResolver(addLinkSchema),
    defaultValues: {
      url: '',
      title: '',
    },
    mode: 'onSubmit',
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const [attachOaPdf, setAttachOaPdf] = useState(true);
  const [saveSnapshot, setSaveSnapshot] = useState(true);

  useEffect(() => {
    if (open) {
      reset({ url: '', title: '' });
      setAttachOaPdf(true);
      setSaveSnapshot(true);
    }
  }, [open, reset]);

  const handleOpenChange = (v: boolean) => {
    if (isPending) return;
    if (!v) reset({ url: '', title: '' });
    onOpenChange(v);
  };

  const onValidSubmit = async (data: AddLinkFormValues) => {
    const trimmedUrl = data.url.trim();
    if (!trimmedUrl) return;

    const trimmedTitle = data.title?.trim();

    try {
      await onSubmit({
        url: trimmedUrl,
        title: trimmedTitle || undefined,
        attachOaPdf,
        saveSnapshot,
      });
      reset({ url: '', title: '' });
      onOpenChange(false);
    } catch {
      // Handled by parent
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="sm:max-w-[500px] p-6 bg-background border border-border shadow-raised-200 rounded-lg"
      >
        <DialogHeader className="text-left pb-1">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            Add Item by Identifier
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enter a DOI, ISBN, arXiv ID, PubMed ID, or URL to add to your
            library.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={handleSubmit(onValidSubmit)}
            className="space-y-4 pt-1"
          >
            <div className="space-y-1.5">
              <Label
                htmlFor="link-url-input"
                className="text-11 font-medium text-foreground"
              >
                Identifier or URL
              </Label>
              <Input
                id="link-url-input"
                {...register('url')}
                placeholder="Enter DOI, ISBN, arXiv ID, PubMed ID, or URL..."
                className="h-8 text-13 font-mono text-foreground placeholder:text-muted-foreground rounded-md border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring"
                autoFocus
              />
              {errors.url && (
                <p className="text-11 text-destructive font-medium">
                  {errors.url.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="link-title-input"
                className="text-11 font-medium text-foreground"
              >
                Title (Optional)
              </Label>
              <Input
                id="link-title-input"
                placeholder="Leave blank to auto-detect title"
                {...register('title')}
                className="h-8 text-13 text-foreground placeholder:text-muted-foreground rounded-md border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2 text-12 text-foreground cursor-pointer select-none">
                <Checkbox
                  checked={attachOaPdf}
                  onCheckedChange={(checked) => setAttachOaPdf(Boolean(checked))}
                />
                <span>Automatically attach associated Open-Access PDFs</span>
              </label>
              <label className="flex items-center gap-2 text-12 text-foreground cursor-pointer select-none">
                <Checkbox
                  checked={saveSnapshot}
                  onCheckedChange={(checked) => setSaveSnapshot(Boolean(checked))}
                />
                <span>Automatically save Web Snapshot (.html) for web pages</span>
              </label>
            </div>

            <DialogFooter className="flex justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
                className="h-8 px-3 text-13 font-medium cursor-pointer text-foreground rounded-md hover:bg-muted"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-8 px-3 text-13 font-medium cursor-pointer min-w-[90px] rounded-md shadow-none"
              >
                {isPending ? (
                  <Loader2 className="size-3.5 animate-spin text-primary-foreground shrink-0" />
                ) : (
                  'Add Item'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export interface UploadFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeId?: string;
  defaultCollectionId?: string;
  initialFiles?: File[];
  onSuccess?: () => void;
}

const EMPTY_FILES: File[] = [];

export function UploadFilesModal({
  open,
  onOpenChange,
  scopeId,
  defaultCollectionId,
  initialFiles = EMPTY_FILES,
  onSuccess,
}: UploadFilesModalProps) {
  const { queryClient } = useLibraryCacheSynchronizer(scopeId);
  const routeParams = useParams() as { collectionId?: string };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const startBatchUpload = useProcessModalStore((s) => s.startBatchUpload);

  const { data: collections = [] } = useCollectionsQuery(scopeId);

  const activeScope = useLibraryUIStore((s) => s.activeScope);
  const rootLibraryName =
    activeScope?.name || (activeScope?.type === 'project' ? 'Project Library' : 'My Library');

  const [selectedCollectionId, setSelectedCollectionId] = useState<string>(() => {
    return defaultCollectionId || routeParams?.collectionId || '';
  });
  const [isDragging, setIsDragging] = useState(false);

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

  const handleUploadFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      const targetCollection = selectedCollectionId || undefined;

      onOpenChange(false);

      void startBatchUpload(fileArray, {
        scopeId,
        collectionId: targetCollection,
        queryClient,
        onSuccess,
      });
    },
    [selectedCollectionId, onOpenChange, startBatchUpload, scopeId, queryClient, onSuccess],
  );

  const autoUploadedRef = useRef<File[] | null>(null);
  useEffect(() => {
    if (!open) {
      autoUploadedRef.current = null;
      return;
    }
    if (initialFiles.length > 0 && autoUploadedRef.current !== initialFiles) {
      autoUploadedRef.current = initialFiles;
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
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
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
                className="h-8 text-13 text-foreground w-auto min-w-[150px] max-w-[240px] justify-between rounded-md border-border bg-background shadow-none hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring cursor-pointer"
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

          <div
            role="button"
            tabIndex={0}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={cn(
              'border border-dashed rounded-lg transition-all text-center cursor-pointer select-none py-10 px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isDragging
                ? 'border-primary bg-primary/10 ring-2 ring-primary scale-[0.99]'
                : 'border-border hover:border-border-hover hover:bg-muted',
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.bib,.bibtex,.ris,.json,.csl.json,.xml,.mods,.rdf,.nbib,.medline,.csv"
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
                  Supported formats: PDF, BibTeX, RIS, CSL-JSON, EndNote XML, MODS, Zotero RDF, PubMed (.nbib), CSV • max 100MB
                </p>
              </div>
            </div>
          </div>
        </div>

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

export default UploadFilesModal;
