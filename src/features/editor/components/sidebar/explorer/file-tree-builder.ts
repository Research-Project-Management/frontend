import { type UnifiedTreeNode } from "./file-tree.types";

/**
 * Builds a hierarchical tree from a list of project pages.
 */
export function buildPageTree(
  pages: Array<{ id: string; title: string; isFolder?: boolean; parentId?: string | null; isMain?: boolean }>,
  mainFileId?: string | null
): UnifiedTreeNode[] {
  const nodeMap = new Map<string, UnifiedTreeNode>();
  const rootNodes: UnifiedTreeNode[] = [];

  // Pass 1: Initialize nodes
  for (const page of pages) {
    const isMain = page.isMain || page.id === mainFileId;
    nodeMap.set(page.id, {
      id: page.id,
      name: page.title,
      isFolder: Boolean(page.isFolder),
      itemType: "page",
      isMain,
      data: page,
      children: [],
      rawPage: page,
    });
  }

  // Pass 2: Connect parent-child or path hierarchy
  for (const page of pages) {
    const node = nodeMap.get(page.id)!;
    if (page.parentId && nodeMap.has(page.parentId)) {
      nodeMap.get(page.parentId)!.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  // Sort folders first, then alphabetically
  const sortNodes = (nodes: UnifiedTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => {
      if (n.children.length > 0) sortNodes(n.children);
    });
  };

  sortNodes(rootNodes);
  return rootNodes;
}

/**
 * Builds a hierarchical tree from S3 Storage Assets based on their path keys.
 */
export function buildAssetTree(
  assets: Array<{ key?: string; name: string; url?: string; size?: number; mimeType?: string }>
): UnifiedTreeNode[] {
  const root: UnifiedTreeNode[] = [];

  for (const asset of assets) {
    const fullPath = asset.key || asset.name;
    const parts = fullPath.split("/").filter(Boolean);

    let currentLevel = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (isLast) {
        currentLevel.push({
          id: fullPath,
          name: part,
          isFolder: false,
          itemType: "asset",
          data: asset,
          path: fullPath,
          children: [],
        });
      } else {
        let folderNode = currentLevel.find((n) => n.isFolder && n.name === part);
        if (!folderNode) {
          folderNode = {
            id: `folder:${parts.slice(0, i + 1).join("/")}`,
            name: part,
            isFolder: true,
            itemType: "asset",
            children: [],
          };
          currentLevel.push(folderNode);
        }
        currentLevel = folderNode.children;
      }
    }
  }

  return root;
}

/**
 * Recursively filters tree nodes matching a search query.
 */
export function filterTree(nodes: UnifiedTreeNode[], query: string): UnifiedTreeNode[] {
  if (!query.trim()) return nodes;
  const q = query.toLowerCase();

  const filterNode = (node: UnifiedTreeNode): UnifiedTreeNode | null => {
    const nameMatches = node.name.toLowerCase().includes(q);
    const filteredChildren = node.children
      .map(filterNode)
      .filter((c): c is UnifiedTreeNode => c !== null);

    if (nameMatches || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }
    return null;
  };

  return nodes.map(filterNode).filter((n): n is UnifiedTreeNode => n !== null);
}
