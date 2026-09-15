'use client';

import React, { useState } from 'react';
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
import { Files, Check, Loader2 } from 'lucide-react';
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

  const masterPaper = duplicates.find((p) => p.id === selectedMasterId) || duplicates[0];

  const handleConfirmMerge = async () => {
    if (!masterPaper) return;
    setIsMerging(true);
    try {
      const duplicateIdsToDelete = duplicates
        .filter((p) => p.id !== masterPaper.id)
        .map((p) => p.id);
      await onMerge(masterPaper, {}, duplicateIdsToDelete);
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


