import { z } from "zod";

// ── View Layout Mode & Access Enums ──────────────────────────────────────────
export const viewLayoutModeSchema = z.enum([
  "board",
  "list",
  "table",
  "calendar",
  "timeline",
]);
export type ViewLayoutMode = z.infer<typeof viewLayoutModeSchema>;

export const viewAccessSchema = z.enum(["public", "private"]);
export type ViewAccess = z.infer<typeof viewAccessSchema>;

// ── Create View DTO Schema (Matches CreateViewDto) ───────────────────────────
export const createViewDtoSchema = z.object({
  name: z.string().trim().min(1, "View name is required").max(100, "View name is too long"),
  description: z.string().max(255, "Description is too long").optional(),
  query: z.record(z.string(), z.any()).optional(),
  filters: z.record(z.string(), z.any()).optional(),
  displayFilters: z.record(z.string(), z.any()).optional(),
  layout: viewLayoutModeSchema.optional().default("board"),
  displayProperties: z.record(z.string(), z.any()).optional(),
  richFilters: z.record(z.string(), z.any()).optional(),
  sortOrder: z.number().optional(),
  logoProps: z.record(z.string(), z.any()).optional(),
  access: viewAccessSchema.optional().default("public"),
});
export type CreateViewDtoInput = z.infer<typeof createViewDtoSchema>;

// ── Update View DTO Schema (Matches UpdateViewDto) ───────────────────────────
export const updateViewDtoSchema = createViewDtoSchema.partial().extend({
  isLocked: z.boolean().optional(),
  archivedAt: z.string().nullable().optional(),
});
export type UpdateViewDtoInput = z.infer<typeof updateViewDtoSchema>;

// ── Query View DTO Schema (Matches QueryViewDto) ─────────────────────────────
export const queryViewDtoSchema = z.object({
  search: z.string().optional(),
  access: viewAccessSchema.optional(),
  isFavorite: z.boolean().optional(),
});
export type QueryViewDtoInput = z.infer<typeof queryViewDtoSchema>;

// ── Create Favorite View DTO Schema (Matches CreateFavoriteViewDto) ──────────
export const createFavoriteViewDtoSchema = z.object({
  view: z.string().optional(),
  viewId: z.string().optional(),
});
export type CreateFavoriteViewDtoInput = z.infer<typeof createFavoriteViewDtoSchema>;

// ── UI Form Schema ──────────────────────────────────────────────────────────
export const viewFormSchema = z.object({
  name: z.string().trim().min(1, "View name is required").max(100, "View name is too long"),
  description: z.string().max(255, "Description is too long"),
  layout: viewLayoutModeSchema,
  access: viewAccessSchema,
});
export type ViewFormValues = z.infer<typeof viewFormSchema>;
