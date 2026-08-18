import { z } from 'zod';
import { WORKSPACE_ROLES, type WorkspaceRole } from '@/features/workspaces/shell/types/iam.types';

export { WORKSPACE_ROLES, type WorkspaceRole };

export const GeneralSettingsSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  url: z.string().optional(),
  avatar: z.string().nullable().optional(),
  teamSize: z.enum(['1', '2-10', '11-50', '51-200', '201-500', '500+']),
});

export const AddMemberBodySchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(WORKSPACE_ROLES),
});

export const UpdateMemberRoleBodySchema = z.object({
  role: z.enum(WORKSPACE_ROLES),
});

export const InviteMemberRowSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const InviteMembersFormSchema = z.object({
  emails: z.array(InviteMemberRowSchema).min(1, 'At least one email is required'),
  role: z.enum(WORKSPACE_ROLES),
});

export const JoinWorkspaceBodySchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const CsvImportRowSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(WORKSPACE_ROLES).optional(),
});
