/**
 * Pure Hierarchical Collection Tree Utilities (Hierarchical Collections & Subcollections)
 */

import type { Collection } from './types/core.types';

interface CollectionHierarchyNode extends Collection {
  children: CollectionHierarchyNode[];
}

export type CollectionNode = CollectionHierarchyNode;
export type TreeNode = CollectionHierarchyNode;

/**
 * Checks whether `candidateDescendantId` is inside the subtree of `targetAncestorId`
 * (or equal to `targetAncestorId`), preventing circular drag-and-drop moves.
 */
function isDescendantOf(
  rootsOrCollections: ReadonlyArray<CollectionHierarchyNode | Pick<Collection, 'id' | 'parentId'>>,
  candidateDescendantId: string | null | undefined,
  targetAncestorId: string | null | undefined,
): boolean {
  if (!candidateDescendantId || !targetAncestorId) return false;
  if (candidateDescendantId === targetAncestorId) return true;
  if (rootsOrCollections.length === 0) return false;

  const first = rootsOrCollections[0]!;
  if ('children' in first && Array.isArray((first as CollectionHierarchyNode).children)) {
    const stack: CollectionHierarchyNode[] = [...(rootsOrCollections as ReadonlyArray<CollectionHierarchyNode>)];
    const visited = new Set<string>();
    let ancestorNode: CollectionHierarchyNode | null = null;
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (!curr.id || visited.has(curr.id)) continue;
      if (curr.id === targetAncestorId) {
        ancestorNode = curr;
        break;
      }
      visited.add(curr.id);
      for (let i = curr.children.length - 1; i >= 0; i--) {
        const child = curr.children[i];
        if (child && !visited.has(child.id)) stack.push(child);
      }
    }
    if (!ancestorNode) return false;

    const subStack: CollectionHierarchyNode[] = [ancestorNode];
    const subVisited = new Set<string>();
    while (subStack.length > 0) {
      const curr = subStack.pop()!;
      if (!curr.id || subVisited.has(curr.id)) continue;
      if (curr.id === candidateDescendantId) return true;
      subVisited.add(curr.id);
      for (const child of curr.children) {
        if (child && !subVisited.has(child.id)) subStack.push(child);
      }
    }
    return false;
  }

  const parentMap = new Map<string, string | null | undefined>();
  for (const c of rootsOrCollections) {
    if (c.id) parentMap.set(c.id, c.parentId);
  }

  let curr: string | null | undefined = candidateDescendantId;
  const visited = new Set<string>();
  while (curr) {
    if (curr === targetAncestorId) return true;
    if (visited.has(curr)) return false;
    visited.add(curr);
    curr = parentMap.get(curr);
  }

  return false;
}

/**
 * Builds a cycle-safe hierarchical tree from flat collection records (`id`, `parentId`, `name`).
 * Uses 3-color DFS state memoization (0 = unvisited, 1 = visiting, 2 = safe/acyclic)
 * so ancestor cycle verification across the entire forest runs in strict O(N) time instead of O(N * D).
 */
function buildCollectionTree(collections: Collection[]): CollectionHierarchyNode[] {
  const map = new Map<string, CollectionHierarchyNode>();
  const roots: CollectionHierarchyNode[] = [];

  for (const c of collections) {
    if (!c.id) continue;
    map.set(c.id, { ...c, children: [] });
  }

  // 0 = unvisited, 1 = visiting (in current chain), 2 = verified acyclic, 3 = part of cycle
  const state = new Map<string, number>();

  const isPartOfCycle = (startId: string): boolean => {
    const existing = state.get(startId);
    if (existing === 2) return false;
    if (existing === 3) return true;

    const path: string[] = [];
    let curr: string | null | undefined = startId;

    while (curr && map.has(curr)) {
      const st = state.get(curr) ?? 0;
      if (st === 2) {
        for (let i = 0; i < path.length; i++) state.set(path[i], 2);
        return false;
      }
      if (st === 1 || st === 3) {
        for (let i = 0; i < path.length; i++) state.set(path[i], 3);
        return true;
      }
      state.set(curr, 1);
      path.push(curr);
      const nextParent: string | null | undefined = map.get(curr)?.parentId;
      if (nextParent === curr) {
        for (let i = 0; i < path.length; i++) state.set(path[i], 3);
        return true;
      }
      curr = nextParent;
    }

    for (let i = 0; i < path.length; i++) state.set(path[i], 2);
    return false;
  };

  for (const node of map.values()) {
    const parentId = node.parentId;
    if (
      parentId &&
      parentId !== node.id &&
      map.has(parentId) &&
      !isPartOfCycle(node.id)
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
  collections: ReadonlyArray<T> | ReadonlyMap<string, T>,
  targetId: string,
): T[] {
  if (!targetId) return [];
  const byId =
    collections instanceof Map
      ? collections
      : (() => {
          const map = new Map<string, T>();
          for (const c of collections as ReadonlyArray<T>) {
            if (c.id) map.set(c.id, c);
          }
          return map;
        })();

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
 * Computes ancestor breadcrumb path string for a collection (excluding the target node itself, e.g. `Parent / Subfolder`).
 */
export function getCollectionAncestorPath<T extends Pick<Collection, 'id' | 'name' | 'parentId'>>(
  collectionId: string,
  colMap: ReadonlyMap<string, T>,
  memo?: Map<string, string>,
): string {
  const cached = memo?.get(collectionId);
  if (cached !== undefined) return cached;

  const fullPath = getCollectionBreadcrumbPath(colMap, collectionId);
  const resolved = fullPath
    .slice(0, -1)
    .map((c) => c.name)
    .filter(Boolean)
    .join(' / ');
  memo?.set(collectionId, resolved);
  return resolved;
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

  const hasTarget = collections.some((c) => c.id === targetParentId);
  if (!hasTarget) return false;

  return !isDescendantOf(collections, targetParentId, sourceId);
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
      while (currId && !matchingIds.has(currId) && !visitedInPath.has(currId)) {
        visitedInPath.add(currId);
        matchingIds.add(currId);
        currId = parentMap.get(currId);
      }
    }
  }

  return cols.filter((c) => matchingIds.has(c.id));
}
