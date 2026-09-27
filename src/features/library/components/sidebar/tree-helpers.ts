import type { Collection } from '../../types/library.types';
import type { TreeNode } from './sidebar.types';

/**
 * Helper to detect if assigning targetParentId under startId would form a circular tree cycle.
 */
function hasAncestorCycle(
  startId: string,
  targetParentId: string,
  map: Map<string, TreeNode>,
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
 * Transforms a flat array of collections into a nested tree structure.
 * Guaranteed O(N) complexity with cycle prevention guard against stack overflows.
 */
export function buildTree(collections: Collection[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

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
 * Returns collections that are valid targets for moving/copying
 * by filtering out the target node itself and all its descendant subcollections.
 * Strict O(N) complexity using adjacency list graph traversal.
 */
export function getValidMoveTargets(allCollections: Collection[], currentId: string): Collection[] {
  const childrenMap = new Map<string, string[]>();
  for (const c of allCollections) {
    const parentId = c.parentId;
    if (parentId) {
      const list = childrenMap.get(parentId) || [];
      list.push(c.id);
      childrenMap.set(parentId, list);
    }
  }

  const descendantIds = new Set<string>();
  const queue: string[] = [currentId];
  while (queue.length > 0) {
    const curr = queue.pop()!;
    if (!descendantIds.has(curr)) {
      descendantIds.add(curr);
      const children = childrenMap.get(curr);
      if (children) {
        for (const childId of children) {
          if (!descendantIds.has(childId)) {
            queue.push(childId);
          }
        }
      }
    }
  }

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
