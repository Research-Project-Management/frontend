import { z } from "zod";

// ── Re-export modular DTO schemas ────────────────────────────────────────────
export * from "./core.schema";
export * from "./assignment.schema";
export * from "./attachment.schema";
export * from "./comment.schema";
export * from "./relation.schema";
export * from "./template.schema";
export * from "./update.schema";
export * from "./property.schema";

import {
  workItemPrioritySchema,
  createWorkItemDtoSchema,
  updateWorkItemDtoSchema,
} from "./core.schema";
import { relationTypeSchema } from "./relation.schema";

// ── Domain Enums & Aliases ───────────────────────────────────────────────────
export const itemPrioritySchema = workItemPrioritySchema;
export { workItemPrioritySchema };

export const itemRelationTypeSchema = relationTypeSchema;
export const workItemRelationTypeSchema = relationTypeSchema;

export const stateGroupSchema = z.enum([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
]);
export type StateGroup = z.infer<typeof stateGroupSchema>;

// ── Minimal Related Schemas ──────────────────────────────────────────────────
export const userMinimalSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export const cycleMinimalSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const parentItemMinimalSchema = z.object({
  id: z.string(),
  title: z.string(),
  identifier: z.string().nullable().optional(),
});
export const parentWorkItemMinimalSchema = parentItemMinimalSchema;

export const relationSchema = z.object({
  id: z.string(),
  type: relationTypeSchema,
  targetId: z.string().optional(),
  targetWorkItemId: z.string().optional(),
  targetTitle: z.string().optional(),
  targetIdentifier: z.string().optional(),
  targetColumnId: z.string().optional(),
});
export const itemRelationSchema = relationSchema;
export const workItemRelationSchema = relationSchema;

export const subItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  identifier: z.string().nullable().optional(),
  columnId: z.string().default("backlog"),
  completed: z.boolean().default(false),
  rank: z.number().default(0),
  assigneeId: z.string().nullable().optional(),
  assignee: userMinimalSchema.nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

// ── Attach Center Schemas (Pages, Papers, Files, Links) ─────────────────────
export const attachPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string().nullable().optional(),
  addedAt: z.string().optional(),
});

export const attachPaperSchema = z.object({
  id: z.string(),
  title: z.string(),
  doi: z.string().nullable().optional(),
  citationKey: z.string().nullable().optional(),
  addedAt: z.string().optional(),
});

export const attachFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  size: z.union([z.number(), z.string()]).nullable().optional(),
  type: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  uploadedAt: z.string().optional(),
});

export const attachLinkSchema = z.object({
  title: z.string(),
  url: z.string(),
  addedAt: z.string().optional(),
});

export const attachmentsSchema = z.object({
  pages: z.array(attachPageSchema).default([]),
  papers: z.array(attachPaperSchema).default([]),
  files: z.array(attachFileSchema).default([]),
  links: z.array(attachLinkSchema).default([]),
});
export const itemAttachmentsSchema = attachmentsSchema;
export const workItemAttachmentsSchema = attachmentsSchema;

export const attachmentSchema = attachFileSchema;
export const itemAttachmentSchema = attachmentSchema;
export const workItemAttachmentSchema = attachmentSchema;

export const attachPageInputSchema = z.object({
  pageId: z.string().min(1, "Page ID is required"),
  title: z.string().optional(),
});

export const attachPaperInputSchema = z.object({
  paperId: z.string().min(1, "Paper ID is required"),
  title: z.string().optional(),
  doi: z.string().optional(),
  citationKey: z.string().optional(),
});

export const attachFileInputSchema = z.object({
  name: z.string().min(1, "File name is required"),
  url: z.string().url("Must be a valid URL"),
  size: z.union([z.number(), z.string()]).optional(),
  type: z.string().optional(),
});

export const attachLinkInputSchema = z.object({
  title: z.string().min(1, "Title is required"),
  url: z.string().url("Must be a valid URL"),
});

