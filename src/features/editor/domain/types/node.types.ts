/**
 * node.types.ts
 *
 * Types for hierarchical document tree nodes, ordering, and structural nesting.
 * Matches backend document/tree module.
 */

export interface NodeTreeItem {
  id: string;
  title: string;
  slug?: string | null;
  icon?: string | null;
  rank: number;
  status: string;
  isLocked: boolean;
  parentPageId: string | null;
  mainFileId: string | null;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  children?: NodeTreeItem[];
}

// Derived directly from Zod schemas (Single Source of Truth)
export type {
  MoveNodeInput,
  CreateChildNodeInput,
  SetMainNodeInput,
} from './schemas/node.schema';
