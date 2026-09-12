import { z } from "zod";

export const relationTypeSchema = z.enum([
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicate_of",
]);
export type RelationType = z.infer<typeof relationTypeSchema>;

// ── Add Relation DTO Schema (Matches AddRelationDto) ─────────────────────────
export const addRelationDtoSchema = z.object({
  targetTaskId: z.string().min(1, "Target work item ID is required"),
  type: relationTypeSchema,
});
export type AddRelationDtoInput = z.infer<typeof addRelationDtoSchema>;
