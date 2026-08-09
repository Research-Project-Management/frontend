import { z } from 'zod';
import {
  WorkspaceSchema,
  WorkspaceMemberSchema,
  WorkspaceRoleSchema,
  RecentItemSchema,
  ActivitySchema,
  RoleSchema,
  PermissionSchema,
  WorkspacePatchSchema,
} from '../schemas/workspace.schema';

// ── Inferred types (single source of truth from Zod) ─────────────────────────

export type Workspace = z.infer<typeof WorkspaceSchema>;
export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;
export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
export type RecentItem = z.infer<typeof RecentItemSchema>;
export type Activity = z.infer<typeof ActivitySchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type WorkspacePatch = z.infer<typeof WorkspacePatchSchema>;

// ── Derived helpers ───────────────────────────────────────────────────────────

export type DeleteWorkspaceResult = {
  alreadyDeleted: boolean;
  workspaceId: string;
};

// ── Constants (as const — never use enum) ─────────────────────────────────────

export const RESOURCES = [
  { value: 'workspace', label: 'Workspace', description: 'Workspace settings and configuration' },
  { value: 'project', label: 'Project', description: 'Projects within workspace' },
  { value: 'task', label: 'Task', description: 'Tasks and kanban boards' },
  { value: 'page', label: 'Page', description: 'Pages and documents' },
  { value: 'file', label: 'File', description: 'File storage and management' },
  { value: 'sticky', label: 'Sticky', description: 'Sticky notes' },
  { value: 'member', label: 'Member', description: 'Workspace members' },
  { value: 'settings', label: 'Settings', description: 'Workspace settings' },
  { value: 'role', label: 'Role', description: 'Roles and permissions' },
] as const;

export const ACTIONS = [
  { value: 'create', label: 'Create', icon: '➕' },
  { value: 'read', label: 'Read', icon: '👁️' },
  { value: 'update', label: 'Update', icon: '✏️' },
  { value: 'delete', label: 'Delete', icon: '🗑️' },
  { value: 'manage', label: 'Manage', icon: '⚙️' },
  { value: 'invite', label: 'Invite', icon: '📧' },
  { value: 'export', label: 'Export', icon: '📤' },
] as const;
