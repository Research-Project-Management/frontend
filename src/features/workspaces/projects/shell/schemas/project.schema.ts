import { z } from 'zod';

/**
 * Valid Project Roles in Flux:
 * - owner: Principal Investigator / Team Lead (Full admin permissions)
 * - contributor: Researcher (Create/edit/delete tasks, pages, files)
 * - commenter: Reviewer (Can view and comment)
 * - viewer: Read-only guest/visitor
 */
export const ProjectRoleEnum = z.enum(['owner', 'contributor', 'commenter', 'viewer']);

/**
 * Minimal User Representation inside Project Members & Lead
 */
export const ProjectMemberUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullish().transform((v) => v ?? undefined),
  avatar: z.string().nullish().transform((v) => v ?? undefined),
});

/**
 * Project Member Schema
 */
export const ProjectMemberSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  role: ProjectRoleEnum.or(z.string()),
  joinedAt: z.string().or(z.date()).transform((v) => (typeof v === 'string' ? v : v.toISOString())),
  user: ProjectMemberUserSchema.optional(),
});

/**
 * Project Settings Schema
 */
export const ProjectSettingsSchema = z.object({
  leadId: z.string().nullish().transform((v) => v ?? undefined),
  defaultAssigneeId: z.string().nullish().transform((v) => v ?? undefined),
  subscriberIds: z.array(z.string()).optional(),
  parallelCycles: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
}).passthrough();

/**
 * Core Project Schema
 */
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().nullish().transform((v) => v ?? '').default(''),
  identifier: z.string().nullish().transform((v) => v ?? undefined),
  key: z.string().nullish().transform((v) => v ?? undefined),
  avatar: z.string().nullish().transform((v) => v ?? undefined),
  coverImage: z.string().nullish().transform((v) => v ?? undefined),
  cover: z.string().nullish().transform((v) => v ?? undefined),
  isActive: z.boolean().default(true).optional(),
  isArchived: z.boolean().default(false).optional(),
  isFavorite: z.boolean().default(false).optional(),
  favoritedBy: z.array(z.string()).optional(),
  isPrivate: z.boolean().default(false).optional(),
  timezone: z.string().nullish().transform((v) => v ?? undefined),
  modules: z.array(z.string()).default(['overview', 'tasks', 'pages', 'stickies', 'storage']),
  workspaceId: z.string().optional(),
  leadId: z.string().nullish().transform((v) => v ?? undefined),
  lead: ProjectMemberUserSchema.nullish().transform((v) => v ?? undefined),
  createdBy: ProjectMemberUserSchema.nullish().transform((v) => v ?? undefined),
  members: z.array(ProjectMemberSchema).default([]),
  settings: ProjectSettingsSchema.nullish().transform((v) => v ?? undefined),
  createdAt: z.string().or(z.date()).transform((v) => (typeof v === 'string' ? v : v.toISOString())),
  updatedAt: z.string().or(z.date()).transform((v) => (typeof v === 'string' ? v : v.toISOString())),
}).passthrough();

/**
 * Payload Schema for Creating a Project
 */
export const CreateProjectInputSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  identifier: z
    .string()
    .max(12, 'Identifier cannot exceed 12 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Identifier must be uppercase letters, numbers, hyphens or underscores')
    .optional(),
  description: z.string().optional(),
  avatar: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  cover: z.string().nullable().optional(),
  isPrivate: z.boolean().default(false).optional(),
  timezone: z.string().optional(),
  modules: z.array(z.string()).optional(),
  leadId: z.string().optional(),
  workspaceId: z.string().optional(),
});

/**
 * Payload Schema for Updating a Project
 */
export const UpdateProjectInputSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  identifier: z.string().max(12).optional(),
  description: z.string().optional(),
  avatar: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(),
  cover: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  modules: z.array(z.string()).optional(),
  leadId: z.string().nullable().optional(),
  defaultAssigneeId: z.string().nullable().optional(),
  subscriberIds: z.array(z.string()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Response Schemas
 */
export const ProjectDetailResponseSchema = z.object({
  project: ProjectSchema,
  yourRole: ProjectRoleEnum.or(z.string()).nullable().optional(),
}).passthrough();

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectSchema),
}).passthrough();
