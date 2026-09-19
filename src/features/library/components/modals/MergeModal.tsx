'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import {
  GitMerge,
  Check,
  Loader2,
  ShieldCheck,
  FileText,
  Paperclip,
  Tag,
  Folder,
  Split,
  Sparkles,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import type { Item } from '../../types/items.types';
import { ItemService } from '../../services/items.service';
import {
  inspectItemDifferences,
  aggregateItemAssets,
  type ItemFieldDiff,
  type FieldOptionValue,
} from '../../utils/merge-diff.util';

export interface MergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: Item[];
  scopeId?: string;
  projectId?: string;
  workspaceId?: string;
  onMerge: (
    masterPaper: Item,
    mergedFields: Partial<Item>,
    duplicateIdsToDelete: string[],
  ) => Promise<void>;
  onDismissDuplicate?: (duplicateItemIds: string[]) => void | Promise<void>;
}

export type MergeDialogProps = MergeModalProps;

export function MergeModal({
  open,
  onOpenChange,
  duplicates = [],
  scopeId,
  projectId,
  workspaceId,
  onMerge,
  onDismissDuplicate,
}: MergeModalProps) {
  // Rich items state: hydrates sparse items with full metadata from server if needed
  const [items, setItems] = useState<Item[]>(duplicates);
  const [isLoadingFull, setIsLoadingFull] = useState<boolean>(false);

  // Selected Master Record ID
  const [selectedMasterId, setSelectedMasterId] = useState<string>(
    duplicates[0]?.id || '',
  );

  // Field override values: { [fieldKey]: selectedValue }
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, unknown>>({});

  // Filter toggle: only display fields that actually have conflicting/different values
  const [showConflictsOnly, setShowConflictsOnly] = useState<boolean>(false);

  // Action pending states
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  // ── 1. Hydrate full items when modal opens ──────────────────────────────────
  useEffect(() => {
    if (!open || !duplicates || duplicates.length === 0) return;

    // Set initial fallback items
    setItems(duplicates);
    setSelectedMasterId(duplicates[0]?.id || '');
    setFieldOverrides({});

    // Check if items already have full metadata (e.g. abstract or attachments present)
    const hasDetailedMetadata = duplicates.some(
      (d) => Boolean(d.abstract) || Array.isArray((d as any).attachments),
    );

    if (hasDetailedMetadata) {
      return;
    }

    // Hydrate in parallel
    let isMounted = true;
    setIsLoadingFull(true);

    const effectiveScope = scopeId || projectId || workspaceId || 'user';
    Promise.all(
      duplicates.map(async (dup) => {
        try {
          const full = await ItemService.getItem(effectiveScope, dup.id);
          return full || dup;
        } catch {
          return dup;
        }
      }),
    )
      .then((hydrated) => {
        if (isMounted) {
          setItems(hydrated);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingFull(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, duplicates, scopeId, projectId, workspaceId]);

  // Master paper reference
  const masterPaper = useMemo(
    () => items.find((p) => p.id === selectedMasterId) || items[0],
    [items, selectedMasterId],
  );

  // ── 2. Compute Deep Diff Matrix & Assets Summary ───────────────────────────
  const inspection = useMemo(
    () => inspectItemDifferences(items, selectedMasterId),
    [items, selectedMasterId],
  );

  const assetsSummary = useMemo(
    () => aggregateItemAssets(items),
    [items],
  );

  // Filtered fields based on user toggle
  const visibleFields = useMemo(() => {
    if (!showConflictsOnly) return inspection.fields;
    return inspection.fields.filter((f) => f.hasConflict);
  }, [inspection.fields, showConflictsOnly]);

  // Handle switching Master Record
  const handleSelectMaster = (newMasterId: string) => {
    setSelectedMasterId(newMasterId);
    // Clear overrides so values naturally fall back to the newly chosen master
    setFieldOverrides({});
  };

  // Handle picking a specific field value from a candidate
  const handleSelectFieldValue = (fieldKey: string, option: FieldOptionValue) => {
    setFieldOverrides((prev) => {
      // If user clicks the value that is already master's default, we can remove override
      const masterVal = masterPaper ? (masterPaper as Record<string, unknown>)[fieldKey] : undefined;
      if (option.rawValue === masterVal) {
        const copy = { ...prev };
        delete copy[fieldKey];
        return copy;
      }
      return {
        ...prev,
        [fieldKey]: option.rawValue,
      };
    });
  };

  // Handle auto-optimizing: pick best recommended values for all conflicting fields
  const handleAutoRecommend = () => {
    const newOverrides: Record<string, unknown> = {};
    for (const field of inspection.fields) {
      if (field.hasConflict && field.recommendedItemId !== selectedMasterId) {
        const bestOpt = field.options.find((o) => o.itemId === field.recommendedItemId);
        if (bestOpt && !bestOpt.isEmpty) {
          newOverrides[field.key] = bestOpt.rawValue;
        }
      }
    }
    setFieldOverrides(newOverrides);
  };

  // ── 3. Action Handlers ──────────────────────────────────────────────────────
  const handleConfirmMerge = async () => {
    if (!masterPaper) return;
    setIsMerging(true);
    try {
      const duplicateIdsToDelete = items
        .filter((p) => p.id !== masterPaper.id)
        .map((p) => p.id);

      await onMerge(masterPaper, fieldOverrides, duplicateIdsToDelete);
      onOpenChange(false);
    } finally {
      setIsMerging(false);
    }
  };

  const handleDismissNotDuplicates = async () => {
    setIsDismissing(true);
    try {
      const itemIds = items.map((p) => p.id);
      if (onDismissDuplicate) {
        await onDismissDuplicate(itemIds);
      }
      onOpenChange(false);
    } finally {
      setIsDismissing(false);
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isMerging || isDismissing) return; onOpenChange(v); }}>
      <DialogContent
        className="sm:max-w-5xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border rounded-lg shadow-raised-200 font-sans"
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <GitMerge className="size-3.5" strokeWidth={1.75} />
                </div>
                <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                  Merge Duplicate Records
                </DialogTitle>
                <Badge
                  variant="secondary"
                  className="text-11 h-5 px-2 font-mono tabular-nums rounded-full bg-muted border border-border font-medium"
                >
                  {items.length} Records
                </Badge>
                {isLoadingFull && (
                  <span className="flex items-center gap-1 text-11 text-muted-foreground animate-pulse">
                    <Loader2 className="size-3 animate-spin" />
                    <span>Hydrating details...</span>
                  </span>
                )}
              </div>
              <DialogDescription className="text-12 text-muted-foreground line-clamp-1">
                Select the authoritative master version and review conflicting bibliographic fields. Notes, files, and tags will be merged.
              </DialogDescription>
            </div>

            {/* Quick Filter Switch & Smart Auto-Pick */}
            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              {inspection.conflictCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAutoRecommend}
                  className="h-7 px-2 text-11 gap-1 font-medium rounded-md border-border text-foreground hover:bg-muted shadow-2xs"
                  title="Auto-select the most complete values (longest abstract, full author names, canonical DOI)"
                >
                  <Sparkles className="size-3 text-primary shrink-0" />
                  <span>Recommend Best</span>
                </Button>
              )}

              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-background shadow-2xs">
                <SlidersHorizontal className="size-3 text-muted-foreground shrink-0" />
                <Label htmlFor="diff-filter-toggle" className="text-11 font-medium cursor-pointer text-foreground select-none">
                  Conflicts only ({inspection.conflictCount})
                </Label>
                <Switch
                  id="diff-filter-toggle"
                  checked={showConflictsOnly}
                  onCheckedChange={setShowConflictsOnly}
                  className="scale-75 origin-right"
                />
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable Body Workbench ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-4">
          {/* 1. Master Version Rail */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-11 font-medium text-muted-foreground">
                Step 1: Choose Master Record (Base Version)
              </span>
              <span className="text-10 text-muted-foreground">
                All unselected fields default to this record
              </span>
            </div>

            <div className={`grid gap-2.5 ${items.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
              {items.map((item, idx) => {
                const isMaster = item.id === selectedMasterId;
                const authorList = Array.isArray(item.authors)
                  ? item.authors.join(', ')
                  : 'Unknown Authors';

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectMaster(item.id)}
                    className={`relative p-3 rounded-md border transition-all cursor-pointer select-none flex flex-col justify-between gap-2 ${
                      isMaster
                        ? 'border-primary/70 bg-primary/5 ring-1 ring-primary/20 shadow-2xs'
                        : 'border-border bg-background hover:bg-muted/40 hover:border-border'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-10 font-mono text-muted-foreground uppercase tracking-wider">
                          Version {idx + 1}
                        </span>
                        {isMaster ? (
                          <Badge className="h-4 px-1.5 text-9 font-medium bg-primary text-primary-foreground rounded-sm">
                            Master
                          </Badge>
                        ) : (
                          <span className="text-10 text-muted-foreground hover:text-foreground">
                            Set as Master
                          </span>
                        )}
                      </div>

                      <h4 className="text-12 font-medium text-foreground line-clamp-2 leading-snug">
                        {item.title || 'Untitled Item'}
                      </h4>

                      <p className="text-11 text-muted-foreground truncate" title={authorList}>
                        {authorList}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border/60 flex items-center justify-between text-10 font-mono text-muted-foreground">
                      <span>{item.itemType || 'article'}</span>
                      <span>{item.year ? `Year: ${item.year}` : 'Year: —'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Non-Destructive Assets Union Banner */}
          <div className="p-3 rounded-md border border-border bg-muted/40 flex items-start gap-3">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-11 font-medium text-foreground">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="size-3 text-muted-foreground" />
                  <strong>{assetsSummary.totalFiles}</strong> File(s) preserved
                </span>
                <span className="flex items-center gap-1.5">
                  <FileText className="size-3 text-muted-foreground" />
                  <strong>{assetsSummary.totalNotes}</strong> Note(s) combined
                </span>
                <span className="flex items-center gap-1.5">
                  <Tag className="size-3 text-muted-foreground" />
                  <strong>{assetsSummary.totalTags}</strong> Tag(s) merged
                </span>
                <span className="flex items-center gap-1.5">
                  <Folder className="size-3 text-muted-foreground" />
                  <strong>{assetsSummary.totalCollections}</strong> Collection(s) preserved
                </span>
              </div>
              <p className="text-11 text-muted-foreground leading-relaxed">
                Non-destructive accumulation: All PDF attachments, literature notes, tags, and collection memberships from both records will be retained and attached to the master item.
              </p>
            </div>
          </div>

          {/* 3. Side-by-Side Field Diff Matrix */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-11 font-medium text-muted-foreground">
                Step 2: Resolve Field Discrepancies (Click a cell to override)
              </span>
              <span className="text-10 text-muted-foreground">
                Showing {visibleFields.length} of {inspection.fields.length} fields
              </span>
            </div>

            <div className="rounded-md border border-border overflow-hidden bg-background">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-11 text-muted-foreground font-medium">
                    <th className="w-36 px-3.5 py-2 shrink-0">Field</th>
                    {items.map((item, idx) => {
                      const isMaster = item.id === selectedMasterId;
                      return (
                        <th key={item.id} className="px-3.5 py-2 font-medium">
                          <div className="flex items-center gap-1.5">
                            <span>Version {idx + 1}</span>
                            {isMaster && (
                              <Badge variant="outline" className="text-9 px-1 py-0 h-4 border-primary/40 text-primary bg-primary/5">
                                Master
                              </Badge>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-12">
                  {visibleFields.map((field) => {
                    const activeOverrideValue = fieldOverrides[field.key];
                    const masterValue = field.masterValue?.rawValue;

                    return (
                      <tr
                        key={field.key}
                        className={`transition-colors ${
                          field.hasConflict
                            ? 'bg-amber-500/[0.02] hover:bg-amber-500/[0.05]'
                            : 'hover:bg-muted/20'
                        }`}
                      >
                        {/* Field Label Column */}
                        <td className="px-3.5 py-2.5 align-top font-medium text-11 text-muted-foreground">
                          <div className="space-y-1">
                            <span className="text-foreground block">{field.label}</span>
                            {field.hasConflict ? (
                              <Badge
                                variant="outline"
                                className="text-9 h-4 px-1 rounded-sm border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              >
                                Conflict
                              </Badge>
                            ) : (
                              <span className="text-9 text-muted-foreground font-mono">
                                identical
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Value Cells for each Duplicate Version */}
                        {field.options.map((opt) => {
                          // Determine if this cell's value is currently selected
                          const isExplicitOverride =
                            activeOverrideValue !== undefined &&
                            (typeof opt.rawValue === 'object'
                              ? JSON.stringify(opt.rawValue) === JSON.stringify(activeOverrideValue)
                              : opt.rawValue === activeOverrideValue);
                          const isMasterDefault =
                            activeOverrideValue === undefined &&
                            opt.isMaster &&
                            opt.rawValue === masterValue;

                          const isSelected = isExplicitOverride || isMasterDefault;
                          const isRecommended =
                            field.hasConflict &&
                            opt.itemId === field.recommendedItemId &&
                            !isSelected;

                          return (
                            <td
                              key={opt.itemId}
                              onClick={() => handleSelectFieldValue(field.key, opt)}
                              className="px-3.5 py-2.5 align-top cursor-pointer select-none"
                            >
                              <div
                                className={`p-2 rounded-md border text-12 transition-all flex flex-col justify-between gap-1.5 min-h-[44px] ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20 shadow-2xs'
                                    : 'border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="line-clamp-4 break-words leading-relaxed text-12 font-normal">
                                    {opt.isEmpty ? (
                                      <span className="italic text-muted-foreground/70 text-11">
                                        (Empty)
                                      </span>
                                    ) : (
                                      opt.displayValue
                                    )}
                                  </div>

                                  <div className="shrink-0 mt-0.5">
                                    {isSelected ? (
                                      <div className="size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                        <Check className="size-2.5 stroke-[2.5]" />
                                      </div>
                                    ) : (
                                      <div className="size-4 rounded-full border border-border bg-background" />
                                    )}
                                  </div>
                                </div>

                                {isRecommended && (
                                  <div className="flex items-center gap-1 text-9 text-primary font-medium">
                                    <Sparkles className="size-2.5" />
                                    <span>Recommended value</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Footer Actions ────────────────────────────────────────────────── */}
        <DialogFooter className="px-6 py-3 border-t border-border bg-muted/20 flex flex-row items-center justify-between sm:justify-between shrink-0 gap-2">
          {/* Left: Not Duplicates action */}
          <div className="flex items-center gap-2">
            {onDismissDuplicate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismissNotDuplicates}
                disabled={isDismissing || isMerging}
                className="h-8 px-2.5 text-12 font-medium text-muted-foreground hover:text-foreground hover:bg-muted gap-1.5 rounded-md"
                title="Mark this pair as false positive so they are not grouped as duplicates again"
              >
                {isDismissing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Split className="size-3.5" />
                )}
                <span>Not Duplicates</span>
              </Button>
            )}
          </div>

          {/* Right: Cancel & Merge Buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isMerging}
              className="h-8 px-3 text-12 font-medium text-foreground rounded-md border-border shadow-2xs hover:bg-muted"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleConfirmMerge}
              disabled={isMerging || !masterPaper}
              className="h-8 px-3 text-12 font-medium gap-1.5 rounded-md bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90"
            >
              {isMerging ? (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              ) : (
                <GitMerge className="size-3.5 shrink-0" />
              )}
              <span>
                {isMerging
                  ? 'Merging Records...'
                  : `Merge ${items.length} Records into Master`}
              </span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MergeModal;
export { MergeModal as MergeDialog };
