'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui";
import { Button } from "@/shared/components/ui";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui";
import { Label } from "@/shared/components/ui";
import { Badge } from "@/shared/components/ui";
import { Files, Check, Loader2, SlidersHorizontal } from 'lucide-react';
import type { Item } from '../../types/library.types';

export interface MergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: Item[];
  onMerge: (
    masterPaper: Item,
    mergedFields: Partial<Item>,
    duplicateIdsToDelete: string[],
  ) => Promise<void>;
}

export type MergeDialogProps = MergeModalProps;

export function MergeModal({
  open,
  onOpenChange,
  duplicates = [],
  onMerge,
}: MergeModalProps) {
  const [selectedMasterId, setSelectedMasterId] = useState<string>(
    duplicates[0]?.id || '',
  );
  const [isMerging, setIsMerging] = useState(false);
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, any>>({});

  useEffect(() => {
    if (duplicates[0]?.id) {
      setSelectedMasterId(duplicates[0].id);
      setFieldOverrides({});
    }
  }, [duplicates]);

  const masterPaper = duplicates.find((p) => p.id === selectedMasterId) || duplicates[0];

  // Inspect field differences among duplicates
  const differingFields = useMemo(() => {
    if (duplicates.length < 2) return [];
    const fieldsToCheck: Array<{ key: keyof Item; label: string }> = [
      { key: 'title', label: 'Title' },
      { key: 'year', label: 'Publication Year' },
      { key: 'doi', label: 'DOI' },
      { key: 'publicationTitle', label: 'Publication / Journal' },
      { key: 'abstract', label: 'Abstract' },
    ];

    return fieldsToCheck.filter(({ key }) => {
      const values = duplicates.map((d) => String(d[key] ?? '').trim()).filter(Boolean);
      const uniqueVals = new Set(values);
      return uniqueVals.size > 1;
    });
  }, [duplicates]);

  const handleConfirmMerge = async () => {
    if (!masterPaper) return;
    setIsMerging(true);
    try {
      const duplicateIdsToDelete = duplicates
        .filter((p) => p.id !== masterPaper.id)
        .map((p) => p.id);
      await onMerge(masterPaper, fieldOverrides, duplicateIdsToDelete);
      onOpenChange(false);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto bg-background border border-border shadow-none rounded-md p-5 font-sans">
        <DialogHeader>
          <div className="flex items-center gap-2 text-foreground">
            <Files className="size-4 text-foreground shrink-0" strokeWidth={1.5} />
            <DialogTitle className="text-14 font-medium text-foreground">Merge Duplicate Papers</DialogTitle>
          </div>
          <DialogDescription className="text-12 text-muted-foreground leading-relaxed">
            Select the primary master paper to keep. All notes, attachments, and metadata from other records will be merged into this paper, and duplicate entries will be cleaned up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label className="text-11 font-medium text-muted-foreground">
            Select Primary (Master) Record:
          </Label>

          <RadioGroup
            value={selectedMasterId || duplicates[0]?.id}
            onValueChange={setSelectedMasterId}
            className="space-y-2"
          >
            {duplicates.map((paper) => {
              const isSelected = (selectedMasterId || duplicates[0]?.id) === paper.id;
              return (
                <div
                  key={paper.id}
                  onClick={() => setSelectedMasterId(paper.id)}
                  className={`flex items-start gap-3 p-3 rounded-md border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-border bg-muted shadow-none'
                      : 'border-border hover:border-border hover:bg-muted/50'
                  }`}
                >
                  <RadioGroupItem value={paper.id} id={`paper-${paper.id}`} className="mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label
                        htmlFor={`paper-${paper.id}`}
                        className="font-medium text-12 text-foreground cursor-pointer line-clamp-2"
                      >
                        {paper.title || 'Untitled Item'}
                      </Label>
                      {isSelected && (
                        <Badge variant="secondary" className="text-10 h-5 px-1.5 shrink-0 font-medium rounded-sm">
                          Master
                        </Badge>
                      )}
                    </div>

                    <p className="text-11 text-muted-foreground truncate">
                      {Array.isArray(paper.authors) ? paper.authors.join(', ') : 'Unknown Authors'}
                      {paper.year ? ` (${paper.year})` : ''}
                    </p>

                    {paper.doi && (
                      <p className="text-11 text-muted-foreground font-mono truncate">
                        DOI: {paper.doi}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        {differingFields.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="size-3.5 text-foreground" />
                <Label className="text-11 font-medium text-foreground">
                  Resolve Conflicting Fields
                </Label>
              </div>
              <span className="text-10 text-muted-foreground">
                Select value to keep for each field
              </span>
            </div>

            <div className="space-y-2.5">
              {differingFields.map(({ key, label }) => {
                const activeValue = fieldOverrides[key as string] ?? masterPaper?.[key];
                const options = Array.from(
                  new Map(
                    duplicates
                      .filter((d) => d[key] !== undefined && d[key] !== null && String(d[key]).trim() !== '')
                      .map((d) => [String(d[key]), { value: d[key], sourceTitle: d.title || 'Record' }])
                  ).values()
                );

                return (
                  <div key={String(key)} className="rounded-md border border-border p-2.5 bg-muted/20 space-y-1.5">
                    <div className="text-11 font-medium text-foreground flex items-center justify-between">
                      <span>{label}</span>
                      <span className="text-10 text-muted-foreground font-mono">
                        {String(key)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {options.map((opt, idx) => {
                        const isSelected = String(activeValue ?? '') === String(opt.value ?? '');
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setFieldOverrides((prev) => ({
                                ...prev,
                                [key]: opt.value,
                              }));
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded text-11 transition-colors flex items-start justify-between gap-2 border ${
                              isSelected
                                ? 'border-primary/50 bg-primary/10 text-foreground font-medium'
                                : 'border-transparent hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <span className="line-clamp-2 break-all">{String(opt.value)}</span>
                            {isSelected && (
                              <Check className="size-3 text-primary shrink-0 mt-0.5" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
            className="h-8 px-3 text-12 font-medium text-foreground rounded-md border-border"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmMerge}
            disabled={isMerging || !masterPaper}
            className="h-8 px-3 text-12 font-medium gap-1.5 rounded-md"
          >
            {isMerging ? (
              <Loader2 className="size-3.5 animate-spin text-background shrink-0" />
            ) : (
              <Check className="size-3.5 text-background shrink-0" />
            )}
            <span>{isMerging ? 'Merging...' : 'Confirm & Merge Records'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MergeModal;
export { MergeModal as MergeDialog };


