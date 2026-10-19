"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Library,
  Folder,
  FolderKanban,
  X,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { useUpdateLibraryItemMutation } from "@/features/library/sdk/queries/catalog.queries";
import { useCollections } from "@/features/library/sdk/queries/collections.queries";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import { useLibraryProjectContext } from "@/features/library/core/adapters/project-context.adapter";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import type {
  Item,
  Collection,
} from "@/features/library/domain/types/library.types";

// ── Helper: compute ancestor breadcrumb path for a collection ────────────────
function getCollectionAncestorPath(
  collectionId: string,
  colMap: Map<string, Collection>,
  memo?: Map<string, string>,
): string {
  const cached = memo?.get(collectionId);
  if (cached !== undefined) return cached;

  const parts: string[] = [];
  let curr = colMap.get(collectionId);
  const visited = new Set<string>();

  while (curr?.parentId && !visited.has(curr.parentId)) {
    visited.add(curr.parentId);
    const parent = colMap.get(curr.parentId);
    if (parent?.name) {
      parts.push(parent.name);
    }
    curr = parent;
  }
  parts.reverse();
  const resolved = parts.join(" / ");
  memo?.set(collectionId, resolved);
  return resolved;
}

// ── Shared Hook: Item Collections State & Undoable Toggle/Remove ────────────
function useItemCollectionsManager(
  item: Item,
  effectiveScope: string,
  canEdit: boolean,
) {
  const updateItemMutation = useUpdateLibraryItemMutation(effectiveScope);
  const updateItem = useCallback(
    (
      itemId: string,
      data: Partial<Item>,
      options?: { expectedVersion?: number; silent?: boolean },
    ) => {
      updateItemMutation.mutate({
        itemId,
        data,
        expectedVersion: options?.expectedVersion,
        silent: options?.silent ?? true,
      });
    },
    [updateItemMutation],
  );
  const { collections = [], createCollection } = useCollections(effectiveScope);

  // Map collections for O(1) lookup
  const colMap = useMemo(() => {
    const map = new Map<string, Collection>();
    collections.forEach((c: Collection) => map.set(c.id, c));
    (item?.collections || []).forEach((c) => {
      if (c?.id && !map.has(c.id)) {
        map.set(c.id, c as Collection);
      }
    });
    return map;
  }, [collections, item?.collections]);

  // Pre-compute ancestor paths and lowercased search tokens once per colMap change
  const collectionSearchIndex = useMemo(() => {
    const pathMemo = new Map<string, string>();
    const index = new Map<
      string,
      { path: string; lowerPath: string; lowerName: string }
    >();
    colMap.forEach((col, id) => {
      const path = getCollectionAncestorPath(id, colMap, pathMemo);
      index.set(id, {
        path,
        lowerPath: path.toLowerCase(),
        lowerName: (col.name || "").toLowerCase(),
      });
    });
    return index;
  }, [colMap]);

  // Set of all currently assigned collection IDs
  const assignedCollectionIdsSet = useMemo(() => {
    const ids = new Set<string>();
    if (Array.isArray(item?.collectionIds)) {
      item.collectionIds.forEach((id) => id && ids.add(id));
    }
    if (Array.isArray(item?.collections)) {
      item.collections.forEach((c) => c?.id && ids.add(c.id));
    }
    return ids;
  }, [item?.collectionIds, item?.collections]);

  // Toggle assigning or removing a collection with undo support
  const handleToggleCollection = useCallback(
    (targetColId: string) => {
      if (!item?.id || !canEdit) return;
      const isAssigned = assignedCollectionIdsSet.has(targetColId);
      const prevIds = Array.from(assignedCollectionIdsSet);
      const remainingIds = isAssigned
        ? prevIds.filter((id) => id !== targetColId)
        : [...prevIds, targetColId];

      updateItem(
        item.id,
        {
          collectionIds: remainingIds,
        },
        { expectedVersion: item.version },
      );

      const targetCol = colMap.get(targetColId);
      const colName = targetCol?.name || "Collection";
      if (isAssigned) {
        const remainingCount = remainingIds.length;
        const description =
          remainingCount === 0
            ? "Item is now in Unfiled Items (remains safely in your library)."
            : `Item remains in ${remainingCount} other ${remainingCount === 1 ? "collection" : "collections"}.`;

        toast.success(`Removed from "${colName}"`, {
          description,
          id: "col-assign",
          duration: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              updateItem(
                item.id,
                {
                  collectionIds: prevIds,
                },
                { expectedVersion: item.version },
              );
              toast.success(`Restored to "${colName}"`, { id: "col-assign" });
            },
          },
        });
      } else {
        toast.success(`Added to "${colName}"`, { id: "col-assign" });
      }
    },
    [
      item?.id,
      item?.version,
      assignedCollectionIdsSet,
      canEdit,
      updateItem,
      colMap,
    ],
  );

  return {
    collections,
    colMap,
    collectionSearchIndex,
    assignedCollectionIdsSet,
    updateItem,
    createCollection,
    handleToggleCollection,
  };
}

