'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
  SlidersHorizontal,
  Maximize2,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import {
  inspectItemDifferences,
  aggregateItemAssets,
  type ItemFieldDiff,
  type FieldOptionValue,
} from '../../domain';
import type { Item } from '../../types/library.types';
import { cn } from '@/shared/lib/utils';

export interface DuplicateMergeInspectorProps {
  items: Item[];
  scopeId?: string;
  canEdit?: boolean;
  onClose?: () => void;
  onOpenModal?: () => void;
  onMerge: (
    masterItem: Item,
    fieldSelections: Partial<Item>,
    duplicateIdsToDelete: string[],
  ) => Promise<void>;
  onDismiss?: (itemIds: string[]) => void | Promise<void>;
}

export function DuplicateMergeInspector({
  items = [],
  scopeId,
  canEdit = true,
  onClose,
  onOpenModal,
  onMerge,
  onDismiss,
}: DuplicateMergeInspectorProps) {
  // Master record ID
  const [selectedMasterId, setSelectedMasterId] = useState<string>(items[0]?.id || '');
  // Field override selections
  const [fieldOverrides, setFieldOverrides] = useState<Record<string, unknown>>({});
  // Conflict-only filter
  const [showConflictsOnly, setShowConflictsOnly] = useState<boolean>(false);
  // Loading states
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  // Sync master when items change
  useEffect(() => {
    if (items.length > 0) {
      if (!items.some((i) => i.id === selectedMasterId)) {
        setSelectedMasterId(items[0].id);
        setFieldOverrides({});
      }
    }
  }, [items, selectedMasterId]);

  const masterPaper = useMemo(
    () => items.find((p) => p.id === selectedMasterId) || items[0],
    [items, selectedMasterId],
  );

  const inspection = useMemo(
    () => inspectItemDifferences(items, selectedMasterId),
    [items, selectedMasterId],
  );

  const assetsSummary = useMemo(() => aggregateItemAssets(items), [items]);

  const visibleFields = useMemo(() => {
    if (!showConflictsOnly) return inspection.fields;
    return inspection.fields.filter((f) => f.hasConflict);
  }, [inspection.fields, showConflictsOnly]);

  const handleSelectMaster = (newMasterId: string) => {
    setSelectedMasterId(newMasterId);
    setFieldOverrides({});
  };

  const handleSelectFieldValue = (fieldKey: string, option: FieldOptionValue) => {
    setFieldOverrides((prev) => {
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

  const handleConfirmMerge = async () => {
    if (!masterPaper || !canEdit) return;
    setIsMerging(true);
    try {
      const duplicateIdsToDelete = items
        .filter((p) => p.id !== masterPaper.id)
        .map((p) => p.id);

      await onMerge(masterPaper, fieldOverrides, duplicateIdsToDelete);
    } finally {
      setIsMerging(false);
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss) return;
    setIsDismissing(true);
    try {
      const itemIds = items.map((p) => p.id);
      await onDismiss(itemIds);
    } finally {
      setIsDismissing(false);
    }
  };

  if (!items || items.length < 2) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <GitMerge className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-12 font-medium">Select a duplicate group to compare & merge</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background border-l border-border select-none text-foreground">
      {/* ── 1. Header ── */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <GitMerge className="size-3.5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <h3 className="text-12 font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <span>Duplicate Set</span>
              <Badge
                variant="secondary"
                className="text-10 h-4 px-1.5 font-mono tabular-nums rounded-md font-normal"
              >
                {items.length} items
              </Badge>
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenModal && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenModal}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Open full-screen comparison workbench"
            >
              <Maximize2 className="size-3.5" />
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Close duplicate inspector"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── 2. Primary Action Bar ── */}
      <div className="p-3 border-b border-border bg-muted/20 shrink-0 space-y-2.5">
        {canEdit && (
          <Button
            size="sm"
            onClick={handleConfirmMerge}
            disabled={isMerging || !masterPaper}
            className="w-full h-8 text-12 font-medium gap-1.5 rounded-md shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isMerging ? (
              <Loader2 className="size-3.5 animate-spin shrink-0" />
            ) : (
              <GitMerge className="size-3.5 shrink-0" />
            )}
            <span>
              {isMerging ? 'Merging Items...' : `Merge ${items.length} Items`}
            </span>
          </Button>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {inspection.conflictCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAutoRecommend}
              className="h-6 px-1.5 text-11 text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-sm"
              title="Auto-select most complete values"
            >
              <Sparkles className="size-3" />
              <span>Recommend Best</span>
            </Button>
          ) : (
            <span className="text-11 text-muted-foreground flex items-center gap-1 font-mono">
              <Check className="size-3 text-emerald-500" />
              All fields identical
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <Label
              htmlFor="insp-conflicts-toggle"
              className="text-10 text-muted-foreground cursor-pointer select-none"
            >
              Conflicts only ({inspection.conflictCount})
            </Label>
            <Switch
              id="insp-conflicts-toggle"
              checked={showConflictsOnly}
              onCheckedChange={setShowConflictsOnly}
              className="scale-65 origin-right"
            />
          </div>
        </div>
      </div>

      {/* ── 3. Scrollable Workbench ── */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-border">
        {/* Step 1: Master Record Selector */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-11">
            <span className="font-semibold text-foreground">1. Master Record</span>
            <span className="text-10 text-muted-foreground">Default base item</span>
          </div>

          <div className="space-y-1.5">
            {items.map((item, idx) => {
              const isMaster = item.id === selectedMasterId;
              const authorStr = Array.isArray(item.authors)
                ? item.authors.join(', ')
                : typeof item.authors === 'string'
                  ? item.authors
                  : 'Unknown Author';

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectMaster(item.id)}
                  className={cn(
                    'p-2.5 rounded-md border transition-all cursor-pointer relative text-left',
                    isMaster
                      ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20 shadow-2xs'
                      : 'border-border/60 bg-background hover:bg-muted/40 hover:border-border',
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-10 font-mono text-muted-foreground uppercase tracking-wider">
                      Version {idx + 1}
                    </span>
                    {isMaster ? (
                      <Badge className="h-4 px-1.5 text-10 font-medium bg-primary text-primary-foreground rounded-sm">
                        Master
                      </Badge>
                    ) : (
                      <span className="text-10 text-muted-foreground hover:text-foreground">
                        Set as Master
                      </span>
                    )}
                  </div>

                  <p className="text-12 font-medium text-foreground line-clamp-1 leading-snug">
                    {item.title || 'Untitled Item'}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-10 text-muted-foreground truncate">
                    <span className="truncate">{authorStr}</span>
                    {item.year && <span>• {item.year}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Preserved Assets Union */}
        <div className="p-3 bg-muted/15 space-y-1">
          <div className="flex items-center gap-1.5 text-11 font-medium text-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Preserved Attachments & Notes</span>
          </div>
          <p className="text-10 text-muted-foreground leading-normal">
            {assetsSummary.totalFiles} files, {assetsSummary.totalNotes} notes, and{' '}
            {assetsSummary.totalTags} tags will be safely combined into the master item.
          </p>
        </div>

        {/* Step 3: Bibliographic Field Diffs */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between text-11">
            <span className="font-semibold text-foreground">2. Field Comparison</span>
            <span className="text-10 text-muted-foreground font-mono">
              {visibleFields.length} fields
            </span>
          </div>

          <div className="space-y-3">
            {visibleFields.map((field) => {
              const activeOverrideValue = fieldOverrides[field.key];
              const masterValue = field.masterValue?.rawValue;

              return (
                <div
                  key={field.key}
                  className={cn(
                    'p-2.5 rounded-md border text-11 transition-all',
                    field.hasConflict
                      ? 'border-amber-500/30 bg-amber-500/[0.02]'
                      : 'border-border/60 bg-muted/10',
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-medium text-foreground">{field.label}</span>
                    {field.hasConflict ? (
                      <Badge
                        variant="outline"
                        className="text-9 h-3.5 px-1 rounded-sm border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-normal"
                      >
                        Conflict
                      </Badge>
                    ) : (
                      <span className="text-9 text-muted-foreground font-mono">
                        Identical
                      </span>
                    )}
                  </div>

                  {/* Candidate options */}
                  <div className="space-y-1.5">
                    {field.options.map((opt) => {
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
                        <div
                          key={opt.itemId}
                          onClick={() => handleSelectFieldValue(field.key, opt)}
                          className={cn(
                            'p-2 rounded-sm border cursor-pointer transition-all flex items-start justify-between gap-2',
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20'
                              : 'border-border/50 bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-9 font-mono text-muted-foreground">
                                V{opt.sourceItemIndex + 1}
                              </span>
                              {opt.isMaster && (
                                <span className="text-9 text-primary font-medium">
                                  (Master)
                                </span>
                              )}
                              {isRecommended && (
                                <span className="flex items-center gap-0.5 text-9 text-amber-600 dark:text-amber-400 font-medium">
                                  <Sparkles className="size-2.5" /> Best
                                </span>
                              )}
                            </div>
                            <div className="text-11 leading-snug line-clamp-3 break-words">
                              {opt.isEmpty ? (
                                <span className="italic text-muted-foreground/60">(Empty)</span>
                              ) : (
                                opt.displayValue
                              )}
                            </div>
                          </div>

                          <div className="shrink-0 mt-0.5">
                            {isSelected ? (
                              <div className="size-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                <Check className="size-2.5 stroke-[2.5]" />
                              </div>
                            ) : (
                              <div className="size-3.5 rounded-full border border-border bg-background" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 4. Footer ── */}
      {onDismiss && (
        <div className="p-3 border-t border-border bg-background shrink-0 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            disabled={isDismissing || isMerging}
            className="h-7 px-2 text-11 font-medium text-muted-foreground hover:text-foreground gap-1.5"
            title="Mark as false positive duplicate"
          >
            {isDismissing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Split className="size-3" />
            )}
            <span>Not Duplicates</span>
          </Button>

          <span className="text-10 text-muted-foreground">
            {inspection.conflictCount} conflict(s)
          </span>
        </div>
      )}
    </div>
  );
}

export default DuplicateMergeInspector;
