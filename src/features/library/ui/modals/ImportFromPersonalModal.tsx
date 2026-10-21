"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Loader2,
  Folder,
  FolderOpen,
  FileText,
  X,
  Library,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { cn } from "@/shared/lib/utils";
import {
  useViewItems,
  useLibraryCountsQuery,
  useImportFromUserMutation,
} from "@/features/library/sdk/queries/catalog.queries";
import { useCollections } from "@/features/library/sdk/queries/collections.queries";
import {
  formatCreatorCompact,
  normalizeAuthors,
} from "@/features/library/domain/creators";
import type {
  Item,
} from "@/features/library/domain/types/library.types";

interface ImportFromPersonalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeId: string;
  projectName: string;
  existingTitles?: string[];
  onSuccess?: () => void;
}

export default function ImportFromPersonalModal({
  open,
  onOpenChange,
  scopeId,
  projectName,
  existingTitles = [],
  onSuccess,
}: ImportFromPersonalModalProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedScope, setSelectedScope] = useState<string>("all"); // 'all' | 'unfiled' | collectionId
  const [selectedIdsSet, setSelectedIdsSet] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // 1. Query personal collections & authoritative server counts
  const { collections: personalCollections = [] } = useCollections("user");
  const { data: userLibraryCounts } = useLibraryCountsQuery("user");

  // O(1) collection name lookup map
  const collectionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of personalCollections) {
      if (c.id && c.name) map.set(c.id, c.name);
    }
    return map;
  }, [personalCollections]);

  // 2. Query personal items via Backend with view, collectionId, and search
  const activeView = selectedScope === "unfiled" ? "unfiled" : "all";
  const activeCollectionId =
    selectedScope !== "all" && selectedScope !== "unfiled"
      ? selectedScope
      : undefined;

  const { data, isLoading } = useViewItems("user", activeView, {
    enabled: open,
    limit: 200,
    search: debouncedSearch || undefined,
    collectionId: activeCollectionId,
  });
  const filteredItems: Item[] = useMemo(() => data?.items ?? [], [data?.items]);

  // Authoritative counts from Backend
  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: userLibraryCounts?.total ?? data?.total ?? filteredItems.length,
      unfiled: userLibraryCounts?.unfiled ?? 0,
    };
    for (const col of personalCollections) {
      counts[col.id] = col.itemCount ?? 0;
    }
    return counts;
  }, [userLibraryCounts?.total, userLibraryCounts?.unfiled, data?.total, filteredItems.length, personalCollections]);

  // Normalized existing titles set for O(1) duplicate detection
  const existingSet = useMemo(() => {
    return new Set(existingTitles.map((t) => t.toLowerCase().trim()));
  }, [existingTitles]);

  const indexedItems = useMemo(() => {
    const map = new Map<
      string,
      {
        titleLower: string;
        authorText: string;
      }
    >();
    for (const it of filteredItems) {
      const titleLower = (it.title || "").toLowerCase().trim();
      const authorText = formatCreatorCompact(normalizeAuthors(it));
      map.set(it.id, { titleLower, authorText });
    }
    return map;
  }, [filteredItems]);

  // Filter items eligible for selection (not already in the project)
  const selectableItems = useMemo(() => {
    return filteredItems.filter((it) => {
      const titleLower =
        indexedItems.get(it.id)?.titleLower ??
        (it.title || "").toLowerCase().trim();
      return !existingSet.has(titleLower);
    });
  }, [filteredItems, existingSet, indexedItems]);

  const isAllSelectableSelected = useMemo(
    () =>
      selectableItems.length > 0 &&
      selectableItems.every((it) => selectedIdsSet.has(it.id)),
    [selectableItems, selectedIdsSet],
  );

  const toggleSelectAll = () => {
    if (isAllSelectableSelected) {
      const viewIds = new Set(selectableItems.map((it) => it.id));
      setSelectedIdsSet((prev) => {
        const next = new Set<string>();
        prev.forEach((id) => {
          if (!viewIds.has(id)) next.add(id);
        });
        return next;
      });
    } else {
      setSelectedIdsSet((prev) => {
        const next = new Set(prev);
        for (const it of selectableItems) next.add(it.id);
        return next;
      });
    }
  };

  const toggleSelect = (id: string, isAlreadyInProject: boolean) => {
    if (isAlreadyInProject) return;
    setSelectedIdsSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const importMutation = useImportFromUserMutation(scopeId);
  const isImporting = importMutation.isPending;

  const handleImport = async () => {
    if (selectedIdsSet.size === 0 || !scopeId) return;
    const selectedIds = Array.from(selectedIdsSet);
    try {
      const res = await importMutation.mutateAsync(selectedIds);
      toast.success(
        `Imported ${res.importedCount ?? selectedIds.length} reference(s) into ${projectName}`,
        { id: "import-user-refs" },
      );
      setSelectedIdsSet(new Set());
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error("Failed to import references", {
        description: err instanceof Error ? err.message : String(err),
        id: "import-personal-refs",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[92vw] h-[660px] max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden border border-border bg-background shadow-raised-200 rounded-lg font-sans select-none">
        {/* Header */}
        <DialogHeader className="px-5 py-3.5 border-b border-border flex flex-row items-center justify-between shrink-0 bg-background">
          <div>
            <div className="flex items-center gap-2">
              <Library
                className="size-4 text-foreground shrink-0"
                strokeWidth={1.5}
              />
              <DialogTitle className="text-14 font-semibold text-foreground tracking-tight">
                Import from My Library
              </DialogTitle>
            </div>
            <DialogDescription className="text-12 text-foreground mt-0.5">
              Select references from your user library to collaborate on in{" "}
              <span className="font-semibold text-foreground">
                {projectName}
              </span>
              .
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Modal Body: 2 Columns */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left Column: My Library Collections Tree */}
          <aside className="w-64 shrink-0 border-r border-border bg-muted flex flex-col overflow-hidden">
            <div className="px-3 py-2 text-11 font-medium text-foreground tracking-tight border-b border-border select-none">
              Personal Collections
            </div>

            <div
              className="flex-1 overflow-y-auto p-2 space-y-0.5 thin-scrollbar"
              role="navigation"
              aria-label="Personal library scopes"
            >
              {/* All Items */}
              <button
                type="button"
                onClick={() => setSelectedScope("all")}
                aria-current={selectedScope === "all" ? "page" : undefined}
                className={cn(
                  "w-full h-8 px-2.5 flex items-center justify-between rounded-md text-12 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selectedScope === "all"
                    ? "bg-muted text-foreground font-medium shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted font-normal",
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <Library className="size-3.5 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">All References</span>
                </div>
                <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0">
                  {collectionCounts.all}
                </span>
              </button>

              {/* Collections List */}
              {personalCollections.map((col) => {
                const isSelected = selectedScope === col.id;
                const count = collectionCounts[col.id] || 0;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setSelectedScope(col.id)}
                    aria-current={isSelected ? "page" : undefined}
                    className={cn(
                      "w-full h-8 px-2.5 flex items-center justify-between rounded-md text-12 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      isSelected
                        ? "bg-muted text-foreground font-medium shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted font-normal",
                    )}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isSelected ? (
                        <FolderOpen
                          className="size-3.5 shrink-0"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <Folder
                          className="size-3.5 shrink-0"
                          strokeWidth={1.5}
                        />
                      )}
                      <span className="truncate">{col.name}</span>
                    </div>
                    <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0">
                      {count}
                    </span>
                  </button>
                );
              })}

              {/* Unfiled */}
              {collectionCounts.unfiled > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedScope("unfiled")}
                  aria-current={
                    selectedScope === "unfiled" ? "page" : undefined
                  }
                  className={cn(
                    "w-full h-8 px-2.5 flex items-center justify-between rounded-md text-12 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    selectedScope === "unfiled"
                      ? "bg-muted text-foreground font-medium shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted font-normal",
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-3.5 shrink-0" strokeWidth={1.5} />
                    <span className="truncate">Unfiled Items</span>
                  </div>
                  <span className="text-10 font-mono text-muted-foreground tabular-nums shrink-0">
                    {collectionCounts.unfiled}
                  </span>
                </button>
              )}
            </div>
          </aside>

          {/* Right Column: References List with Search & Actions */}
          <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
            {/* Search Bar & Select All Action */}
            <div className="p-3 border-b border-border bg-background flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search references by title, author, year, DOI..."
                  className="h-8 pl-8 pr-7 text-13 text-foreground placeholder:text-muted-foreground rounded-md bg-background border-border hover:border-border-hover focus-visible:border-primary focus-visible:ring-ring"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center text-foreground hover:bg-muted rounded-xs cursor-pointer"
                  >
                    <X className="size-3 shrink-0" />
                  </button>
                )}
              </div>

              {selectableItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-8 text-13 font-medium whitespace-nowrap cursor-pointer hover:bg-muted rounded-md text-foreground"
                >
                  {isAllSelectableSelected
                    ? "Deselect All"
                    : `Select All (${selectableItems.length})`}
                </Button>
              )}
            </div>

            {/* References Table / List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border-subtle thin-scrollbar">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-foreground">
                  <Loader2 className="size-5 animate-spin mb-2" />
                  <span className="text-12 font-medium">
                    Loading personal library...
                  </span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-foreground px-4">
                  <Library
                    className="size-6 mb-2 opacity-60"
                    strokeWidth={1.5}
                  />
                  <p className="text-13 font-medium text-foreground">
                    No references found
                  </p>
                  <p className="text-12 text-foreground mt-0.5 max-w-xs">
                    {search.trim()
                      ? "No items match your search filter."
                      : "There are no references in this collection."}
                  </p>
                </div>
              ) : (
                filteredItems.map((item) => {
                  const isSelected = selectedIdsSet.has(item.id);
                  const indexed = indexedItems.get(item.id);
                  const titleLower =
                    indexed?.titleLower ??
                    (item.title || "").toLowerCase().trim();
                  const isAlreadyInProject = existingSet.has(titleLower);
                  const authorText =
                    indexed?.authorText ??
                    formatCreatorCompact(normalizeAuthors(item));
                  const firstColId = item.collectionIds?.[0];
                  const colName = firstColId
                    ? collectionNameMap.get(firstColId) || null
                    : null;

                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelect(item.id, isAlreadyInProject)}
                      className={cn(
                        "flex items-start gap-3 px-4 py-2.5 transition-colors select-none",
                        isAlreadyInProject
                          ? "opacity-50 cursor-not-allowed bg-muted"
                          : isSelected
                            ? "bg-muted cursor-pointer"
                            : "hover:bg-muted cursor-pointer",
                      )}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={isAlreadyInProject}
                        onCheckedChange={() =>
                          toggleSelect(item.id, isAlreadyInProject)
                        }
                        className="size-3.5 border-border data-[state=checked]:border-primary mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-13 font-medium text-foreground truncate leading-tight flex-1">
                            {item.title || "Untitled Reference"}
                          </p>
                          {isAlreadyInProject && (
                            <span className="text-10 font-mono text-foreground bg-muted border border-border px-1.5 py-0.2 rounded-sm shrink-0">
                              Already in project
                            </span>
                          )}
                          {colName && (
                            <span className="text-10 font-mono text-foreground bg-muted border border-border px-1.5 py-0.2 rounded-sm shrink-0 truncate max-w-[120px]">
                              {colName}
                            </span>
                          )}
                        </div>

                        <p className="text-12 text-foreground truncate mt-0.5">
                          {authorText ? `${authorText} ` : ""}
                          {item.year ? `(${item.year})` : ""}
                          {item.publicationTitle
                            ? ` · ${item.publicationTitle}`
                            : ""}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </main>
        </div>

        {/* Footer */}
        <DialogFooter className="px-5 py-3 border-t border-border bg-background flex items-center justify-between sm:justify-between shrink-0">
          <span className="text-11 text-foreground font-mono">
            {selectedIdsSet.size} reference(s) selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-13 font-medium cursor-pointer hover:bg-muted rounded-md"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={selectedIdsSet.size === 0 || isImporting}
              className="h-8 text-13 font-medium gap-1.5 cursor-pointer rounded-md shadow-none"
            >
              {isImporting && (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              )}
              <span>Import to Project ({selectedIdsSet.size})</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
