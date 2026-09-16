import type { Collection } from '@/features/library/types/library.types';
import type { TreeNode } from '../types';

/**
 * Transforms a flat array of collections into a nested tree structure.
 */
export function buildTree(collections: Collection[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of collections) {
    if (!c.id) continue;
    map.set(c.id, { ...c, children: [] });
  }

  for (const node of map.values()) {
    const parentId = node.parentId || node.parent;
    if (parentId && map.has(parentId)) {
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
 */
export function getValidMoveTargets(allCollections: Collection[], currentId: string): Collection[] {
  const descendantIds = new Set<string>([currentId]);
  let added = true;
  while (added) {
    added = false;
    for (const c of allCollections) {
      const parentId = c.parentId || c.parent;
      if (parentId && descendantIds.has(parentId) && !descendantIds.has(c.id)) {
        descendantIds.add(c.id);
        added = true;
      }
    }
  }
  return allCollections.filter((c) => !descendantIds.has(c.id));
}

/**
 * Filters a collection list by search keyword, preserving the chain of parent collections.
 */
export function filterCollections(cols: Collection[], searchQuery: string): Collection[] {
  const q = searchQuery.trim().toLowerCase();
  if (!q) return cols;

  const matchingIds = new Set<string>();
  for (const c of cols) {
    if (c.name.toLowerCase().includes(q)) {
      matchingIds.add(c.id);
      let curr = c;
      let currParentId = curr.parentId || curr.parent;
      while (currParentId) {
        matchingIds.add(currParentId);
        const parentObj = cols.find((p) => p.id === currParentId);
        if (!parentObj) break;
        curr = parentObj;
        currParentId = curr.parentId || curr.parent;
      }
    }
  }
  return cols.filter((c) => matchingIds.has(c.id));
}
