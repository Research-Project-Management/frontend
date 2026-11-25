import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';

export interface CollectionNode {
  id: string;
  name: string;
  children?: CollectionNode[];
}

interface RawCollection {
  id?: string;
  name: string;
  parentId?: string | null;
  parent?: string | null;
}

export function buildCollectionTree(
  collections?: RawCollection[],
): CollectionNode[] {
  if (!collections || collections.length === 0) return [];

  const map = new Map<string, CollectionNode>();
  const roots: CollectionNode[] = [];

  for (const c of collections) {
    if (!c.id) continue;
    map.set(c.id, { id: c.id, name: c.name, children: [] });
  }

  for (const c of collections) {
    if (!c.id) continue;
    const node = map.get(c.id)!;
    const rawParent = c.parentId || c.parent;
    if (rawParent && rawParent !== c.id && map.has(rawParent)) {
      map.get(rawParent)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function indexCollectionNodes(
  nodes: CollectionNode[],
): Map<string, CollectionNode> {
  const map = new Map<string, CollectionNode>();
  const traverse = (list: CollectionNode[]) => {
    for (const node of list) {
      map.set(node.id, node);
      if (node.children) traverse(node.children);
    }
  };
  traverse(nodes);
  return map;
}

export function entryMatchesCollection(
  entry: BibEntry,
  node: CollectionNode,
): boolean {
  if (entry.collectionId === node.id || entry.collectionIds?.includes(node.id)) {
    return true;
  }
  return Boolean(
    node.children?.some((child) => entryMatchesCollection(entry, child)),
  );
}
