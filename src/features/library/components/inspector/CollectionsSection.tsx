'use client';

import React from 'react';
import { Library, Folder, X, Plus } from 'lucide-react';
import { useItems, useCollections } from '../../data';
import { useLibraryModalStore } from '../../store';
import type { Item, Collection } from '../../types/library.types';

interface CollectionsSectionProps {
  paper: Item;
  scopeId?: string;
  projectId?: string;
  onCreateCollection?: () => void;
  hideHeader?: boolean;
  canEdit?: boolean;
}

export default function CollectionsSection({
  paper,
  scopeId,
  projectId,
  onCreateCollection,
  hideHeader = false,
  canEdit = true,
}: CollectionsSectionProps) {
  const effectiveScope = scopeId || projectId || paper?.projectId || 'user';
  const { actions } = useItems({ scopeId: effectiveScope });
  const { updatePaper } = actions;
  const { state: colState } = useCollections(effectiveScope);
  const collections = colState.collections;
  const openModal = useLibraryModalStore((s) => s.openModal);

  // Set of all collection IDs explicitly assigned to this paper
  const assignedCollectionIdsSet = React.useMemo(() => {
    const ids = new Set<string>();
    if (paper.collectionId) ids.add(paper.collectionId);
    if (Array.isArray(paper.collectionIds)) {
      paper.collectionIds.forEach((id) => id && ids.add(id));
    }
    if (Array.isArray(paper.collections)) {
      paper.collections.forEach((c) => c?.id && ids.add(c.id));
    }
    return ids;
  }, [paper.collectionId, paper.collectionIds, paper.collections]);

  // Build a deduplicated hierarchical tree for all assigned collections and their ancestors
  const flatNodes = React.useMemo(() => {
    if (!assignedCollectionIdsSet.size || !collections || collections.length === 0) return [];

    // Map all collections by id for fast lookup
    const colMap = new Map<string, Collection>();
    collections.forEach((c: Collection) => colMap.set(c.id, c));
    (paper.collections || []).forEach((c) => {
      if (c?.id && !colMap.has(c.id)) {
        colMap.set(c.id, c as Collection);
      }
    });

    // Collect all unique collection IDs that are part of any assigned hierarchy
    const relevantIds = new Set<string>();
    assignedCollectionIdsSet.forEach((startId) => {
      let currId: string | null = startId;
      const visited = new Set<string>();
      while (currId && !visited.has(currId)) {
        visited.add(currId);
        relevantIds.add(currId);
        const col = colMap.get(currId);
        currId = col?.parentId || null;
      }
    });

    // Build tree: identify roots among relevantIds and map parent -> children
    const childrenMap = new Map<string, string[]>();
    const roots: string[] = [];

    relevantIds.forEach((id) => {
      const col = colMap.get(id);
      const parentId = col?.parentId;
      if (parentId && relevantIds.has(parentId)) {
        const list = childrenMap.get(parentId) || [];
        list.push(id);
        childrenMap.set(parentId, list);
      } else {
        roots.push(id);
      }
    });

    // Sort roots and children alphabetically by collection name
    const sortById = (a: string, b: string) => {
      const nameA = colMap.get(a)?.name || '';
      const nameB = colMap.get(b)?.name || '';
      return nameA.localeCompare(nameB);
    };

    roots.sort(sortById);
    childrenMap.forEach((children) => children.sort(sortById));

    // Pre-order traversal to flatten the tree with depth
    interface FlatCollectionNode {
      id: string;
      name: string;
      depth: number;
      isDirectlyAssigned: boolean;
    }

    const result: FlatCollectionNode[] = [];
    const traverse = (nodeId: string, depth: number) => {
      const col = colMap.get(nodeId);
      if (!col) return;
      result.push({
        id: nodeId,
        name: col.name,
        depth,
        isDirectlyAssigned: assignedCollectionIdsSet.has(nodeId),
      });
      const children = childrenMap.get(nodeId) || [];
      children.forEach((childId) => traverse(childId, depth + 1));
    };

    roots.forEach((rootId) => traverse(rootId, 1));
    return result;
  }, [assignedCollectionIdsSet, collections, paper.collections]);

  const handleRemoveFromCollection = (targetColId: string) => {
    if (!paper.id) return;
    const remainingIds = Array.from(assignedCollectionIdsSet).filter((id) => id !== targetColId);
    updatePaper(
      paper.id,
      {
        collectionIds: remainingIds,
        collectionId: remainingIds[0] || null,
        expectedVersion: paper.version,
      },
      { expectedVersion: paper.version },
    );
  };

  return (
    <div className="flex flex-col gap-0.5 select-none font-sans">
      {!hideHeader && (
        <div className="flex items-center justify-between pb-1">
          <h3 className="text-12 font-medium text-foreground">
            Libraries and Collections
          </h3>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                if (onCreateCollection) {
                  onCreateCollection();
                } else {
                  openModal('CREATE_COLLECTION');
                }
              }}
              className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
              title="New Collection"
              aria-label="New Collection"
            >
              <Plus className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Primary Library Row (Root) */}
      <div className="flex items-center gap-1.5 h-6.5 px-1.5 text-12 rounded-md hover:bg-muted transition-colors group">
        <div className="size-3.5 shrink-0 flex items-center justify-center">
          <Library className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
        </div>
        <span className="font-medium text-12 text-foreground tracking-tight truncate select-none">
          My Library
        </span>
      </div>

      {/* Deduplicated Collection Tree Rows */}
      {flatNodes.map((node) => {
        const indentPx = 4 + node.depth * 10;
        return (
          <div
            key={node.id}
            style={{ paddingLeft: `${indentPx}px` }}
            className="flex items-center justify-between gap-1.5 h-6.5 pr-1 text-12 rounded-md hover:bg-muted transition-colors group"
          >
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <div className="size-3.5 shrink-0 flex items-center justify-center">
                <Folder className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
              </div>
              <span
                className="text-12 truncate leading-normal text-foreground font-normal select-none"
                title={node.name}
              >
                {node.name}
              </span>
            </div>
            {node.isDirectlyAssigned && canEdit && (
              <button
                type="button"
                onClick={() => handleRemoveFromCollection(node.id)}
                className="invisible group-hover:visible size-5 flex items-center justify-center rounded hover:bg-muted text-foreground cursor-pointer shrink-0 transition-opacity"
                title={`Remove from "${node.name}"`}
                aria-label={`Remove from collection ${node.name}`}
              >
                <X className="size-3 text-foreground shrink-0" strokeWidth={1.5} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
