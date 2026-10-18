/**
 * Pure Hierarchical Collection Tree Utilities (Zotero 7 Collections & Subcollections)
 */

import type { Collection } from './types/library.types';

export interface CollectionHierarchyNode extends Collection {
  children: CollectionHierarchyNode[];
}

function hasAncestorCycle(
  startId: string,
  targetParentId: string,
  map: Map<string, CollectionHierarchyNode>,
): boolean {
  let curr: string | null | undefined = targetParentId;
  const visited = new Set<string>();
  while (curr) {
    if (curr === startId) return true;
    if (visited.has(curr)) return true;
    visited.add(curr);
    curr = map.get(curr)?.parentId;
  }
  return false;
}

/**
 * Builds a cycle-safe hierarchical tree from flat collection records (`id`, `parentId`, `name`).
 */
export function buildCollectionTree(collections: Collection[]): CollectionHierarchyNode[] {
  const map = new Map<string, CollectionHierarchyNode>();
  const roots: CollectionHierarchyNode[] = [];

  for (const c of collections) {
    if (!c.id) continue;
    map.set(c.id, { ...c, children: [] });
  }

  for (const node of map.values()) {
    const parentId = node.parentId;
    if (
      parentId &&
      parentId !== node.id &&
      map.has(parentId) &&
      !hasAncestorCycle(node.id, parentId, map)
    ) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Returns `[rootId, ...allDescendantIds]` for recursive subcollection filtering (`includeSubcollections`),
 * safely handling corrupted cyclic `parentId` references without infinite loops.
 */
export function getDescendantCollectionIds(
  collections: ReadonlyArray<Pick<Collection, 'id' | 'parentId'>>,
  rootId: string,
): string[] {
  if (!rootId) return [];

  const childrenMap = new Map<string, string[]>();
  for (const c of collections) {
    if (!c.id || !c.parentId || c.parentId === c.id) continue;
    const list = childrenMap.get(c.parentId) || [];
    list.push(c.id);
    childrenMap.set(c.parentId, list);
  }

  const visited = new Set<string>();
  const result: string[] = [];
  const queue: string[] = [rootId];
  let head = 0;

  while (head < queue.length) {
    const curr = queue[head++]!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    result.push(curr);

    const children = childrenMap.get(curr);
    if (children) {
      for (const childId of children) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  return result;
}

/**
 * Returns the ordered ancestor path `[Root, Child, ..., Target]` for Inspector/Topbar breadcrumbs.
 * Safely terminates if a corrupted parent cycle is encountered.
 */
export function getCollectionBreadcrumbPath<T extends Pick<Collection, 'id' | 'name' | 'parentId'>>(
  collections: ReadonlyArray<T>,
  targetId: string,
): T[] {
  if (!targetId) return [];
  const byId = new Map<string, T>();
  for (const c of collections) {
    if (c.id) byId.set(c.id, c);
  }

  const path: T[] = [];
  const visited = new Set<string>();
  let currId: string | null | undefined = targetId;

  while (currId && !visited.has(currId)) {
    visited.add(currId);
    const node = byId.get(currId);
    if (!node) break;
    path.push(node);
    currId = node.parentId;
  }

  return path.reverse();
}

/**
 * Returns `false` when moving a collection onto itself or any of its own descendants
 * (or if `sourceId` does not exist). Moving to `null` (root level) is allowed.
 */
export function canMoveCollection(
  collections: ReadonlyArray<Pick<Collection, 'id' | 'parentId'>>,
  sourceId: string,
  targetParentId: string | null | undefined,
): boolean {
  if (!sourceId) return false;
  if (!targetParentId) return true;
  if (sourceId === targetParentId) return false;

  const parentMap = new Map<string, string | null | undefined>();
  for (const c of collections) {
    if (c.id) parentMap.set(c.id, c.parentId);
  }
  if (!parentMap.has(targetParentId)) return false;

  // Walk ancestors from targetParentId up to root: if we reach sourceId or a cycle, move is invalid
  let curr: string | null | undefined = targetParentId;
  const visited = new Set<string>();
  while (curr) {
    if (curr === sourceId) return false;
    if (visited.has(curr)) return false;
    visited.add(curr);
    curr = parentMap.get(curr);
  }

  return true;
}

export { buildCollectionTree as buildTree };

/**
 * Returns collections that are valid targets for moving/copying
 * by filtering out the target node itself and all its descendant subcollections.
 * Strict O(N) complexity using adjacency list graph traversal.
 */
export function getValidMoveTargets(allCollections: Collection[], currentId: string): Collection[] {
  const descendantIds = new Set(getDescendantCollectionIds(allCollections, currentId));
  return allCollections.filter((c) => !descendantIds.has(c.id));
}

/**
 * Filters a collection list by search keyword, preserving the chain of parent collections.
 * Strict O(N) complexity using hash map parent lookup and cycle guard.
 */
export function filterCollections(cols: Collection[], searchQuery: string): Collection[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return cols;

  const parentMap = new Map<string, string | null>();
  for (const c of cols) {
    parentMap.set(c.id, c.parentId || null);
  }

  const matchingIds = new Set<string>();
  for (const c of cols) {
    if (c.name.toLowerCase().includes(q)) {
      let currId: string | null | undefined = c.id;
      const visitedInPath = new Set<string>();
      while (currId && !visitedInPath.has(currId)) {
        visitedInPath.add(currId);
        matchingIds.add(currId);
        currId = parentMap.get(currId);
      }
    }
  }

  return cols.filter((c) => matchingIds.has(c.id));
}
