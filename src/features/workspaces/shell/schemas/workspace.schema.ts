import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────

export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'member']);

// ── Member ────────────────────────────────────────────────────────────────────

const UserRefSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  avatar: z.string().nullable(),
});

export const WorkspaceMemberSchema = z.object({
  userId: z.union([z.string(), UserRefSchema]),
  role: WorkspaceRoleSchema,
  joinedAt: z.string(),
});

// ── Workspace ─────────────────────────────────────────────────────────────────

export const WorkspaceSchema = z.object({
  _id: z.string(),
  name: z.string(),
  url: z.string(),
  avatar: z.string(),
  members: z.array(WorkspaceMemberSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ── Dashboard data ────────────────────────────────────────────────────────────

export const RecentItemSchema = z.object({
  type: z.enum(['page', 'project', 'file']),
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  project: z.object({
    _id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
  }).optional(),
  author: z.object({
    _id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
    email: z.string(),
  }),
  lastEdited: z.string(),
});

export const ActivitySchema = z.object({
  type: z.enum(['page_update', 'file_upload', 'task_update']),
  user: z.object({
    _id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
    email: z.string(),
  }),
  content: z.string(),
  time: z.string(),
  itemId: z.string(),
  project: z.object({ _id: z.string(), name: z.string() }).optional(),
});

// ── Role ──────────────────────────────────────────────────────────────────────

export const PermissionSchema = z.object({
  resource: z.string(),
  actions: z.array(z.string()),
});

export const RoleSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['workspace', 'project']),
  workspace: z.string(),
  project: z.string().optional(),
  permissions: z.array(PermissionSchema),
  isSystem: z.boolean(),
  color: z.string(),
  createdBy: z.object({
    _id: z.string(),
    name: z.string(),
    email: z.string(),
    avatar: z.string().optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ── Mutation inputs ───────────────────────────────────────────────────────────

export const WorkspacePatchSchema = z.object({
  _id: z.string().optional(),
  url: z.string().optional(),
  name: z.string().optional(),
  avatar: z.string().nullable().optional(),
  companySize: z.string().optional(),
  timezone: z.string().optional(),
});
