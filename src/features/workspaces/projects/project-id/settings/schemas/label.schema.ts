import { z } from "zod";

export const labelTypeEnum = z.enum(["project", "task", "cycle", "paper"]);
export type LabelType = z.infer<typeof labelTypeEnum>;

// ── Create Project Label DTO Schema (Matches CreateProjectLabelDto) ──────────
export const createProjectLabelDtoSchema = z.object({
  name: z.string().trim().min(1, "Label name is required").max(255, "Label name is too long"),
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Color must be a valid hex color code (e.g. #ef4444 or #f00)")
    .optional()
    .default("#4bce97"),
  description: z.string().max(1000, "Description is too long").optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().optional(),
  type: labelTypeEnum.optional().default("task"),
});
export type CreateProjectLabelDtoInput = z.infer<typeof createProjectLabelDtoSchema>;

// ── Update Project Label DTO Schema (Matches UpdateProjectLabelDto) ──────────
export const updateProjectLabelDtoSchema = createProjectLabelDtoSchema.partial();
export type UpdateProjectLabelDtoInput = z.infer<typeof updateProjectLabelDtoSchema>;

// ── Reorder Label Item DTO Schema (Matches ReorderLabelItemDto) ───────────────
export const reorderLabelItemDtoSchema = z.object({
  id: z.string().uuid(),
  sortOrder: z.number(),
});
export type ReorderLabelItemDtoInput = z.infer<typeof reorderLabelItemDtoSchema>;

// ── Reorder Labels DTO Schema (Matches ReorderLabelsDto) ─────────────────────
export const reorderLabelsDtoSchema = z.object({
  labels: z.array(reorderLabelItemDtoSchema),
});
export type ReorderLabelsDtoInput = z.infer<typeof reorderLabelsDtoSchema>;

// ── Import Label Item DTO Schema (Matches ImportLabelItemDto) ────────────────
export const importLabelItemDtoSchema = z.object({
  name: z.string().trim().min(1, "Label name is required").max(255),
  color: z.string().optional(),
  description: z.string().max(1000).optional(),
});
export type ImportLabelItemDtoInput = z.infer<typeof importLabelItemDtoSchema>;

// ── Import Labels DTO Schema (Matches ImportLabelsDto) ───────────────────────
export const importLabelsDtoSchema = z.object({
  labels: z.array(importLabelItemDtoSchema),
});
export type ImportLabelsDtoInput = z.infer<typeof importLabelsDtoSchema>;

// ── UI Form Schema (Compatible with Settings Label Modal) ────────────────────
export const labelFormSchema = z.object({
  name: z.string().trim().min(1, "Label name is required").max(255, "Label name is too long"),
  color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, "Invalid HEX color code"),
  description: z.string().max(1000, "Description is too long"),
  parentId: z.string().nullable(),
});
export type LabelFormValues = z.infer<typeof labelFormSchema>;
