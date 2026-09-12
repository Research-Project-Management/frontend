import { z } from "zod";
import { taskPrioritySchema } from "./core.schema";

// ── Create Template DTO Schema (Matches CreateTemplateDto) ───────────────────
export const createTemplateDtoSchema = z.object({
  name: z.string().trim().min(1, "Template name is required").max(255),
  description: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  priority: taskPrioritySchema.optional().default("none"),
  labelIds: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  assigneeIds: z.array(z.string()).optional(),
  checklists: z.array(z.any()).optional(),
  isDefault: z.boolean().optional().default(false),
  defaultCycleId: z.string().nullable().optional(),
  defaultColumnId: z.string().nullable().optional(),
  isShared: z.boolean().optional(),
  projectId: z.string().optional(),
});
export type CreateTemplateDtoInput = z.infer<typeof createTemplateDtoSchema>;

// ── Update Template DTO Schema (Matches UpdateTemplateDto) ───────────────────
export const updateTemplateDtoSchema = createTemplateDtoSchema.partial();
export type UpdateTemplateDtoInput = z.infer<typeof updateTemplateDtoSchema>;

// ── Instantiate Template DTO Schema (Matches InstantiateTemplateDto) ─────────
export const instantiateTemplateDtoSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  columnId: z.string().optional(),
  cycleId: z.string().optional(),
  assigneeId: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
  priority: taskPrioritySchema.optional(),
  overrides: z.record(z.string(), z.any()).optional(),
});
export type InstantiateTemplateDtoInput = z.infer<typeof instantiateTemplateDtoSchema>;

// ── Query Template DTO Schema (Matches QueryTemplateDto) ─────────────────────
export const queryTemplateDtoSchema = z.object({
  search: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
});
export type QueryTemplateDtoInput = z.infer<typeof queryTemplateDtoSchema>;
