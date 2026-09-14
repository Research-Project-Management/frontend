import { z } from 'zod';

/**
 * Core Personal Research Workspace Schema
 */
export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Workspace name is required').max(100),
  url: z.string().optional(),
  slug: z.string().optional(),
  avatar: z.string().nullable().optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
}).passthrough();

export const WorkspaceBaseSchema = WorkspaceSchema;

/**
 * API response schema for listing user's workspace
 */
export const WorkspaceListResponseSchema = z.object({
  workspaces: z.array(WorkspaceSchema),
}).passthrough();

/**
 * API response schema for workspace detail
 */
export const WorkspaceDetailResponseSchema = z.object({
  workspace: WorkspaceSchema,
  yourRole: z.literal('owner').or(z.string()).nullable().optional(),
}).passthrough();

/**
 * Search result item schema across workspace entities
 */
export const WorkspaceSearchItemSchema = z.object({
  type: z.enum(['project', 'work_item', 'paper', 'page', 'file', 'folder', 'sticky']),
  id: z.string(),
  name: z.string(),
  identifier: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  projectName: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  size: z.number().nullable().optional(),
  updatedAt: z.string().or(z.date()),
  snippet: z.string().nullable().optional(),
});

