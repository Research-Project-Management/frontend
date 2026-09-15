import { z } from 'zod';
import {
  collectionSchema,
  collectionTreeNodeSchema,
  createCollectionSchema,
  updateCollectionSchema,
  moveCollectionItemsSchema,
  reorderCollectionsSchema,
  CollectionTreeNode,
} from '../schemas/collection.schema';

export type Collection = z.infer<typeof collectionSchema>;
export type { CollectionTreeNode };

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;
export type MoveCollectionItemsInput = z.infer<typeof moveCollectionItemsSchema>;
export type ReorderCollectionsInput = z.infer<typeof reorderCollectionsSchema>;

export interface CollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parent?: string | null;
  parentId?: string | null;
}

export type CreateCollectionDTO = CollectionInput;
export type UpdateCollectionDTO = Partial<CollectionInput>;
