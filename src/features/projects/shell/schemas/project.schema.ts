import { z } from 'zod';

/**
 * Valid Project Roles in Flux:
 * - owner: Principal Investigator / Team Lead (Toàn quyền quản trị dự án & nhân sự)
 * - coordinator: Coordinator / Project Manager (Điều phối viên - quản lý cycles, work items)
 * - contributor: Researcher (Thành viên nghiên cứu - tạo/sửa work items, tài liệu, upload paper)
 * - reviewer: Advisor / Reviewer (GVHD / Hội đồng phản biện - xem, comment & suggestion)
 */
export const ProjectRoleEnum = z.enum(['owner', 'coordinator', 'contributor', 'reviewer']);

export const ProjectStateItemSchema = z.object({
  id: z.string(),
  projectId: z.string().optional(),
  name: z.string(),
  description: z.string().nullable().optional(),
  color: z.string(),
  sequence: z.number().default(0),
  isDefault: z.boolean().default(false),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});
export type ProjectStateItem = z.infer<typeof ProjectStateItemSchema>;

export const ProjectStateEnum = z.string();

export const ProjectPriorityEnum = z.enum([
  'urgent',
  'high',
  'medium',
  'low',
  'none',
]);

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
 * Server-authoritative Granular Project Capabilities
 */
export const ProjectPermissionsSchema = z.object({
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canArchive: z.boolean().default(false),
  canManageMembers: z.boolean().default(false),
  canLeave: z.boolean().default(false),
});

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
  stateId: z.string().nullish().transform((v) => v ?? undefined),
  state: ProjectStateItemSchema.nullish().transform((v) => v ?? undefined),
  priority: ProjectPriorityEnum.default('none').optional(),
  startDate: z.string().nullish().transform((v) => v ?? undefined),
  targetDate: z.string().nullish().transform((v) => v ?? undefined),
  isActive: z.boolean().default(true).optional(),
  isArchived: z.boolean().default(false).optional(),
  isFavorite: z.boolean().default(false).optional(),
  favoritedBy: z.array(z.string()).optional(),
  isPrivate: z.boolean().default(false).optional(),
  timezone: z.string().nullish().transform((v) => v ?? undefined),
  modules: z.array(z.string()).default(['work-items', 'cycles', 'views', 'pages']),
  leadId: z.string().nullish().transform((v) => v ?? undefined),
  lead: ProjectMemberUserSchema.nullish().transform((v) => v ?? undefined),
  createdBy: ProjectMemberUserSchema.nullish().transform((v) => v ?? undefined),
  members: z.array(ProjectMemberSchema).default([]),
  yourRole: ProjectRoleEnum.or(z.string()).nullish().transform((v) => v ?? undefined),
  permissions: ProjectPermissionsSchema.optional(),
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
  stateId: z.string().nullable().optional(),
  priority: ProjectPriorityEnum.optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  isPrivate: z.boolean().default(false).optional(),
  timezone: z.string().optional(),
  modules: z.array(z.string()).optional(),
});

export const createProjectFormSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(100),
  identifier: z
    .string()
    .max(12, 'Identifier cannot exceed 12 characters')
    .regex(/^[A-Z0-9_-]*$/, 'Identifier must be uppercase letters, numbers, hyphens or underscores'),
  description: z.string(),
  avatar: z.string(),
  cover: z.string(),
  stateId: z.string().nullable().optional(),
  priority: ProjectPriorityEnum.default('none'),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export type CreateProjectFormValues = z.infer<typeof createProjectFormSchema>;

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
  stateId: z.string().nullable().optional(),
  priority: ProjectPriorityEnum.optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  modules: z.array(z.string()).optional(),
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
  permissions: ProjectPermissionsSchema.optional(),
}).passthrough();

export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectSchema),
  myProjects: z.array(ProjectSchema).optional(),
  sharedProjects: z.array(ProjectSchema).optional(),
  total: z.number().optional(),
}).passthrough();
