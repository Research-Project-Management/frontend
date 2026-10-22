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
  parentId: z.string().nullable().optional(),
  createdBy: userSchema.optional(),
  itemCount: z.number().optional().default(0),
  recursiveItemCount: z.number().optional(),
  version: z.number().optional().default(1),
  createdAt: z.string().optional().default(''),
  updatedAt: z.string().optional().default(''),
});

export type Collection = z.infer<typeof collectionSchema>;

export interface CollectionInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
  expectedVersion?: number;
  version?: number;
}

export type CreateCollectionDTO = CollectionInput;
export type UpdateCollectionDTO = Partial<CollectionInput> & {
  expectedVersion?: number;
  version?: number;
};

export interface MoveToTrashTarget {
  id?: string;
  ids?: string[];
  title?: string;
  type?: 'item' | 'items' | 'collection';
  withItems?: boolean;
  scopeId?: string;
  count?: number;
  items?: Array<{ id: string; title: string }>;
}
