/**
 * Pure Hierarchical Collection Tree Utilities (Zotero 7 Collections & Subcollections)
 * 100% Pure TypeScript - O(N) graph traversal with cycle guards against corrupted parentId chains.
 */

import type { Collection } from '../types/library.types';

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

  const descendants = getDescendantCollectionIds(collections, sourceId);
  if (descendants.includes(targetParentId)) {
    return false;
  }

  // Also ensure targetParentId itself is not part of a cycle leading back to sourceId
  const parentMap = new Map<string, string | null | undefined>();
  for (const c of collections) {
    if (c.id) parentMap.set(c.id, c.parentId);
  }
  if (!parentMap.has(targetParentId)) return false;

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
