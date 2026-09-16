import { z } from "zod";

// ── State Group Lifecycle Stages (Matches Prisma & STATE_GROUPS) ──────────────
export const stateGroupEnum = z.enum([
  "backlog",
  "unstarted",
  "started",
  "completed",
  "cancelled",
]);
export type StateGroup = z.infer<typeof stateGroupEnum>;

// ── Create State DTO Schema (Matches CreateStateDto) ─────────────────────────
export const createStateDtoSchema = z.object({
  name: z.string().trim().min(1, "State name is required").max(100, "State name is too long"),
  title: z.string().optional(),
  group: stateGroupEnum,
  color: z
    .string()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "color must be a valid hex color code (e.g. #6366F1)")
    .optional()
    .default("#6366F1"),
  accentColor: z.string().optional(),
  icon: z.string().optional(),
  description: z.string().max(500, "Description is too long").optional(),
  sequence: z.number().optional(),
  isDefault: z.boolean().optional().default(false),
  id: z.string().optional(),
});
export type CreateStateDtoInput = z.infer<typeof createStateDtoSchema>;

// ── Update State DTO Schema (Matches UpdateStateDto) ─────────────────────────
export const updateStateDtoSchema = createStateDtoSchema.partial();
export type UpdateStateDtoInput = z.infer<typeof updateStateDtoSchema>;

// ── Reorder State Item DTO Schema (Matches StateOrderItemDto) ────────────────
export const stateOrderItemDtoSchema = z.object({
  id: z.string().min(1, "State ID is required"),
  sequence: z.number().optional(),
  group: stateGroupEnum.optional(),
  title: z.string().optional(),
  accentColor: z.string().optional(),
});
export type StateOrderItemDtoInput = z.infer<typeof stateOrderItemDtoSchema>;

// ── Reorder States DTO Schema (Matches ReorderStatesDto) ──────────────────────
export const reorderStatesDtoSchema = z.object({
  states: z.array(stateOrderItemDtoSchema).optional(),
  columns: z.array(stateOrderItemDtoSchema).optional(),
});
export type ReorderStatesDtoInput = z.infer<typeof reorderStatesDtoSchema>;

// ── UI Form Schema (Compatible with Settings State Modal) ───────────────────
export const stateFormSchema = z.object({
  name: z.string().trim().min(1, "State name is required").max(100, "State name is too long"),
  color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/, "Invalid HEX color code"),
  group: stateGroupEnum,
  description: z.string().max(500, "Description is too long"),
  isDefault: z.boolean(),
});
export type StateFormValues = z.infer<typeof stateFormSchema>;
