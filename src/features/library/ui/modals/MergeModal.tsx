"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import {
  GitMerge,
  Check,
  Loader2,
  ShieldCheck,
  FileText,
  Paperclip,
  Tag,
  Folder,
  SlidersHorizontal,
  AlertTriangle,
} from "lucide-react";
import type { Item } from "@/features/library/domain/types/items.types";
import { getItemAuthorsSummary } from "@/features/library/domain/creators";
import { useDuplicateMergeState } from "@/features/library/core/coordinator/curation.coordinator";
import {
  resolveMergeFieldOptionState,
  type ItemFieldDiff,
} from "@/features/library/domain/diff";

export interface MergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: Item[];
  recommendedMasterId?: string;
  onMerge: (
    masterPaper: Item,
    mergedFields: Partial<Item>,
    duplicateIdsToDelete: string[],
  ) => Promise<void>;
  onDismissDuplicate?: (duplicateItemIds: string[]) => void | Promise<void>;
}

export function MergeModal({
  open,
  onOpenChange,
  duplicates = [],
  recommendedMasterId,
  onMerge,
  onDismissDuplicate,
}: MergeModalProps) {
  const items = duplicates;

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

  // Action pending states
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);
  const isBusy = isMerging || isDismissing;

  // ── 2. Action Handlers ──────────────────────────────────────────────────────
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
      onOpenChange(false);
    } finally {
      setIsMerging(false);
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (isBusy) return;
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-5xl w-[95vw] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border rounded-lg shadow-raised-200 font-sans">
        {/* ── Header: Clean & focused, no border lines, title and X only ── */}
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-16 font-semibold text-foreground tracking-tight">
            Merge Duplicate Records
          </DialogTitle>
          <DialogDescription className="sr-only">
            Select the authoritative master version and review conflicting
            bibliographic fields. Notes, files, and tags will be merged.
          </DialogDescription>
        </DialogHeader>

        {/* ── Scrollable Body Workbench ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-2 space-y-4">
          {hasTypeMismatch && (
            <div className="flex items-start gap-2.5 p-3 rounded-md border border-warning/20 bg-warning/10 text-warning text-12">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-warning" />
              <div className="space-y-0.5">
                <p className="font-medium text-foreground">
                  Cross-type duplicate detected ({itemTypes.join(" → ")})
                </p>
                <p className="text-11 text-muted-foreground leading-normal">
                  Merging will unify all records into the selected Item Type (
                  {effectiveItemType}).
                </p>
              </div>
            </div>
          )}

          {/* 1. Master Version Rail */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-12 font-medium text-foreground">
                Step 1: Choose Master Record (Base Version)
              </span>
              <span className="text-11 text-muted-foreground">
                All unselected fields default to this record
              </span>
            </div>

            <div
              className={`grid gap-2.5 max-h-[320px] overflow-y-auto pr-0.5 ${
                items.length === 2
                  ? "grid-cols-1 sm:grid-cols-2"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {items.map((item, idx) => {
                const isMaster = item.id === selectedMasterId;
                const authorList = getItemAuthorsSummary(item);

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
                    className={`group relative p-3 rounded-md border transition-all cursor-pointer select-none flex flex-col justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isMaster
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border bg-background hover:bg-muted hover:border-border-hover"
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-11 font-medium text-muted-foreground">
                          Version {idx + 1}
                        </span>
                        {isMaster ? (
                          <Badge className="h-4.5 px-2 text-10 font-medium bg-primary text-primary-foreground rounded-full shadow-none">
                            Master
                          </Badge>
                        ) : (
                          <span className="text-11 text-muted-foreground group-hover:text-primary transition-colors">
                            Set as Master
                          </span>
                        )}
                      </div>

                      <h4 className="text-12 font-medium text-foreground line-clamp-2 leading-snug">
                        {item.title || "Untitled Item"}
                      </h4>

                      <p
                        className="text-11 text-muted-foreground truncate"
                        title={authorList}
                      >
                        {authorList}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-11 text-muted-foreground">
                      <span>{item.itemType || "article"}</span>
                      <span>
                        {item.year ? `Year: ${item.year}` : "Year: —"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Non-Destructive Assets Union Banner */}
          <div className="p-3 rounded-md border border-border bg-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-12">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck
                className="size-4 text-foreground shrink-0"
                strokeWidth={1.75}
              />
              <span className="text-11 text-muted-foreground leading-normal">
                Non-destructive: All attachments, notes, tags, and collections
                are preserved and attached to the master record.
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 text-11 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Paperclip className="size-3 text-muted-foreground" />
                <strong className="font-medium text-foreground">
                  {assetsSummary.totalFiles}
                </strong>{" "}
                files
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="size-3 text-muted-foreground" />
                <strong className="font-medium text-foreground">
                  {assetsSummary.totalNotes}
                </strong>{" "}
                notes
              </span>
              <span className="flex items-center gap-1.5">
                <Tag className="size-3 text-muted-foreground" />
                <strong className="font-medium text-foreground">
                  {assetsSummary.totalTags}
                </strong>{" "}
                tags
              </span>
              <span className="flex items-center gap-1.5">
                <Folder className="size-3 text-muted-foreground" />
                <strong className="font-medium text-foreground">
                  {assetsSummary.totalCollections}
                </strong>{" "}
                collections
              </span>
            </div>
          </div>

          {/* 3. Side-by-Side Field Diff Matrix with contextual conflict controls */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
              <div>
                <span className="text-12 font-medium text-foreground">
                  Step 2: Resolve Field Discrepancies
                </span>
                <p className="text-11 text-muted-foreground">
                  Showing {visibleFields.length} of {inspection.fields.length}{" "}
                  fields. Click any cell to override.
                </p>
              </div>

              {/* Contextual Conflict Resolution Controls */}
              <div className="flex items-center gap-2 shrink-0">
                {inspection.conflictCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAutoRecommend}
                    className="h-7 px-2.5 text-11 gap-1.5 font-medium rounded-md border-border text-foreground hover:bg-muted"
                    title="Auto-select the most complete values (longest abstract, full author names, canonical DOI)"
                  >
                    <Check className="size-3 text-foreground shrink-0" />
                    <span>Recommend Best</span>
                  </Button>
                )}

                <div className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-muted">
                  <SlidersHorizontal className="size-3 text-muted-foreground shrink-0" />
                  <Label
                    htmlFor="diff-filter-toggle"
                    className="text-11 font-medium cursor-pointer text-muted-foreground select-none"
                  >
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

            <div className="rounded-md border border-border overflow-x-auto bg-background">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted text-11 text-muted-foreground font-medium">
                    <th className="w-40 px-3.5 py-2 shrink-0 sticky left-0 bg-background/95 backdrop-blur-xs z-10 border-r border-border">
                      Field
                    </th>
                    {items.map((item, idx) => {
                      const isMaster = item.id === selectedMasterId;
                      return (
                        <th
                          key={item.id}
                          className="px-3.5 py-2 font-medium min-w-[200px]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-foreground">
                              Version {idx + 1}
                            </span>
                            {isMaster && (
                              <Badge
                                variant="outline"
                                className="text-10 px-1.5 py-0 h-4 rounded-md border-primary text-primary bg-primary/10"
                              >
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
                  {visibleFields.map((field: ItemFieldDiff) => {
                    const activeOverrideValue = fieldOverrides[field.key];

                    return (
                      <tr
                        key={field.key}
                        className={`transition-colors ${
                          field.hasConflict
                            ? "bg-warning/5 hover:bg-warning/10"
                            : "hover:bg-muted"
                        }`}
                      >
                        {/* Field Label Column */}
                        <td className="px-3.5 py-2.5 align-top font-medium text-11 text-foreground sticky left-0 bg-background/95 backdrop-blur-xs z-10 border-r border-border">
                          <div className="space-y-1">
                            <span className="text-foreground block">
                              {field.label}
                            </span>
                            {field.hasConflict ? (
                              <Badge
                                variant="outline"
                                className="text-10 h-4 px-1.5 rounded-md border-warning/30 text-warning bg-warning/10 font-normal"
                              >
                                Conflict
                              </Badge>
                            ) : (
                              <span className="text-10 text-muted-foreground">
                                Identical
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Value Cells for each Duplicate Version */}
                        {field.options.map(
                          (opt: ItemFieldDiff["options"][number]) => {
                            const { isSelected, isRecommended } =
                              resolveMergeFieldOptionState(
                                field,
                                opt,
                                activeOverrideValue,
                              );

                            return (
                              <td
                                key={opt.itemId}
                                role="button"
                                tabIndex={0}
                                onClick={() =>
                                  handleSelectFieldValue(field.key, opt)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleSelectFieldValue(field.key, opt);
                                  }
                                }}
                                className="px-3.5 py-2.5 align-top cursor-pointer select-none focus-visible:outline-none"
                              >
                                <div
                                  className={`p-2.5 rounded-md border text-12 transition-all flex flex-col justify-between gap-1.5 min-h-[48px] ${
                                    isSelected
                                      ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                                      : "border-border bg-muted text-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="line-clamp-4 break-words leading-relaxed text-12 font-normal">
                                      {opt.isEmpty ? (
                                        <span className="italic text-muted-foreground text-11">
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
                                    <div className="flex items-center gap-1 text-10 text-primary font-medium">
                                      <Check className="size-2.5" />
                                      <span>Recommended value</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          },
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Footer: Clean action layout with optional Not Duplicates dismissal ── */}
        <DialogFooter className="px-6 pt-3 pb-6 flex flex-row items-center justify-between shrink-0 gap-2 sm:justify-between">
          <div>
            {onDismissDuplicate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const ids = items.map((p) => p.id).filter(Boolean);
                  setIsDismissing(true);
                  try {
                    await onDismissDuplicate(ids);
                    onOpenChange(false);
                  } finally {
                    setIsDismissing(false);
                  }
                }}
                disabled={isBusy}
                className="h-8 px-3 text-12 font-medium text-foreground rounded-md hover:bg-muted cursor-pointer"
              >
                {isDismissing ? "Dismissing..." : "Not Duplicates"}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isBusy}
              className="h-8 px-3 text-12 font-medium text-foreground rounded-md border-border hover:bg-muted"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleConfirmMerge}
              disabled={isBusy || !masterPaper}
              className="h-8 px-3 text-12 font-medium gap-1.5 rounded-md bg-primary text-primary-foreground shadow-none hover:bg-primary/90 disabled:opacity-50"
            >
              {isMerging ? (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              ) : (
                <GitMerge className="size-3.5 shrink-0" strokeWidth={1.75} />
              )}
              <span>{isMerging ? "Merging..." : "Merge Records"}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MergeModal;
