"use client";

import { useState } from "react";
import {
  GitMerge,
  Check,
  Loader2,
  ShieldCheck,
  Split,
  Maximize2,
  X,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  normalizeCompareValue,
  type ItemFieldDiff,
} from "@/features/library/domain/diff";
import {
  getItemDisplayTitle,
  getItemDisplayDate,
} from "@/features/library/domain/metadata";
import { normalizeAuthors } from "@/features/library/domain/creators";
import { useDuplicateMergeState } from "@/features/library/core/coordinator/curation.coordinator";
import type { Item } from "@/features/library/domain/types/library.types";
import { cn } from "@/shared/lib/utils";

export interface DuplicateMergeInspectorProps {
  items: Item[];
  recommendedMasterId?: string;
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
  recommendedMasterId,
  scopeId,
  canEdit = true,
  onClose,
  onOpenModal,
  onMerge,
  onDismiss,
}: DuplicateMergeInspectorProps) {
  const {
    selectedMasterId,
    fieldOverrides,
    effectiveItemType,
    getExplicitMergeSelections,
    showConflictsOnly,
    setShowConflictsOnly,
    masterPaper,
    inspection,
    assetsSummary,
    itemTypes,
    hasTypeMismatch,
    visibleFields,
    handleSelectMaster,
    handleSelectFieldValue,
    handleAutoRecommend,
  } = useDuplicateMergeState(items, recommendedMasterId);

  // Loading states
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);

  const handleConfirmMerge = async () => {
    if (!masterPaper || !canEdit) return;
    setIsMerging(true);
    try {
      const duplicateIdsToDelete = items
        .filter((p) => p.id !== masterPaper.id)
        .map((p) => p.id);

      await onMerge(
        masterPaper,
        getExplicitMergeSelections(),
        duplicateIdsToDelete,
      );
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
      <div className="flex h-full w-full flex-col bg-background border-l border-border select-none text-foreground">
        <div className="h-11 px-4 border-b border-border flex items-center shrink-0 bg-background/95 backdrop-blur-xs">
          <span className="text-12 font-medium text-foreground">
            Duplicate Merge
          </span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-foreground">
          <GitMerge className="h-8 w-8 mb-2 opacity-50 text-foreground" />
          <p className="text-12 font-medium">
            Select a duplicate group to compare & merge
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-background border-l border-border select-none text-foreground">
      {/* ── 1. Header ── */}
      <div className="h-11 px-4 border-b border-border flex items-center justify-between shrink-0 bg-background/95 backdrop-blur-xs">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onOpenModal}
                  className="size-7 text-foreground hover:bg-muted"
                >
                  <Maximize2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Open full-screen comparison workbench
              </TooltipContent>
            </Tooltip>
          )}
          {onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="size-7 text-foreground hover:bg-muted"
                >
                  <X className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Close duplicate inspector
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── 2. Primary Action Bar ── */}
      <div className="p-3 border-b border-border bg-muted shrink-0 space-y-2.5">
        {canEdit && (
          <Button
            size="sm"
            onClick={handleConfirmMerge}
            disabled={isMerging || !masterPaper}
            className="w-full h-8 text-12 font-medium gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isMerging ? (
              <Loader2 className="size-3.5 animate-spin shrink-0" />
            ) : (
              <GitMerge className="size-3.5 shrink-0" />
            )}
            <span>
              {isMerging ? "Merging Items..." : `Merge ${items.length} Items`}
            </span>
          </Button>
        )}

        {hasTypeMismatch && (
          <div className="flex items-start gap-2 p-2.5 rounded-md border border-warning/30 bg-warning/10 text-warning text-11">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-warning" />
            <div className="space-y-0.5">
              <p className="font-medium">
                Cross-type duplicate detected ({itemTypes.join(" → ")})
              </p>
              <p className="text-10 text-foreground leading-normal">
                Merging will unify all records into the selected Item Type (
                {effectiveItemType}).
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {inspection.conflictCount > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAutoRecommend}
                  className="h-6 px-1.5 text-11 text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-sm"
                >
                  <Check className="size-3" />
                  <span>Recommend Best</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Auto-select most complete values
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-11 text-foreground flex items-center gap-1 font-mono">
              <Check className="size-3 text-success" />
              All fields identical
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <Label
              htmlFor="insp-conflicts-toggle"
              className="text-10 text-foreground cursor-pointer select-none"
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
      <div className="flex-1 overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden min-h-0 divide-y divide-border">
        {/* Step 1: Master Record Selector */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between text-11">
            <span className="font-semibold text-foreground">
              1. Master Record
            </span>
            <span className="text-10 text-foreground">Default base item</span>
          </div>

          <div className="space-y-1.5">
            {items.map((item, idx) => {
              const isMaster = item.id === selectedMasterId;
              const resolvedAuthors = normalizeAuthors(
                item.authors,
                item.creators,
              );
              const authorStr =
                resolvedAuthors.length > 0
                  ? resolvedAuthors.join(", ")
                  : typeof item.authors === "string" && item.authors
                    ? item.authors
                    : "Unknown Author";
              const displayTitle =
                getItemDisplayTitle(item) || item.title || "Untitled Item";
              const displayYear = item.year || getItemDisplayDate(item);

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectMaster(item.id)}
                  className={cn(
                    "p-2.5 rounded-md border transition-colors cursor-pointer relative text-left",
                    isMaster
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-background hover:bg-muted hover:border-border-hover",
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-10 font-mono text-foreground">
                      Version {idx + 1}
                    </span>
                    {isMaster ? (
                      <Badge className="h-4 px-1.5 text-10 font-medium bg-primary text-primary-foreground rounded-sm">
                        Master
                      </Badge>
                    ) : (
                      <span className="text-10 text-foreground hover:underline">
                        Set as Master
                      </span>
                    )}
                  </div>

                  <p className="text-12 font-medium text-foreground line-clamp-1 leading-snug">
                    {displayTitle}
                  </p>

                  <div className="flex items-center gap-2 mt-1 text-10 text-foreground truncate">
                    <span className="truncate">{authorStr}</span>
                    {displayYear && <span>• {displayYear}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Preserved Assets Union */}
        <div className="p-3 bg-muted space-y-1">
          <div className="flex items-center gap-1.5 text-11 font-medium text-foreground">
            <ShieldCheck className="size-3.5 text-success shrink-0" />
            <span>Preserved Attachments & Notes</span>
          </div>
          <p className="text-10 text-foreground leading-normal">
            {assetsSummary.totalFiles} files, {assetsSummary.totalNotes} notes,
            and {assetsSummary.totalTags} tags will be safely combined into the
            master item.
          </p>
        </div>

        {/* Step 3: Bibliographic Field Diffs */}
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between text-11">
            <span className="font-semibold text-foreground">
              2. Field Comparison
            </span>
            <span className="text-10 text-foreground font-mono">
              {visibleFields.length} fields
            </span>
          </div>

          <div className="space-y-3">
            {visibleFields.map((field: ItemFieldDiff) => {
              const activeOverrideValue = fieldOverrides[field.key];
              const masterValue = field.masterValue?.rawValue;

              return (
                <div
                  key={field.key}
                  className={cn(
                    "p-2.5 rounded-md border text-11 transition-colors",
                    field.hasConflict
                      ? "border-warning/30 bg-warning/5"
                      : "border-border bg-muted",
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-medium text-foreground">
                      {field.label}
                    </span>
                    {field.hasConflict ? (
                      <Badge
                        variant="outline"
                        className="text-9 h-3.5 px-1 rounded-sm border-warning/30 text-warning bg-warning/10 font-normal"
                      >
                        Conflict
                      </Badge>
                    ) : (
                      <span className="text-9 text-foreground font-mono">
                        Identical
                      </span>
                    )}
                  </div>

                  {/* Candidate options */}
                  <div className="space-y-1.5">
                    {field.options.map(
                      (opt: ItemFieldDiff["options"][number]) => {
                        const isExplicitOverride =
                          activeOverrideValue !== undefined &&
                          activeOverrideValue !== null &&
                          (opt.rawValue === activeOverrideValue ||
                            (opt.isEmpty &&
                              (activeOverrideValue === "" ||
                                (Array.isArray(activeOverrideValue) &&
                                  activeOverrideValue.length === 0))) ||
                            normalizeCompareValue(opt.rawValue, field.key) ===
                              normalizeCompareValue(activeOverrideValue, field.key));
                        const isMasterDefault =
                          (activeOverrideValue === undefined ||
                            activeOverrideValue === null) &&
                          opt.isMaster &&
                          opt.rawValue === masterValue;

                        const isSelected =
                          isExplicitOverride || isMasterDefault;
                        const isRecommended =
                          field.hasConflict &&
                          opt.itemId === field.recommendedItemId &&
                          !isSelected;

                        return (
                          <div
                            key={opt.itemId}
                            onClick={() =>
                              handleSelectFieldValue(field.key, opt)
                            }
                            className={cn(
                              "p-2 rounded-sm border cursor-pointer transition-colors flex items-start justify-between gap-2",
                              isSelected
                                ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                                : "border-border bg-background text-foreground hover:bg-muted",
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-9 font-mono text-foreground">
                                  V{opt.sourceItemIndex + 1}
                                </span>
                                {opt.isMaster && (
                                  <span className="text-9 text-primary font-medium">
                                    (Master)
                                  </span>
                                )}
                                {isRecommended && (
                                  <span className="flex items-center gap-0.5 text-9 text-warning font-medium">
                                    <Check className="size-2.5" /> Best
                                  </span>
                                )}
                              </div>
                              <div className="text-11 leading-snug line-clamp-3 break-words">
                                {opt.isEmpty ? (
                                  <span className="italic text-muted-foreground">
                                    (Empty)
                                  </span>
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
                      },
                    )}
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                disabled={isDismissing || isMerging}
                className="h-7 px-2 text-11 font-medium text-foreground hover:bg-muted gap-1.5"
              >
                {isDismissing ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Split className="size-3" />
                )}
                <span>Not Duplicates</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Mark as false positive duplicate
            </TooltipContent>
          </Tooltip>

          <span className="text-10 text-foreground">
            {inspection.conflictCount} conflict(s)
          </span>
        </div>
      )}
    </div>
  );
}

export default DuplicateMergeInspector;
