"use client";

import React, { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Library,
  Folder,
  FolderKanban,
  FolderPlus,
  X,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import { useUpdateLibraryItemMutation } from "@/features/library/sdk/queries/catalog.queries";
import { useCollections } from "@/features/library/sdk/queries/collections.queries";
import { useLibraryUIStore } from "@/features/library/core/store/library-ui.store";
import {
  useLibraryCommandStore,
  createUpdateItemMetadataCommand,
} from "@/features/library/core/manager/library-command.manager";
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
  CreateCollectionDTO,
} from "@/features/library/domain/types/library.types";
import { getAssignedCollectionIds } from "@/features/library/domain/metadata-mapper";

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
  externalCollections?: Collection[],
  externalCreateCollection?: (
    data: CreateCollectionDTO & { scopeId?: string },
  ) => Promise<unknown>,
) {
  const updateItemMutation = useUpdateLibraryItemMutation(effectiveScope);
  const updateItem = useCallback(
    (
      itemId: string,
      data: Partial<Item>,
      options?: { expectedVersion?: number; silent?: boolean },
    ) => {
      return updateItemMutation.mutateAsync({
        itemId,
        data,
        expectedVersion: options?.expectedVersion,
        silent: options?.silent ?? true,
      });
    },
    [updateItemMutation],
  );
  const {
    collections: queriedCollections = [],
    createCollection: queriedCreateCollection,
  } = useCollections({
    scopeId: effectiveScope,
    enabled: externalCollections === undefined,
  });
  const collections = externalCollections ?? queriedCollections;
  const createCollection =
    externalCreateCollection ?? queriedCreateCollection;
  const pushExecutedCommand = useLibraryCommandStore((s) => s.pushExecutedCommand);
  const undoCommand = useLibraryCommandStore((s) => s.undo);

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
  const assignedCollectionIdsSet = useMemo(
    () => new Set<string>(getAssignedCollectionIds(item)),
    [item],
  );

  // Toggle assigning or removing a collection with undo support
  const handleToggleCollection = useCallback(
    async (targetColId: string) => {
      if (!item?.id || !canEdit) return;
      const isAssigned = assignedCollectionIdsSet.has(targetColId);
      const prevIds = Array.from(assignedCollectionIdsSet);
      const remainingIds = isAssigned
        ? prevIds.filter((id) => id !== targetColId)
        : [...prevIds, targetColId];

      const targetItemId = item.id;
      const targetCol = colMap.get(targetColId);
      const colName = targetCol?.name || "Collection";
      const commandDescription = isAssigned
        ? `Removed from "${colName}"`
        : `Added to "${colName}"`;

      const command = createUpdateItemMetadataCommand({
        itemId: targetItemId,
        description: commandDescription,
        forwardPatch: { collectionIds: remainingIds },
        inversePatch: { collectionIds: prevIds },
        applyPatch: (id, patch) => updateItem(id, patch, { silent: true }),
      });

      try {
        await updateItem(
          targetItemId,
          {
            collectionIds: remainingIds,
          },
          { expectedVersion: item.version },
        );

        pushExecutedCommand(command, { silentToast: true });

        const undoAction = {
          label: "Undo",
          onClick: () => {
            void undoCommand(command.id);
          },
        };

        if (isAssigned) {
          const remainingCount = remainingIds.length;
          const description =
            remainingCount === 0
              ? "Item is now in Unfiled Items (remains safely in your library)."
              : `Item remains in ${remainingCount} other ${remainingCount === 1 ? "collection" : "collections"}.`;

          toast.success(`Removed from "${colName}"`, {
            description,
            id: "col-assign",
            duration: 3000,
            action: undoAction,
          });
        } else {
          toast.success(`Added to "${colName}"`, {
            id: "col-assign",
            action: undoAction,
          });
        }
      } catch (err: unknown) {
        toast.error(`Failed to update "${colName}"`, {
          description: err instanceof Error ? err.message : "Please try again.",
          id: "col-assign",
        });
      }
    },
    [
      item?.id,
      item?.version,
      assignedCollectionIdsSet,
      canEdit,
      updateItem,
      colMap,
      pushExecutedCommand,
      undoCommand,
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

// ── CollectionPickerContent Component (Lazy Popover Content) ───────────────
interface CollectionPickerContentProps {
  item: Item;
  scopeId?: string;
  canEdit?: boolean;
  align?: "start" | "center" | "end";
  collections?: Collection[];
  createCollection?: (
    data: CreateCollectionDTO & { scopeId?: string },
  ) => Promise<unknown>;
  onClose: () => void;
}

function CollectionPickerContent({
  item,
  scopeId,
  canEdit = true,
  align = "end",
  collections: externalCollections,
  createCollection: externalCreateCollection,
  onClose,
}: CollectionPickerContentProps) {
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
  } = useItemCollectionsManager(
    item,
    effectiveScope,
    canEdit,
    externalCollections,
    externalCreateCollection,
  );
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
        await updateItem(
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
    <PopoverContent
      align={align}
      sideOffset={6}
      className="w-[270px] p-0 rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-300 overflow-hidden z-50 select-none font-sans"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border">
        <Search
          className="size-3.5 text-muted-foreground shrink-0"
          strokeWidth={1.5}
        />
        <input
          type="text"
          placeholder="Search collections..."
          aria-label="Search collections"
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

      {/* Simplified footer: Create collection option */}
      {canEdit && (
        <div className="p-1 border-t border-border flex items-center">
          {searchQuery.trim() && !exactMatchExists ? (
            <button
              type="button"
              disabled={isCreatingQuick}
              onClick={handleQuickCreateAndAssign}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-foreground text-12 cursor-pointer transition-colors"
            >
              {isCreatingQuick ? (
                <Loader2 className="size-3.5 animate-spin shrink-0" />
              ) : (
                <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
              )}
              <span className="truncate">
                Create <strong>&ldquo;{searchQuery.trim()}&rdquo;</strong>
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                openModal("CREATE_COLLECTION", {
                  assignToItemId: item.id,
                  currentCollectionIds: Array.from(assignedCollectionIdsSet),
                });
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted text-foreground text-12 cursor-pointer transition-colors font-normal"
            >
              <FolderPlus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              <span>New collection...</span>
            </button>
          )}
        </div>
      )}
    </PopoverContent>
  );
}

// ── CollectionPickerPopover Component ────────────────────────────────────────
export interface CollectionPickerPopoverProps {
  item: Item;
  scopeId?: string;
  canEdit?: boolean;
  align?: "start" | "center" | "end";
  collections?: Collection[];
  createCollection?: (
    data: CreateCollectionDTO & { scopeId?: string },
  ) => Promise<unknown>;
  children: React.ReactNode;
}

export function CollectionPickerPopover(props: CollectionPickerPopoverProps) {
  const {
    item,
    scopeId,
    canEdit = true,
    align = "end",
    collections,
    createCollection,
    children,
  } = props;
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      {open && (
        <CollectionPickerContent
          item={item}
          scopeId={scopeId}
          canEdit={canEdit}
          align={align}
          collections={collections}
          createCollection={createCollection}
          onClose={() => setOpen(false)}
        />
      )}
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
  const {
    collections,
    colMap,
    collectionSearchIndex,
    assignedCollectionIdsSet,
    createCollection,
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
            <CollectionPickerPopover
              item={item}
              scopeId={effectiveScope}
              canEdit={canEdit}
              align="end"
              collections={collections}
              createCollection={createCollection}
            >
              <button
                type="button"
                className="size-5 flex items-center justify-center rounded text-foreground hover:bg-muted cursor-pointer transition-colors"
                aria-label="Manage collections"
              >
                <Plus
                  className="size-3.5 text-foreground shrink-0"
                  strokeWidth={1.5}
                />
              </button>
            </CollectionPickerPopover>
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
      </div>

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
                    className="invisible group-hover:visible group-focus-within:visible focus-visible:visible max-md:visible size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer shrink-0 transition-colors"
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

    </div>
  );
}
