'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Files, Check, Loader2 } from 'lucide-react';
import type { Paper } from '../../types/library.types';

interface MergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: Paper[];
  onMerge: (
    masterPaper: Paper,
    mergedFields: Partial<Paper>,
    duplicateIdsToDelete: string[],
  ) => Promise<void>;
}

export default function MergeDialog({
  open,
  onOpenChange,
  duplicates = [],
  onMerge,
}: MergeDialogProps) {
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
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Files className="size-5" />
            <DialogTitle>Merge Duplicate Papers</DialogTitle>
          </div>
          <DialogDescription>
            Select the primary master paper to keep. All notes, attachments, and metadata from other records will be merged into this paper, and duplicate entries will be cleaned up.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select Primary (Master) Record:
          </Label>

          <RadioGroup
            value={selectedMasterId || duplicates[0]?.id}
            onValueChange={setSelectedMasterId}
            className="space-y-2.5"
          >
            {duplicates.map((paper, idx) => {
              const isSelected = (selectedMasterId || duplicates[0]?.id) === paper.id;
              return (
                <div
                  key={paper.id}
                  onClick={() => setSelectedMasterId(paper.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border/70 hover:border-border hover:bg-muted/30'
                  }`}
                >
                  <RadioGroupItem value={paper.id} id={`paper-${paper.id}`} className="mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <Label
                        htmlFor={`paper-${paper.id}`}
                        className="font-semibold text-xs text-foreground cursor-pointer line-clamp-2"
                      >
                        {paper.title || 'Untitled Paper'}
                      </Label>
                      {isSelected && (
                        <Badge variant="default" className="text-xs h-5 px-2 shrink-0 font-medium">
                          Master
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      {Array.isArray(paper.authors) ? paper.authors.join(', ') : 'Unknown Authors'}
                      {paper.year ? ` (${paper.year})` : ''}
                    </p>

                    {paper.doi && (
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        DOI: {paper.doi}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </RadioGroup>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmMerge}
            disabled={isMerging || !masterPaper}
            className="gap-1.5"
          >
            {isMerging ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            <span>{isMerging ? 'Merging...' : 'Confirm & Merge Records'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
