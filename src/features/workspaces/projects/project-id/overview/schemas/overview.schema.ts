import { z } from 'zod';

// ── Member Schema ────────────────────────────────────────────────────────────

export const memberSchema = z.object({
  user: z.object({
    id: z.string().optional(),
    _id: z.string().optional(),
    name: z.string(),
    email: z.string().optional().default(''),
    avatar: z.string().optional().nullable(),
  }),
  role: z.string().optional().default('contributor'),
  joinedAt: z.string().optional(),
});

// ── Project Details Schema ───────────────────────────────────────────────────

export const projectInfoSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  name: z.string(),
  description: z.string().optional().default(''),
  avatar: z.string().optional().nullable(),
  isActive: z.boolean().optional().default(true),
  modules: z.array(z.string()).optional().default([]),
  workspace: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
  workspaceId: z.string().optional(),
  members: z.array(memberSchema).default([]),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ── Stats Schema ─────────────────────────────────────────────────────────────

export const statsSchema = z.object({
  tasks: z.object({
    total: z.number().default(0),
    completed: z.number().default(0),
    pending: z.number().optional().default(0),
    inProgress: z.number().optional().default(0),
  }),
  files: z.object({
    count: z.number().default(0),
    totalSize: z.number().default(0),
    recent: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  }),
  members: z.number().default(0),
});

// ── Root Overview Schema ─────────────────────────────────────────────────────

export const overviewSchema = z.object({
  project: projectInfoSchema,
  stats: statsSchema,
});

// ── Inferred Types ──────────────────────────────────────────────────────────

export type Member = z.infer<typeof memberSchema>;
export type ProjectInfo = z.infer<typeof projectInfoSchema>;
export type Stats = z.infer<typeof statsSchema>;
export type OverviewData = z.infer<typeof overviewSchema>;
