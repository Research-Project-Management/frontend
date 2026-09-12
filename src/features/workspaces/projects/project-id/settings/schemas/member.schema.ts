import { z } from 'zod';
import { ProjectRoleEnum } from '@/features/workspaces/projects/shell/schemas/project.schema';

/**
 * Minimal User representation for Member UI
 */
export const MemberUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullish().transform((v) => v ?? undefined),
  avatar: z.string().nullish().transform((v) => v ?? undefined),
});

/**
 * Project Member Item Schema
 */
export const ProjectMemberItemSchema = z.object({
  id: z.string().optional(),
  userId: z.string(),
  role: ProjectRoleEnum.or(z.string()),
  joinedAt: z.string().or(z.date()).transform((v) => (typeof v === 'string' ? v : v.toISOString())),
  user: MemberUserSchema,
});

/**
 * Payload Schema for Adding Member to Project
 */
export const AddMemberInputSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: ProjectRoleEnum.default('contributor').optional(),
});

/**
 * Payload Schema for Bulk Adding Members
 */
export const BulkAddMembersInputSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user must be selected'),
  role: ProjectRoleEnum.default('contributor').optional(),
});

/**
 * Payload Schema for Updating Member Role
 */
export const UpdateMemberRoleInputSchema = z.object({
  role: ProjectRoleEnum,
});

/**
 * Project Settings State Schema (lead, assignee, subscribers)
 */
export const ProjectSettingsStateSchema = z.object({
  leadId: z.string().nullable().optional(),
  defaultAssigneeId: z.string().nullable().optional(),
  subscriberIds: z.array(z.string()).optional(),
});
