import { z } from "zod";
import { taskPrioritySchema } from "./core.schema";

// ── Create Draft DTO Schema (Matches CreateDraftDto) ─────────────────────────
export const createDraftDtoSchema = z.object({
  projectId: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  columnId: z.string().optional(),
  priority: taskPrioritySchema.optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  cycleId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  labels: z.array(z.string()).optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  attachments: z.any().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type CreateDraftDtoInput = z.infer<typeof createDraftDtoSchema>;

// ── Update Draft DTO Schema (Matches UpdateDraftDto) ─────────────────────────
export const updateDraftDtoSchema = createDraftDtoSchema.partial();
export type UpdateDraftDtoInput = z.infer<typeof updateDraftDtoSchema>;

// ── Publish Draft DTO Schema (Matches PublishDraftDto) ───────────────────────
export const publishDraftDtoSchema = z.object({
  projectId: z.string().optional(),
  columnId: z.string().optional(),
  cycleId: z.string().optional(),
  title: z.string().optional(),
  priority: taskPrioritySchema.optional(),
});
export type PublishDraftDtoInput = z.infer<typeof publishDraftDtoSchema>;

// ── Query Draft DTO Schema (Matches QueryDraftDto) ───────────────────────────
export const queryDraftDtoSchema = z.object({
  projectId: z.string().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
});
export type QueryDraftDtoInput = z.infer<typeof queryDraftDtoSchema>;
