import { z } from 'zod';

/**
 * Valid research collaboration group scales
 */
export const ResearchScaleEnum = z.enum([
  '1',
  '2-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
]);

/**
 * Core Personal Research Workspace Schema
 */
export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Workspace name is required').max(100),
  url: z.string(),
  slug: z.string().optional(),
  avatar: z.string().nullable().optional(),
  companySize: ResearchScaleEnum.or(z.string()).optional(),
  plan: z.string().default('free').optional(),
  ownerId: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
}).passthrough();

export const WorkspaceBaseSchema = WorkspaceSchema;

/**
 * Payload schema for creating a personal workspace
 */
export const CreateWorkspaceBodySchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
  url: z
    .string()
    .min(1, 'URL slug is required')
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens')
    .optional(),
  slug: z.string().optional(),
  avatar: z.string().nullable().optional(),
  companySize: ResearchScaleEnum.or(z.string()).optional(),
  size: z.string().optional(),
  plan: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Payload schema for updating personal workspace settings
 */
export const WorkspacePatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().optional(),
  slug: z.string().optional(),
  avatar: z.string().nullable().optional(),
  companySize: ResearchScaleEnum.or(z.string()).optional(),
  timezone: z.string().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

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
 * API response schema for deleting a workspace
 */
export const DeleteWorkspaceResultSchema = z.object({
  workspaceId: z.string(),
  alreadyDeleted: z.boolean(),
});

/**
 * Search result item schema across workspace entities
 */
export const WorkspaceSearchItemSchema = z.object({
  type: z.enum(['project', 'task', 'paper', 'page', 'file', 'folder', 'sticky']),
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