// ── CollectionPickerPopover Component ────────────────────────────────────────
export interface CollectionPickerPopoverProps {
  item: Item;
  scopeId?: string;
  canEdit?: boolean;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}

export function CollectionPickerPopover(props: CollectionPickerPopoverProps) {
  const { item, scopeId, canEdit = true, align = "end", children } = props;
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  const effectiveScope = scopeId || item?.projectId || "user";
  const {
    collections,
    colMap,
    collectionSearchIndex,
    assignedCollectionIdsSet,
    updateItem,
    createCollection,
    handleToggleCollection,
  } = useItemCollectionsManager(item, effectiveScope, canEdit);
  const openModal = useLibraryUIStore((s) => s.openModal);

  // Filter collections based on search query using O(1) pre-computed index
  const filteredCollections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return collections;
    return collections.filter((c: Collection) => {
      const entry = collectionSearchIndex.get(c.id);
      if (entry) {
        return entry.lowerName.includes(q) || entry.lowerPath.includes(q);
      }
      const name = c.name?.toLowerCase() || "";
      const path = getCollectionAncestorPath(c.id, colMap).toLowerCase();
      return name.includes(q) || path.includes(q);
    });
  }, [collections, searchQuery, colMap, collectionSearchIndex]);

  // Quick create a new collection from search query and assign item to it immediately
  const handleQuickCreateAndAssign = async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !item.id || !canEdit || isCreatingQuick) return;

    setIsCreatingQuick(true);
    try {
      const res = await createCollection({
        name: trimmed,
        parentId: null,
      });
      const createdId =
        (res as { collection?: { id: string }; id?: string })?.collection?.id ||
        (res as { id?: string })?.id;
      if (createdId) {
        const nextIds = [...Array.from(assignedCollectionIdsSet), createdId];
        updateItem(
          item.id,
          {
            collectionIds: nextIds,
          },
          { expectedVersion: item.version },
        );
        toast.success(`Created & added to "${trimmed}"`, { id: "col-assign" });
        setSearchQuery("");
      }
    } catch (err: unknown) {
      toast.error("Failed to create collection", {
        description: err instanceof Error ? err.message : "Please try again.",
        id: "col-assign",
      });
    } finally {
      setIsCreatingQuick(false);
    }
  };

  const exactMatchExists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return collections.some(
      (c: Collection) => c.name?.trim().toLowerCase() === q,
    );
  }, [collections, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        className="w-[270px] p-0 rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-300 overflow-hidden z-50 select-none font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border-subtle bg-muted">
          <Search
            className="size-3.5 text-muted-foreground shrink-0"
            strokeWidth={1.5}
          />
          <input
            type="text"
            placeholder="Search or add collection..."
            aria-label="Search or add collection"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                searchQuery.trim() &&
                !exactMatchExists
              ) {
                e.preventDefault();
                handleQuickCreateAndAssign();
              }
            }}
            className="w-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none"
            autoFocus
          />
          {searchQuery && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted p-0.5 rounded cursor-pointer shrink-0"
                  aria-label="Clear search"
                >
                  <X className="size-3" strokeWidth={1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Clear search</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Collections List with Checkbox Selection */}
        <div className="max-h-56 overflow-y-auto p-1 flex flex-col gap-0.5">
          {filteredCollections.length === 0 ? (
            <div className="py-4 px-2 text-center text-11 text-muted-foreground">
              {searchQuery
                ? `No collections matching "${searchQuery}"`
                : "No collections available"}
            </div>
          ) : (
            filteredCollections.map((col: Collection) => {
              const isAssigned = assignedCollectionIdsSet.has(col.id);
              const path = getCollectionAncestorPath(col.id, colMap);

              return (
                <div
                  key={col.id}
                  onClick={() => handleToggleCollection(col.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors text-12 select-none group"
                >
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={() => handleToggleCollection(col.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="size-3.5 rounded-xs shrink-0 cursor-pointer"
                  />
                  <Folder
                    className="size-3.5 text-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    {path && (
                      <span className="text-10 text-muted-foreground truncate leading-none mb-0.5">
                        {path}
                      </span>
                    )}
                    <span className="truncate leading-tight text-foreground font-normal">
                      {col.name}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Create option if search query doesn't match an existing collection */}
        {searchQuery.trim() && !exactMatchExists && (
          <div className="p-1 border-t border-border-subtle bg-background">
            <button
              type="button"
              disabled={isCreatingQuick}
              onClick={handleQuickCreateAndAssign}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-primary/10 text-primary text-12 cursor-pointer transition-colors"
            >
              {isCreatingQuick ? (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              ) : (
                <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
              )}
              <span className="truncate">
                Create <strong>&ldquo;{searchQuery.trim()}&rdquo;</strong> &amp;
                assign
              </span>
            </button>
          </div>
        )}

        {/* Footer info & global create modal trigger */}
        <div className="p-1 border-t border-border-subtle flex items-center justify-between px-2.5 py-1 text-11 text-muted-foreground bg-muted">
          <span>
            {collections.length}{" "}
            {collections.length === 1 ? "collection" : "collections"}
          </span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openModal("CREATE_COLLECTION");
            }}
            className="text-primary hover:underline cursor-pointer font-medium"
          >
            New collection...
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Main CollectionsSection Component ─────────────────────────────────────────
interface CollectionsSectionProps {
  item: Item;
  scopeId?: string;
  hideHeader?: boolean;
  canEdit?: boolean;
}

export default function CollectionsSection(props: CollectionsSectionProps) {
  const { item, scopeId, hideHeader = false, canEdit = true } = props;
  const effectiveScope = scopeId || item?.projectId || "user";
  const openModal = useLibraryUIStore((s) => s.openModal);
  const {
    colMap,
    collectionSearchIndex,
    assignedCollectionIdsSet,
    handleToggleCollection: handleRemoveFromCollection,
  } = useItemCollectionsManager(item, effectiveScope, canEdit);
  const { projects = [] } = useLibraryProjectContext();

  // Resolve active library root name and icon (My Library vs Project Library)
  const isProject = Boolean(
    (typeof effectiveScope === "string" &&
      effectiveScope.startsWith("project:")) ||
    item?.projectId,
  );

  const matchedProject = useMemo(() => {
    if (!isProject) return null;
    const cleanId = effectiveScope.replace(/^project:/, "");
    return (
      projects.find((p) => p.id === cleanId || p.id === item?.projectId) ||
      null
    );
  }, [isProject, effectiveScope, item?.projectId, projects]);

  const libraryTitle = isProject
    ? matchedProject?.name || "Project Library"
    : "My Library";

  const libraryRootHref =
    isProject && matchedProject?.id
      ? `/projects/${matchedProject.id}/library`
      : "/library";

  // List of assigned collection objects with resolved names and paths
  const assignedCollections = useMemo(() => {
    const list: Array<{ id: string; name: string; path: string }> = [];
    assignedCollectionIdsSet.forEach((colId) => {
      const col = colMap.get(colId);
      const name = col?.name || "Collection";
      const path =
        collectionSearchIndex.get(colId)?.path ??
        getCollectionAncestorPath(colId, colMap);
      list.push({ id: colId, name, path });
    });
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [assignedCollectionIdsSet, colMap, collectionSearchIndex]);

  return (
    <div className="flex flex-col gap-0.5 select-none font-sans w-full">
      {/* Optional Standalone Header if not rendered within InspectorSection */}
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-12 font-medium text-foreground">
            Libraries and Collections
          </h3>
          {canEdit && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => openModal("CREATE_COLLECTION")}
                  className="size-5 flex items-center justify-center rounded text-foreground hover:bg-muted cursor-pointer transition-colors"
                  aria-label="Create collection"
                >
                  <Plus
                    className="size-3.5 text-foreground shrink-0"
                    strokeWidth={1.5}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Create collection</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Primary Library Root Row */}
      <div className="flex items-center justify-between gap-1.5 h-7 px-1.5 text-12 rounded-md hover:bg-muted transition-colors group">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="size-4 shrink-0 flex items-center justify-center">
            {isProject ? (
              <FolderKanban
                className="size-3.5 text-foreground shrink-0"
                strokeWidth={1.5}
              />
            ) : (
              <Library
                className="size-3.5 text-foreground shrink-0"
                strokeWidth={1.5}
              />
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={libraryRootHref}
                className="font-medium text-12 text-foreground tracking-tight truncate hover:underline select-none"
              >
                {libraryTitle}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="top">{`Navigate to ${libraryTitle}`}</TooltipContent>
          </Tooltip>
        </div>

        {assignedCollectionIdsSet.size > 0 && (
          <span className="text-11 px-1.5 py-0.2 rounded bg-muted font-medium text-foreground shrink-0">
            {assignedCollectionIdsSet.size}
          </span>
        )}
      </div>

      {/* When Unfiled: Clean inline Add action */}
      {assignedCollectionIdsSet.size === 0 && canEdit && (
        <div className="pt-0.5 px-1.5">
          <CollectionPickerPopover
            item={item}
            scopeId={effectiveScope}
            canEdit={canEdit}
            align="start"
          >
            <button
              type="button"
              className="inline-flex items-center gap-1 text-11 text-foreground hover:text-foreground transition-colors cursor-pointer py-0.5"
            >
              <Plus className="size-3" strokeWidth={1.5} />
              Add to a collection
            </button>
          </CollectionPickerPopover>
        </div>
      )}

      {/* When Assigned: Hierarchical Collection Rows */}
      {assignedCollections.map((col) => {
        const href =
          isProject && matchedProject?.id
            ? `/projects/${matchedProject.id}/library/${col.id}`
            : `/library/${col.id}`;

        return (
          <div
            key={col.id}
            className="flex items-center justify-between gap-1.5 min-h-[28px] py-1 px-1.5 pl-5 text-12 rounded-md hover:bg-muted transition-colors group"
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="size-3.5 shrink-0 flex items-center justify-center">
                <Folder
                  className="size-3.5 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center">
                {col.path && (
                  <span className="text-10 text-foreground leading-none truncate mb-0.5">
                    {col.path}
                  </span>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      className="text-12 truncate leading-tight text-foreground font-normal hover:underline select-none"
                    >
                      {col.name}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {col.path ? `${col.path} / ${col.name}` : col.name}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {canEdit && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromCollection(col.id);
                    }}
                    className="invisible group-hover:visible max-md:visible size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer shrink-0 transition-colors"
                    aria-label={`Remove from collection ${col.name}, item will remain in library`}
                  >
                    <X className="size-3.5 shrink-0" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Remove from collection
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      })}

      {/* In-body Add action link when already assigned to collections */}
      {assignedCollections.length > 0 && canEdit && (
        <div className="pt-1 px-1.5">
          <CollectionPickerPopover
            item={item}
            scopeId={effectiveScope}
            canEdit={canEdit}
            align="start"
          >
            <button
              type="button"
              className="inline-flex items-center gap-1 text-11 text-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <Plus className="size-3" strokeWidth={1.5} />
              Add to another collection
            </button>
          </CollectionPickerPopover>
        </div>
      )}
    </div>
  );
}
