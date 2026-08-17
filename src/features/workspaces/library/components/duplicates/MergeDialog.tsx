'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from '@/shared/components/ui';
import { GitMerge, Check, FileText, Bookmark, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { getLibraryEntityId } from '../../utils/library.util';
import type { Paper } from '../../types/library.types';

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: Paper[];
  onMerge: (masterPaper: Paper, mergedFields: Partial<Paper>, duplicateIdsToDelete: string[]) => Promise<void>;
}

export default function MergeDialog({
  open,
  onOpenChange,
  duplicates,
  onMerge,
}: MergeDialogProps) {
  const [masterIndex, setMasterIndex] = useState(0);
  const [isMerging, setIsMerging] = useState(false);

  if (!duplicates || duplicates.length < 2) return null;

  const masterPaper = duplicates[masterIndex] || duplicates[0];

  // Combined labels and notes count
  const allLabels = Array.from(new Set(duplicates.flatMap((p) => p.labels || [])));
  const totalNotes = duplicates.reduce((acc, p) => acc + (p.notes?.length || 0), 0);
  const hasAttachments = duplicates.some((p) => Boolean(p.fileUrl));

  const handleConfirmMerge = async () => {
    try {
      setIsMerging(true);
      const masterId = getLibraryEntityId(masterPaper);
      const duplicateIdsToDelete = duplicates
        .map((p) => getLibraryEntityId(p))
        .filter((id) => id !== masterId);

      // Collect best metadata from all versions
      const mergedFields: Partial<Paper> = {
        title: masterPaper.title || duplicates.find((p) => p.title)?.title || '',
        authors: masterPaper.authors?.length ? masterPaper.authors : duplicates.find((p) => p.authors?.length)?.authors || [],
        year: masterPaper.year ?? duplicates.find((p) => p.year != null)?.year ?? null,
        doi: masterPaper.doi || duplicates.find((p) => p.doi)?.doi || '',
        journal: masterPaper.journal || duplicates.find((p) => p.journal)?.journal || '',
        abstract: masterPaper.abstract || duplicates.find((p) => p.abstract)?.abstract || '',
        labels: allLabels,
        fileUrl: masterPaper.fileUrl || duplicates.find((p) => p.fileUrl)?.fileUrl || '',
      };

      await onMerge(masterPaper, mergedFields, duplicateIdsToDelete);
      toast.success(`Successfully merged ${duplicates.length} duplicate items!`, { id: 'merge-success' });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to merge duplicate items', { id: 'merge-error' });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <GitMerge className="size-5" />
            <DialogTitle>Merge Duplicate Items</DialogTitle>
          </div>
          <DialogDescription>
            Select which version to use as the <strong>Master Record</strong>. Associated tags, notes, and file attachments from all versions will be preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Comparison cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
            {duplicates.map((p, idx) => {
              const isSelected = idx === masterIndex;
              return (
                <div
                  key={getLibraryEntityId(p) || idx}
                  onClick={() => setMasterIndex(idx)}
                  className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/40'
                      : 'border-border/60 bg-muted/10 hover:border-border hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Version {idx + 1} {isSelected && '(Master)'}
                    </span>
                    {isSelected && (
                      <span className="size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="size-2.5" />
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-semibold text-foreground line-clamp-2 mb-1.5">
                    {p.title || 'Untitled Paper'}
                  </h4>

                  <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2">
                    {p.authors?.join(', ') || 'No authors'} {p.year ? `(${p.year})` : ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80 pt-2 border-t border-border/20">
                    {p.doi && <span className="truncate max-w-[150px]">DOI: {p.doi}</span>}
                    {p.fileUrl && (
                      <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                        <FileText className="size-3" /> PDF
                      </span>
                    )}
                    {p.notes?.length ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Bookmark className="size-3" /> {p.notes.length} notes
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Merge summary preservation badge */}
          <div className="p-3 bg-muted/20 rounded-lg border border-border/40 text-xs flex items-center justify-between">
            <span className="text-muted-foreground">Preserved upon merge:</span>
            <div className="flex items-center gap-3 font-medium text-foreground">
              <span className="inline-flex items-center gap-1">
                <Tag className="size-3 text-primary" /> {allLabels.length} tags
              </span>
              <span className="inline-flex items-center gap-1">
                <Bookmark className="size-3 text-primary" /> {totalNotes} notes
              </span>
              {hasAttachments && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <FileText className="size-3" /> PDF Attachment
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>
            Cancel
          </Button>
          <Button onClick={handleConfirmMerge} disabled={isMerging} className="gap-1.5">
            <GitMerge className="size-4" />
            {isMerging ? 'Merging...' : `Merge ${duplicates.length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
