import { z } from 'zod';
import type { ProjectRole } from '@/features/workspaces/projects/shell/types/project.types';
import {
  MemberUserSchema,
  ProjectMemberItemSchema,
  AddMemberInputSchema,
  BulkAddMembersInputSchema,
  UpdateMemberRoleInputSchema,
  ProjectSettingsStateSchema,
} from '../schemas/member.schema';

export type { ProjectRole };

export type MemberUser = z.infer<typeof MemberUserSchema>;
export type ProjectMemberItem = z.infer<typeof ProjectMemberItemSchema>;
export type AddMemberInput = z.infer<typeof AddMemberInputSchema>;
export type BulkAddMembersInput = z.infer<typeof BulkAddMembersInputSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleInputSchema>;
export type ProjectSettingsState = z.infer<typeof ProjectSettingsStateSchema>;

export interface MemberFilterState {
  search: string;
  role?: string | null;
  sortBy?: 'name' | 'email' | 'role' | 'date';
  sortOrder?: 'asc' | 'desc';
}

