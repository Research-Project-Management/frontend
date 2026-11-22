"use client";

import { useState } from "react";
import {
  GitMerge,
  Check,
  Loader2,
  ShieldCheck,
  Maximize2,
  X,
  AlertTriangle,
  SlidersHorizontal,
  Paperclip,
  FileText,
  Tag,
  Folder,
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
  resolveMergeFieldOptionState,
  type ItemFieldDiff,
} from "@/features/library/domain/diff";
import {
  getItemDisplayTitle,
  getItemDisplayDate,
} from "@/features/library/domain/metadata/mapper";
import { getItemAuthorsSummary } from "@/features/library/domain/creators";
import { useDuplicateMergeState } from "@/features/library/core/coordinator/curation.coordinator";
import type { Item } from "@/features/library/types/core.types";
import { cn } from "@/shared/lib/utils";

interface DuplicateMergeInspectorProps {
  items: Item[];
  recommendedMasterId?: string;
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
  const isBusy = isMerging || isDismissing;

  const handleConfirmMerge = async () => {
    if (!masterPaper) return;
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
    const ids = items.map((p) => p.id).filter(Boolean);
    setIsDismissing(true);
    try {
      await onDismiss(ids);
    } finally {
      setIsDismissing(false);
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background select-none">
      {/* ── Inspector Header ── */}
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-2 min-w-0">
          <GitMerge className="size-4 text-primary shrink-0" />
          <h3 className="text-13 font-semibold text-foreground truncate">
            Merge {items.length} Duplicate Items
          </h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenModal && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={onOpenModal}
                  aria-label="Open compare workbench dialog"
                >
                  <Maximize2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-11">
                Open full compare workbench
              </TooltipContent>
            </Tooltip>
          )}

          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label="Close merge inspector"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Scrollable Inspector Content ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Type Mismatch Warning */}
        {hasTypeMismatch && (
          <div className="flex items-start gap-2 p-2.5 rounded-md border border-warning/20 bg-warning/10 text-warning text-11">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-warning" />
            <div className="space-y-0.5">
              <p className="font-medium text-foreground">
                Item type mismatch ({itemTypes.join(" vs ")})
              </p>
              <p className="text-10 text-muted-foreground leading-normal">
                Merging unifies records into: <strong>{effectiveItemType}</strong>
              </p>
            </div>
          </div>
        )}

        {/* Master Version Picker */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-11 font-medium text-foreground">
              Master Record
            </span>
            <span className="text-10 text-muted-foreground">
              Base version for merged data
            </span>
          </div>

          <div className="space-y-1.5">
            {items.map((item, idx) => {
              const isMaster = item.id === selectedMasterId;
              const authorSummary = getItemAuthorsSummary(item);
              const title = getItemDisplayTitle(item) || "Untitled Item";
              const date = getItemDisplayDate(item);

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectMaster(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectMaster(item.id);
                    }
                  }}
                  className={cn(
                    "p-2.5 rounded-md border transition-all cursor-pointer text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    isMaster
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border bg-card hover:bg-muted/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-10 font-semibold uppercase tracking-wider text-muted-foreground">
                      Version {idx + 1}
                    </span>
                    {isMaster ? (
                      <Badge className="h-4 px-1.5 text-9 font-medium bg-primary text-primary-foreground shadow-none">
                        Master
                      </Badge>
                    ) : (
                      <span className="text-10 text-muted-foreground hover:text-primary">
                        Set as master
                      </span>
                    )}
                  </div>

                  <p className="text-11 font-medium text-foreground line-clamp-2 leading-snug">
                    {title}
                  </p>

                  <div className="mt-1 flex items-center justify-between text-10 text-muted-foreground">
                    <span className="truncate max-w-[180px]">{authorSummary || "—"}</span>
                    <span>{date || item.itemType || "item"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Non-Destructive Assets Preservation Summary */}
        <div className="p-2.5 rounded-md border border-border bg-muted/30 space-y-1.5">
          <div className="flex items-center gap-1.5 text-11 font-medium text-foreground">
            <ShieldCheck className="size-3.5 text-primary shrink-0" />
            <span>Preserved Attachments & Meta</span>
          </div>
          <p className="text-10 text-muted-foreground leading-normal">
            No files or notes will be lost. All items are merged into the master.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-10 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Paperclip className="size-3 text-muted-foreground" />
              <strong className="text-foreground">{assetsSummary.totalFiles}</strong> files
            </span>
            <span className="flex items-center gap-1">
              <FileText className="size-3 text-muted-foreground" />
              <strong className="text-foreground">{assetsSummary.totalNotes}</strong> notes
            </span>
            <span className="flex items-center gap-1">
              <Tag className="size-3 text-muted-foreground" />
              <strong className="text-foreground">{assetsSummary.totalTags}</strong> tags
            </span>
            <span className="flex items-center gap-1">
              <Folder className="size-3 text-muted-foreground" />
              <strong className="text-foreground">{assetsSummary.totalCollections}</strong> collections
            </span>
          </div>
        </div>

        {/* Field Selection & Conflict Resolution */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-1">
            <div className="space-y-0.5">
              <span className="text-11 font-medium text-foreground">
                Bibliographic Fields
              </span>
              <p className="text-10 text-muted-foreground">
                {visibleFields.length} of {inspection.fields.length} fields
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {inspection.conflictCount > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAutoRecommend}
                      className="h-6 px-2 text-10 gap-1 rounded-md border-border text-foreground hover:bg-muted"
                    >
                      <Check className="size-2.5 text-primary shrink-0" />
                      <span>Best</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-10 max-w-xs">
                    Auto-select most complete values
                  </TooltipContent>
                </Tooltip>
              )}

              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border bg-muted/40">
                <SlidersHorizontal className="size-2.5 text-muted-foreground shrink-0" />
                <Label
                  htmlFor="inspector-conflicts-toggle"
                  className="text-10 cursor-pointer text-muted-foreground select-none"
                >
                  Conflicts ({inspection.conflictCount})
                </Label>
                <Switch
                  id="inspector-conflicts-toggle"
                  checked={showConflictsOnly}
                  onCheckedChange={setShowConflictsOnly}
                  className="scale-60 origin-right"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2.5 divide-y divide-border/60">
            {visibleFields.map((field: ItemFieldDiff) => {
              const activeOverrideValue = fieldOverrides[field.key];

              return (
                <div key={field.key} className="pt-2 space-y-1.5 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-11 font-medium text-foreground">
                      {field.label}
                    </span>
                    {field.hasConflict ? (
                      <Badge
                        variant="outline"
                        className="text-9 h-3.5 px-1 rounded border-warning/30 text-warning bg-warning/10 font-normal"
                      >
                        Conflict
                      </Badge>
                    ) : (
                      <span className="text-9 text-muted-foreground">Match</span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {field.options.map((opt) => {
                      const { isSelected, isRecommended } =
                        resolveMergeFieldOptionState(
                          field,
                          opt,
                          activeOverrideValue,
                        );

                      return (
                        <div
                          key={opt.itemId}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleSelectFieldValue(field.key, opt)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectFieldValue(field.key, opt);
                            }
                          }}
                          className={cn(
                            "p-2 rounded-md border text-11 transition-all cursor-pointer flex items-start justify-between gap-2",
                            isSelected
                              ? "border-primary bg-primary/10 ring-1 ring-primary"
                              : "border-border/70 bg-card hover:bg-muted/50"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="line-clamp-2 leading-relaxed text-foreground">
                              {opt.isEmpty ? (
                                <span className="italic text-muted-foreground text-10">
                                  (Empty)
                                </span>
                              ) : (
                                opt.displayValue
                              )}
                            </div>
                            {isRecommended && (
                              <div className="flex items-center gap-1 text-9 text-primary font-medium mt-0.5">
                                <Check className="size-2.5" />
                                <span>Recommended</span>
                              </div>
                            )}
                          </div>

                          <div className="shrink-0 mt-0.5">
                            {isSelected ? (
                              <div className="size-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                                <Check className="size-2 stroke-[2.5]" />
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

      {/* ── Inspector Action Footer ── */}
      <div className="p-3 border-t border-border flex items-center justify-between gap-2 shrink-0 bg-muted/20">
        <div>
          {onDismiss && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              disabled={isBusy}
              className="h-8 px-2.5 text-11 font-medium text-muted-foreground hover:text-foreground"
            >
              {isDismissing ? "Dismissing..." : "Not Duplicates"}
            </Button>
          )}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleConfirmMerge}
          disabled={isBusy || !masterPaper || !canEdit}
          className="h-8 px-3 text-11 font-medium gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-none disabled:opacity-50"
        >
          {isMerging ? (
            <Loader2 className="size-3.5 animate-spin shrink-0" />
          ) : (
            <GitMerge className="size-3.5 shrink-0" strokeWidth={1.75} />
          )}
          <span>{isMerging ? "Merging..." : "Merge Records"}</span>
        </Button>
      </div>
    </div>
  );
}

export default DuplicateMergeInspector;
