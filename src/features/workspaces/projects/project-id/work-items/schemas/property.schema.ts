import { z } from "zod";

// ── Update Property DTO Schema (Matches UpdatePropertyDto) ───────────────────
export const updatePropertyDtoSchema = z.object({
  filters: z.record(z.string(), z.any()).optional(),
  displayFilters: z.record(z.string(), z.any()).optional(),
  display_filters: z.record(z.string(), z.any()).optional(),
  displayProperties: z.record(z.string(), z.any()).optional(),
  display_properties: z.record(z.string(), z.any()).optional(),
  richFilters: z.record(z.string(), z.any()).optional(),
  rich_filters: z.record(z.string(), z.any()).optional(),
  preferences: z.record(z.string(), z.any()).optional(),
  sortOrder: z.number().optional(),
  sort_order: z.number().optional(),
});
export type UpdatePropertyDtoInput = z.infer<typeof updatePropertyDtoSchema>;
