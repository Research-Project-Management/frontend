"use client";

import React from "react";
import { Library, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import { cn } from "@/shared/lib/utils";
import { useLibraryProjectContext } from "@/features/library/core/adapters/project-context.adapter";
import type {
  CreateSavedSearchInput,
  SavedSearch,
} from "@/features/library/domain/types/saved-searches.types";
import { ConditionRowEditor } from "./saved-search/ConditionRowEditor";
import { SavedSearchPreviewTable } from "./saved-search/SavedSearchPreviewTable";
import { useSavedSearchBuilder } from "./saved-search/useSavedSearchBuilder";

export interface CreateSavedSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateSavedSearchInput) => Promise<unknown> | void;
  savedSearch?: SavedSearch | null;
  scopeId?: string;
  isPending?: boolean;
}

export function CreateSavedSearchModal({
  open,
  onOpenChange,
  onSubmit,
  savedSearch,
  scopeId = "user",
  isPending = false,
}: CreateSavedSearchModalProps) {
  const { projects = [] } = useLibraryProjectContext();
  const builder = useSavedSearchBuilder({
    open,
    savedSearch,
    scopeId,
    onSubmit,
    onOpenChange,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-full sm:max-w-[740px] max-h-[92vh] flex flex-col p-4 sm:p-6 bg-background border border-border shadow-raised-200 rounded-lg gap-0"
      >
        <DialogHeader className="text-left pb-4">
          <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
            {savedSearch ? "Edit Saved Search" : "New Saved Search"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure search criteria and conditions to save a filtered view.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={builder.handleSubmit}
          className="space-y-4 flex-1 min-h-0 flex flex-col"
        >
          {/* 1. Header Configurations: Name & Library Scope */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label
                htmlFor="smart-search-name"
                className="text-11 font-medium text-foreground"
              >
                Name
              </Label>
              <Input
                id="smart-search-name"
                value={builder.name}
                onChange={(e) => {
                  builder.setName(e.target.value);
                  if (builder.error) builder.setError(null);
                }}
                placeholder="Saved search name..."
                autoFocus
                className="h-8 text-13 text-foreground bg-background hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring rounded-md border-border placeholder:text-muted-foreground"
              />
            </div>

            {/* Scope Selector: Personal vs Project library */}
            <div className="space-y-1.5">
              <Label
                htmlFor="smart-search-scope"
                className="text-11 font-medium text-foreground"
              >
                Search In
              </Label>
              <Select
                value={builder.targetScope}
                onValueChange={(val) => builder.setTargetScope(val)}
                disabled={Boolean(savedSearch)}
              >
                <SelectTrigger
                  id="smart-search-scope"
                  size="sm"
                  className="w-full h-8 text-13 font-normal text-foreground bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring rounded-md"
                >
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent className="bg-popover text-popover-foreground border border-border shadow-raised-200 rounded-md">
                  <SelectItem
                    value="user"
                    className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Library
                        className="size-3.5 text-foreground shrink-0"
                        strokeWidth={1.5}
                      />
                      <span className="truncate">My Library</span>
                    </span>
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem
                      key={p.id}
                      value={p.id}
                      className="text-13 py-1.5 px-2 rounded-sm cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Users
                          className="size-3.5 text-foreground shrink-0"
                          strokeWidth={1.5}
                        />
                        <span className="truncate">{p.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. Match Criteria Header */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-12 text-foreground">
              <span className="font-medium text-foreground">Match</span>
              <div
                role="radiogroup"
                aria-label="Match criteria"
                className="inline-flex rounded-md bg-muted p-0.5 border border-border"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={builder.conjunction === "AND"}
                  onClick={() => builder.setConjunction("AND")}
                  className={cn(
                    "px-2.5 py-0.5 rounded text-11 transition-colors cursor-pointer",
                    builder.conjunction === "AND"
                      ? "bg-background text-foreground font-medium"
                      : "text-foreground hover:bg-background",
                  )}
                >
                  All
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={builder.conjunction === "OR"}
                  onClick={() => builder.setConjunction("OR")}
                  className={cn(
                    "px-2.5 py-0.5 rounded text-11 transition-colors cursor-pointer",
                    builder.conjunction === "OR"
                      ? "bg-background text-foreground font-medium"
                      : "text-foreground hover:bg-background",
                  )}
                >
                  Any
                </button>
              </div>
              <span className="text-foreground">
                of the following conditions:
              </span>
            </div>
          </div>

          {/* 3. Criteria Rows Builder */}
          <div className="space-y-2">
            <div className="max-h-40 overflow-y-auto pr-1 space-y-2 scrollbar-thin">
              {builder.conditions.map((cond, idx) => (
                <ConditionRowEditor
                  key={cond.id}
                  condition={cond}
                  index={idx}
                  canRemove={builder.conditions.length > 1}
                  itemTypeOptions={builder.itemTypeOptions}
                  collections={builder.collections}
                  tagList={builder.tagList}
                  onFieldChange={builder.handleFieldChange}
                  onOperatorChange={builder.handleOperatorChange}
                  onValueChange={builder.handleValueChange}
                  onAddAfter={builder.handleAddCondition}
                  onRemove={builder.handleRemoveCondition}
                />
              ))}
            </div>
          </div>

          {/* 4. Checkbox Options - Scope Options */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={builder.searchSubcollections}
                onCheckedChange={(c) => builder.setSearchSubcollections(!!c)}
              />
              <span className="text-12 text-foreground font-normal">
                Search subcollections
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={builder.showOnlyTopLevel}
                onCheckedChange={(c) => builder.setShowOnlyTopLevel(!!c)}
              />
              <span className="text-12 text-foreground font-normal">
                Show only top-level items
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={builder.includeParentAndChild}
                onCheckedChange={(c) => builder.setIncludeParentAndChild(!!c)}
              />
              <span className="text-12 text-foreground font-normal">
                Include parent and child items
              </span>
            </label>
          </div>

          {/* 5. Live Results Table */}
          <SavedSearchPreviewTable
            isPreviewLoading={builder.isPreviewLoading}
            previewCount={builder.previewCount}
            previewSamples={builder.previewSamples}
            sortBy={builder.sortBy}
            onSortByChange={builder.setSortBy}
            sortOrder={builder.sortOrder}
            onSortOrderChange={builder.setSortOrder}
          />

          {/* Validation error */}
          {builder.error && (
            <p
              role="alert"
              aria-live="assertive"
              className="text-11 font-medium text-destructive"
            >
              {builder.error}
            </p>
          )}

          {/* Footer */}
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="h-8 px-3 text-13 font-normal cursor-pointer text-foreground rounded-md hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-8 px-4 text-13 font-medium cursor-pointer rounded-md shadow-none"
            >
              {isPending
                ? "Saving..."
                : savedSearch
                  ? "Save Changes"
                  : "Save Search"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateSavedSearchModal;
