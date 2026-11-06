"use client";

import React, { useState, useMemo } from "react";
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
import { createUpdateItemMetadataCommand } from "@/features/library/core/manager/library-command.manager";
import { useLibraryProjectContext } from "@/features/library/core/adapters/project-context.adapter";
import {
  getCollectionAncestorPath,
  useItemCollectionsManager,
  type ItemCollectionsManagerState,
} from "@/features/library/core/coordinator/inspector-item.coordinator";
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
import type {
  Item,
  Collection,
  CreateCollectionDTO,
} from "@/features/library/types/core.types";

export {
  getCollectionAncestorPath,
  useItemCollectionsManager,
  type ItemCollectionsManagerState,
};

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
  onUpdateItem?: (
    payload: Partial<Item>,
    options?: { silent?: boolean; skipHistory?: boolean },
  ) => Promise<unknown> | void;
  manager?: ItemCollectionsManagerState;
  onClose: () => void;
}

function CollectionPickerContent({
  item,
  scopeId,
  canEdit = true,
  align = "end",
  collections: externalCollections,
  createCollection: externalCreateCollection,
  onUpdateItem,
  manager: externalManager,
  onClose,
}: CollectionPickerContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingQuick, setIsCreatingQuick] = useState(false);

  const effectiveScope = scopeId || item?.projectId || "user";
  const internalManager = useItemCollectionsManager(
    item,
    effectiveScope,
    canEdit && !externalManager,
    externalCollections,
    externalCreateCollection,
    onUpdateItem,
  );
  const {
    collections,
    colMap,
    collectionSearchIndex,
    assignedCollectionIdsSet,
    updateItem,
    createCollection,
    handleToggleCollection,
    pushExecutedCommand,
  } = externalManager ?? internalManager;

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
        const prevIds = Array.from(assignedCollectionIdsSet);
        const nextIds = [...prevIds, createdId];
        const command = createUpdateItemMetadataCommand({
          itemId: item.id,
          description: `Added to "${trimmed}"`,
          forwardPatch: { collectionIds: nextIds },
          inversePatch: { collectionIds: prevIds },
          applyPatch: (id, patch) => updateItem(id, patch, { silent: true }),
        });
        await updateItem(
          item.id,
          {
            collectionIds: nextIds,
          },
          { expectedVersion: item.version },
        );
        pushExecutedCommand(command, { silentToast: true });
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
      sideOffset={4}
      onWheel={(e) => e.stopPropagation()}
      className="w-56 p-0 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 overflow-hidden z-50 select-none font-sans"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Borderless Search Header */}
      <div className="flex items-center gap-2 px-2.5 h-8.5 border-b border-border">
        <Search
          className="size-3.5 text-muted-foreground pointer-events-none shrink-0"
          strokeWidth={1.5}
        />
        <input
          type="text"
          placeholder={
            collections.length > 0
              ? "Filter collections..."
              : "New collection name..."
          }
          aria-label="Filter or create collection"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose();
            } else if (
              e.key === "Enter" &&
              searchQuery.trim() &&
              !exactMatchExists
            ) {
              e.preventDefault();
              void handleQuickCreateAndAssign();
            }
          }}
          className="flex-1 min-w-0 h-full bg-transparent text-12 text-foreground placeholder:text-muted-foreground outline-none border-none font-sans"
          autoFocus
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-muted-foreground hover:text-foreground hover:bg-muted p-0.5 rounded cursor-pointer flex items-center justify-center shrink-0 focus-visible:outline-none"
            aria-label="Clear search"
          >
            <X className="size-3 shrink-0" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Collections List or Empty State */}
      {filteredCollections.length > 0 ? (
        <div className="max-h-56 overflow-y-auto p-1 flex flex-col gap-0.5 scrollbar-thin">
          {filteredCollections.map((col: Collection) => {
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
                  className="size-3.5 rounded-xs border-border shrink-0 cursor-pointer"
                />
                <Folder
                  className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"
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
          })}
        </div>
      ) : !(canEdit && searchQuery.trim() && !exactMatchExists) ? (
        <div className="py-5 px-3 flex flex-col items-center justify-center gap-1 text-center select-none">
          <Folder
            className="size-4 text-muted-foreground/60 shrink-0"
            strokeWidth={1.5}
          />
          <span className="text-12 text-muted-foreground">
            {searchQuery.trim() ? "No matching collections" : "No collections yet"}
          </span>
        </div>
      ) : null}

      {/* Inline Quick-Create Row (only shown when typing a new collection name) */}
      {canEdit && searchQuery.trim() && !exactMatchExists && (
        <div
          className={
            filteredCollections.length > 0
              ? "p-1 border-t border-border"
              : "p-1"
          }
        >
          <button
            type="button"
            disabled={isCreatingQuick}
            onClick={handleQuickCreateAndAssign}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/60 hover:bg-muted text-foreground text-12 cursor-pointer transition-colors"
          >
            {isCreatingQuick ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            )}
            <span className="truncate">
              Create <strong>&ldquo;{searchQuery.trim()}&rdquo;</strong>
            </span>
          </button>
        </div>
      )}
    </PopoverContent>
  );
}

// ── CollectionPickerPopover Component ────────────────────────────────────────
interface CollectionPickerPopoverProps {
  item: Item;
  scopeId?: string;
  canEdit?: boolean;
  align?: "start" | "center" | "end";
  collections?: Collection[];
  createCollection?: (
    data: CreateCollectionDTO & { scopeId?: string },
  ) => Promise<unknown>;
  onUpdateItem?: (
    payload: Partial<Item>,
    options?: { silent?: boolean; skipHistory?: boolean },
  ) => Promise<unknown> | void;
  manager?: ItemCollectionsManagerState;
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
    onUpdateItem,
    manager,
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
          onUpdateItem={onUpdateItem}
          manager={manager}
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
  onUpdateItem?: (
    payload: Partial<Item>,
    options?: { silent?: boolean; skipHistory?: boolean },
  ) => Promise<unknown> | void;
}

export default function CollectionsSection(props: CollectionsSectionProps) {
  const { item, scopeId, hideHeader = false, canEdit = true, onUpdateItem } = props;
  const effectiveScope = scopeId || item?.projectId || "user";
  const manager = useItemCollectionsManager(
    item,
    effectiveScope,
    canEdit,
    undefined,
    undefined,
    onUpdateItem,
  );
  const {
    collections,
    colMap,
    collectionSearchIndex,
    assignedCollectionIdsSet,
    createCollection,
    handleToggleCollection: handleRemoveFromCollection,
  } = manager;
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
              onUpdateItem={onUpdateItem}
              manager={manager}
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
                  <span className="text-10 text-muted-foreground leading-none truncate mb-0.5">
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
