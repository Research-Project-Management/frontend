import { z } from 'zod';
import {
  ProjectRoleEnum,
  ProjectMemberUserSchema,
  ProjectMemberSchema,
  ProjectSettingsSchema,
  ProjectSchema,
  CreateProjectInputSchema,
  UpdateProjectInputSchema,
  ProjectPermissionsSchema,
  ProjectDetailResponseSchema,
  ProjectListResponseSchema,
} from '../schemas/project.schema';

export type ProjectRole = z.infer<typeof ProjectRoleEnum>;
export type ProjectMemberUser = z.infer<typeof ProjectMemberUserSchema>;
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type ProjectPermissions = z.infer<typeof ProjectPermissionsSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type ProjectDetailResponse = z.infer<typeof ProjectDetailResponseSchema>;
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

