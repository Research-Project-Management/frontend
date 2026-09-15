import { z } from "zod";

export const workItemUpdateStatusSchema = z.enum([
  "on_track",
  "at_risk",
  "off_track",
]);
export type WorkItemUpdateStatus = z.infer<typeof workItemUpdateStatusSchema>;

// ── Create WorkItem Update DTO Schema (Matches CreateWorkItemUpdateDto) ───────
export const createWorkItemUpdateDtoSchema = z.object({
  status: workItemUpdateStatusSchema,
  comment: z.string().max(500, "Comment cannot exceed 500 characters").optional(),
  content: z.string().optional(),
  percent: z.number().min(0).max(100).optional(),
});
export type CreateWorkItemUpdateDtoInput = z.infer<typeof createWorkItemUpdateDtoSchema>;
