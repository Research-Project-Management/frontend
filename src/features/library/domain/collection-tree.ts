/**
 * Pure Hierarchical Collection Tree Utilities (Hierarchical Collections & Subcollections)
 * Implements GoF Composite Pattern (`CollectionTreeComposite`) so single leaf collections
 * and nested folder hierarchies can be queried and traversed uniformly.
 */

import type { Collection } from './types/library.types';

export interface CollectionHierarchyNode extends Collection {
  children: CollectionHierarchyNode[];
}

export type CollectionNode = CollectionHierarchyNode;

/**
 * GoF Composite Pattern Contract for Collection Hierarchies.
 * Allows leaf collections and nested composite folders to be queried uniformly.
 */
export interface CollectionTreeComponent {
  readonly id: string;
  readonly name: string;
  readonly parentId?: string | null;
  readonly node: CollectionHierarchyNode;
  isLeaf(): boolean;
  collectSubtreeIds(): string[];
  getSubtreeTotalItemCount(): number;
  findNode(targetId: string): CollectionHierarchyNode | null;
  containsDescendant(targetId: string): boolean;
}

/**
 * Recursively collects `[node.id, ...allDescendantIds]` for a `CollectionHierarchyNode` subtree.
 */
export function collectSubtreeIds(node: CollectionHierarchyNode | null | undefined): string[] {
  if (!node || !node.id) return [];
  const result: string[] = [];
  const visited = new Set<string>();
  const stack: CollectionHierarchyNode[] = [node];

  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (!curr.id || visited.has(curr.id)) continue;
    visited.add(curr.id);
    result.push(curr.id);

    for (let i = curr.children.length - 1; i >= 0; i--) {
      const child = curr.children[i];
      if (child && !visited.has(child.id)) {
        stack.push(child);
      }
    }
  }

  return result;
}

/**
 * Recursively computes the total item count across `node` and all of its descendant subcollections.
 * Prefers `node.recursiveItemCount` when explicitly populated by the server and no child nodes override it,
 * otherwise sums `itemCount` across the entire composite subtree.
 */
export function getSubtreeTotalItemCount(node: CollectionHierarchyNode | null | undefined): number {
  if (!node) return 0;
  if (node.children.length === 0) {
    return typeof node.recursiveItemCount === 'number'
      ? node.recursiveItemCount
      : (node.itemCount ?? 0);
  }

  let total = 0;
  const visited = new Set<string>();
  const stack: CollectionHierarchyNode[] = [node];

  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (!curr.id || visited.has(curr.id)) continue;
    visited.add(curr.id);
    total += curr.itemCount ?? 0;

    for (const child of curr.children) {
      if (child && !visited.has(child.id)) {
        stack.push(child);
      }
    }
  }

  return typeof node.recursiveItemCount === 'number'
    ? Math.max(node.recursiveItemCount, total)
    : total;
}

/**
 * Uniformly searches a forest of `CollectionHierarchyNode` roots (or flat collections) for `id`.
 */
export function findCollectionNode(
  rootsOrCollections: ReadonlyArray<CollectionHierarchyNode | Collection>,
  id: string | null | undefined,
): CollectionHierarchyNode | null {
  if (!id || rootsOrCollections.length === 0) return null;

  const hasPrebuiltChildren =
    'children' in rootsOrCollections[0]! &&
    Array.isArray((rootsOrCollections[0] as CollectionHierarchyNode).children);

  const roots: ReadonlyArray<CollectionHierarchyNode> = hasPrebuiltChildren
    ? (rootsOrCollections as ReadonlyArray<CollectionHierarchyNode>)
    : buildCollectionTree(rootsOrCollections as Collection[]);

  const visited = new Set<string>();
  const stack: CollectionHierarchyNode[] = [...roots];

  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (!curr.id || visited.has(curr.id)) continue;
    if (curr.id === id) return curr;
    visited.add(curr.id);

    for (let i = curr.children.length - 1; i >= 0; i--) {
      const child = curr.children[i];
      if (child && !visited.has(child.id)) {
        stack.push(child);
      }
    }
  }

  return null;
}

/**
 * Checks whether `candidateDescendantId` is inside the subtree of `targetAncestorId`
 * (or equal to `targetAncestorId`), preventing circular drag-and-drop moves.
 */
export function isDescendantOf(
  rootsOrCollections: ReadonlyArray<CollectionHierarchyNode | Pick<Collection, 'id' | 'parentId'>>,
  candidateDescendantId: string | null | undefined,
  targetAncestorId: string | null | undefined,
): boolean {
  if (!candidateDescendantId || !targetAncestorId) return false;
  if (candidateDescendantId === targetAncestorId) return true;
  if (rootsOrCollections.length === 0) return false;

  const first = rootsOrCollections[0]!;
  if ('children' in first && Array.isArray((first as CollectionHierarchyNode).children)) {
    const ancestorNode = findCollectionNode(
      rootsOrCollections as ReadonlyArray<CollectionHierarchyNode>,
      targetAncestorId,
    );
    if (!ancestorNode) return false;
    return collectSubtreeIds(ancestorNode).includes(candidateDescendantId);
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
 * Concrete GoF Composite wrapper around a `CollectionHierarchyNode` or forest of nodes.
 */
export class CollectionTreeComposite implements CollectionTreeComponent {
  readonly node: CollectionHierarchyNode;

  constructor(node: CollectionHierarchyNode) {
    this.node = node;
  }

  static fromCollection(collection: Collection): CollectionTreeComposite {
    return new CollectionTreeComposite({
      ...collection,
      children: [],
    });
  }

  static fromFlatList(collections: Collection[]): CollectionTreeComposite[] {
    return buildCollectionTree(collections).map((root) => new CollectionTreeComposite(root));
  }

  get id(): string {
    return this.node.id;
  }

  get name(): string {
    return this.node.name;
  }

  get parentId(): string | null | undefined {
    return this.node.parentId;
  }

  isLeaf(): boolean {
    return this.node.children.length === 0;
  }

  collectSubtreeIds(): string[] {
    return collectSubtreeIds(this.node);
  }

  getSubtreeTotalItemCount(): number {
    return getSubtreeTotalItemCount(this.node);
  }

  findNode(targetId: string): CollectionHierarchyNode | null {
    return findCollectionNode([this.node], targetId);
  }

  containsDescendant(targetId: string): boolean {
    return isDescendantOf([this.node], targetId, this.node.id);
  }
}

/**
 * Builds a cycle-safe hierarchical tree from flat collection records (`id`, `parentId`, `name`).
 * Uses 3-color DFS state memoization (0 = unvisited, 1 = visiting, 2 = safe/acyclic)
 * so ancestor cycle verification across the entire forest runs in strict O(N) time instead of O(N * D).
 */
export function buildCollectionTree(collections: Collection[]): CollectionHierarchyNode[] {
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