// ── Main Item Entity Schema ─────────────────────────────────────────────────
export const itemSchema = z.object({
  id: z.string(),
  identifier: z.string().nullable().optional(),
  sequenceNumber: z.number().nullable().optional(),
  title: z.string().min(1, "Title is required"),
  content: z.string().default(""),
  description: z.string().default(""),
  columnId: z.string(),
  priority: workItemPrioritySchema.default("none"),
  relations: z.array(relationSchema).default([]),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  labels: z.array(z.string()).default([]),
  attachments: attachmentsSchema.default({
    pages: [],
    papers: [],
    files: [],
    links: [],
  }),
  completed: z.boolean().default(false),
  stateGroup: stateGroupSchema.optional(),
  state: z
    .object({
      id: z.string(),
      name: z.string(),
      group: stateGroupSchema,
      color: z.string().optional(),
    })
    .nullable()
    .optional(),
  progressPercentage: z.number().optional(),
  rank: z.number().default(0),
  timeSpent: z.number().nullable().optional(),
  projectId: z.string(),
  authorId: z.string().optional(),
  author: userMinimalSchema.nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assignee: userMinimalSchema.nullable().optional(),
  assigneeIds: z.array(z.string()).default([]),
  assignees: z.array(userMinimalSchema).default([]),
  subscriberIds: z.array(z.string()).default([]),
  cycleId: z.string().nullable().optional(),
  cycle: z.union([cycleMinimalSchema, z.string()]).nullable().optional(),
  parentId: z.string().nullable().optional(),
  parentItemId: z.string().nullable().optional(),
  parentWorkItemId: z.string().nullable().optional(),
  parentItem: parentItemMinimalSchema.nullable().optional(),
  parentWorkItem: parentWorkItemMinimalSchema.nullable().optional(),
  subItems: z.array(subItemSchema).default([]),
  childWorkItems: z.array(subItemSchema).default([]),
  subItemCount: z.number().optional(),
  childWorkItemCount: z.number().optional(),
  subItemCompletedCount: z.number().optional(),
  childWorkItemCompletedCount: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const workItemSchema = itemSchema;

// ── Mutation Schema Aliases ──────────────────────────────────────────────────
export const createItemSchema = createWorkItemDtoSchema;
export const createWorkItemSchema = createWorkItemDtoSchema;
export const updateItemSchema = updateWorkItemDtoSchema;
export const updateWorkItemSchema = updateWorkItemDtoSchema;
export const itemMutationInputSchema = updateWorkItemDtoSchema;
export const workItemMutationInputSchema = updateWorkItemDtoSchema;

// ── State & Column Schemas ──────────────────────────────────────────────────
export const stateSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string().optional(),
  slug: z.string().optional(),
  color: z.string(),
  accentColor: z.string().optional(),
  icon: z.string().optional(),
  group: stateGroupSchema,
  sequence: z.number().default(0),
  isDefault: z.boolean().default(false),
  description: z.string().nullable().optional(),
});

// ── Filter & Display Schemas ────────────────────────────────────────────────
export const filtersSchema = z.object({
  search: z.string().default(""),
  state: z.array(z.string()).default([]),
  state_group: z.array(z.string()).default([]),
  priority: z.array(workItemPrioritySchema).default([]),
  assignees: z.array(z.string()).default([]),
  mentions: z.array(z.string()).default([]),
  created_by: z.array(z.string()).default([]),
  labels: z.array(z.string()).default([]),
  cycle: z.array(z.string()).default([]),
  attach: z.array(z.string()).default([]),
  items: z.array(z.string()).default([]),
  work_items: z.array(z.string()).default([]),
  parent: z.array(z.string()).default([]),
  due_date: z.array(z.string()).default([]),
  start_date: z.array(z.string()).default([]),
  created_at: z.array(z.string()).default([]),
  updated_at: z.array(z.string()).default([]),
  subscribers: z.array(z.string()).default([]),
  columnId: z.union([z.string(), z.array(z.string())]).optional(),
  assigneeId: z.union([z.string(), z.array(z.string())]).optional(),
  cycleId: z.string().optional(),
  dueDateRange: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  hasAttachment: z.boolean().optional(),
});
export const workItemFiltersSchema = filtersSchema;
