import { z } from "zod";

export const relationTypeSchema = z.enum([
  "blocks",
  "blocked_by",
  "relates_to",
  "duplicate_of",
]);
export type RelationType = z.infer<typeof relationTypeSchema>;

export const addRelationDtoSchema = z.object({
  targetWorkItemId: z.string().min(1, "Target work item ID is required"),
  type: relationTypeSchema,
});
export type AddRelationDtoInput = z.infer<typeof addRelationDtoSchema>;
