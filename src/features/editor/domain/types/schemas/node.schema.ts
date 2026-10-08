/**
 * node.schema.ts
 *
 * Zod validation schemas for Document Structural Nodes and tree operations.
 * Matches backend document/tree module DTOs.
 */

import { z } from 'zod';

export const moveNodeSchema = z.object({
  targetParentId: z.string().uuid().nullable().optional(),
  rank: z.number().int().default(0).optional(),
});

export type MoveNodeInput = z.infer<typeof moveNodeSchema>;

export const createChildNodeSchema = z.object({
  title: z.string().min(1, 'Node title is required'),
  parentPageId: z.string().uuid().optional(),
  content: z.any().optional(),
  rank: z.number().int().optional(),
  icon: z.string().optional(),
  isFolder: z.boolean().default(false).optional(),
});

export type CreateChildNodeInput = z.infer<typeof createChildNodeSchema>;

export const setMainNodeSchema = z.object({
  mainFileId: z.string().uuid('Main file ID must be a valid UUID'),
});

export type SetMainNodeInput = z.infer<typeof setMainNodeSchema>;
