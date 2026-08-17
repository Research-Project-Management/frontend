import { z } from 'zod';
import {
  GeneralSettingsSchema,
  AddMemberBodySchema,
  UpdateMemberRoleBodySchema,
  InviteMembersFormSchema,
  InviteMemberRowSchema,
  JoinWorkspaceBodySchema,
  CsvImportRowSchema,
  WORKSPACE_ROLES,
  type WorkspaceRole,
} from '../schemas/settings.schema';

export { WORKSPACE_ROLES, type WorkspaceRole };

export type GeneralSettingsFormValues = z.infer<typeof GeneralSettingsSchema>;
export type AddMemberBody = z.infer<typeof AddMemberBodySchema>;
export type UpdateMemberRoleBody = z.infer<typeof UpdateMemberRoleBodySchema>;
export type InviteMembersFormValues = z.infer<typeof InviteMembersFormSchema>;
export type InviteMemberRow = z.infer<typeof InviteMemberRowSchema>;
export type JoinWorkspaceBody = z.infer<typeof JoinWorkspaceBodySchema>;
export type CsvImportRow = z.infer<typeof CsvImportRowSchema>;
