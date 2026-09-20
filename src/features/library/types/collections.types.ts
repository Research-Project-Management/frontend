import { z } from 'zod';
import { userSchema } from './items.types';

export const collectionSchema = z.object({
  id: z.string().optional().default(''),
  name: z.string().optional().default(''),
  description: z.string().optional().default(''),
  color: z.string().optional().default('#3b82f6'),
  icon: z.string().optional().default('📁'),
  scopeId: z.string().optional().default(''),
  projectId: z.string().nullable().optional(),
  userId: z.string().optional(),
  workspaceId: z.string().optional().default(''),
  parentId: z.string().nullable().optional(),
  createdBy: userSchema.optional(),
  itemCount: z.number().optional().default(0),
  paperCount: z.number().optional().default(0),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

// Recursive Tree Node Schema
export type CollectionTreeNode = z.infer<typeof collectionSchema> & {
  children?: CollectionTreeNode[];
};

export const collectionTreeNodeSchema: z.ZodType<CollectionTreeNode> = collectionSchema.extend({
  children: z.lazy(() => z.array(collectionTreeNodeSchema)).optional(),
});

export const createCollectionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  color: z.string().optional().default('#3b82f6'),
  icon: z.string().optional().default('📁'),
  parentId: z.string().nullable().optional(),
});

export const updateCollectionSchema = createCollectionSchema.partial();

export const moveCollectionItemsSchema = z.object({
  itemIds: z.array(z.string()),
  paperIds: z.array(z.string()).optional(),
});

export const reorderCollectionsSchema = z.object({
  collections: z.array(
    z.object({
      id: z.string(),
      parentId: z.string().nullable().optional(),
    }),
  ),
});

export type Collection = z.infer<typeof collectionSchema>;

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
