'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Eye, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { PlaneEmptyState } from '@/shared/components/ui/PlaneEmptyState';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import {
  ACCEPTED_FILE_TYPES,
  getFileCategoryMeta,
  type SourceEntry,
} from '../../context/source.port';
import { useFileUpload } from '../../context/upload';
import {
  useAiDocumentContent,
  useAiDocuments,
  useDeleteAiDocument,
} from '../../engine/queries';

export interface UploadedTabProps {
  spaceId?: string | null;
  pending: ReadonlyMap<string, SourceEntry>;
  selectedIds?: ReadonlySet<string>;
  onToggle: (entry: SourceEntry) => void;
  onQuickAttach: (entry: SourceEntry) => void;
  onUploadedEntries: (entries: SourceEntry[]) => void;
}

export function UploadedTab({
  spaceId = null,
  pending,
  selectedIds,
  onToggle,
  onQuickAttach,
  onUploadedEntries,
}: UploadedTabProps) {
  const [search, setSearch] = useState('');
  const [previewTarget, setPreviewTarget] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: uploadedDocs = [],
    isLoading: uploadedLoading,
    refetch: refetchUploaded,
  } = useAiDocuments(spaceId, true);

  const previewQuery = useAiDocumentContent(
    previewTarget?.id ?? null,
    spaceId,
  );
  const deleteDocMutation = useDeleteAiDocument(spaceId);
  const { uploadingFiles, isUploading, uploadFiles } = useFileUpload(spaceId);

  const filteredUploaded = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uploadedDocs;
    return uploadedDocs.filter(
      (d) =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [uploadedDocs, search]);

  const handleUploadFromTab = async (files: File[]) => {
    if (!files.length) return;
    const entries = await uploadFiles(files, spaceId);
    if (entries.length > 0) {
      onUploadedEntries(entries);
      void refetchUploaded();
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (fileInputRef.current) fileInputRef.current.value = '';
          void handleUploadFromTab(files);
        }}
      />
      <div className="p-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 border border-border rounded-md px-2 h-8 flex-1 bg-background">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search uploaded AI documents..."
            className="w-full bg-transparent text-12 outline-none"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="h-8 gap-1.5 text-12"
        >
          {isUploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          <span>
            {isUploading
              ? uploadingFiles[0]?.stage === 'processing'
                ? 'Uploading...'
                : `${uploadingFiles[0]?.progress ?? 0}%`
              : 'Upload'}
          </span>
        </Button>
      </div>

      {previewTarget ? (
        <div className="flex-1 flex flex-col min-h-0 p-3 space-y-2 overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="text-13 font-semibold truncate">
              {previewTarget.title}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPreviewTarget(null)}
              className="h-7 text-12 shrink-0"
            >
              Back to list
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 text-12 whitespace-pre-wrap leading-relaxed">
            {previewQuery.isLoading ? (
              <div className="space-y-2 py-1">
                <Skeleton className="h-3.5 w-3/4 rounded-sm" />
                <Skeleton className="h-3.5 w-full rounded-sm" />
                <Skeleton className="h-3.5 w-5/6 rounded-sm" />
                <Skeleton className="h-3.5 w-2/3 rounded-sm" />
              </div>
            ) : previewQuery.isError ? (
              'Unable to load preview content for this document.'
            ) : (
              previewQuery.data?.text || 'No readable text content extracted.'
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {uploadedLoading ? (
            <div className="space-y-1.5 py-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-md">
                  <Skeleton className="size-4 rounded-sm shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4 rounded-sm" />
                    <Skeleton className="h-3 w-1/3 rounded-sm opacity-70" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUploaded.length === 0 ? (
            <PlaneEmptyState
              variant="document"
              title="No uploaded documents"
              description="Upload PDFs, Word docs, spreadsheets, or code files to index into this space."
              isCompact
            />
          ) : (
            filteredUploaded.map((doc) => {
              const entry: SourceEntry = {
                id: doc.id,
                name: doc.title || 'Untitled Document',
                size: doc.size,
                enabled: true,
                sourceType: 'upload',
              };
              const meta = getFileCategoryMeta(entry);
              const IconComp = meta.icon;
              const isChecked =
                pending.has(entry.id) || Boolean(selectedIds?.has(entry.id));
              const isConfirming = confirmDeleteId === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => onToggle(entry)}
                  onDoubleClick={() => onQuickAttach(entry)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md border cursor-pointer transition-colors',
                    isChecked
                      ? 'border-ai/40 bg-ai/5'
                      : 'border-transparent hover:bg-muted/60',
                  )}
                >
                  <Checkbox checked={isChecked} />
                  <IconComp className={cn('size-4 shrink-0', meta.iconClassName)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-12 font-medium text-foreground truncate">
                      {entry.name}
                    </p>
                    <p className="text-10 text-muted-foreground">
                      {meta.typeLabel}
                      {meta.sizeText ? ` • ${meta.sizeText}` : ''}
                      {doc.chunk_count ? ` • ${doc.chunk_count} chunks` : ''}
                    </p>
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isConfirming ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deleteDocMutation.isPending}
                          onClick={() =>
                            deleteDocMutation.mutate(doc.id, {
                              onSettled: () => setConfirmDeleteId(null),
                            })
                          }
                          className="h-6 px-2 text-11"
                        >
                          Delete
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={deleteDocMutation.isPending}
                          onClick={() => setConfirmDeleteId(null)}
                          className="h-6 px-2 text-11"
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewTarget({ id: doc.id, title: entry.name })
                          }
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          title="Preview text"
                          aria-label={`Preview ${entry.name}`}
                        >
                          <Eye className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deleteDocMutation.isPending}
                          onClick={() => setConfirmDeleteId(doc.id)}
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Delete document"
                          aria-label={`Delete ${entry.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
