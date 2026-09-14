import { z } from "zod";

// ── Assign Work Item DTO Schema (Matches AssignWorkItemDto) ───────────────────
export const assignWorkItemDtoSchema = z.object({
  assigneeId: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
});
export type AssignWorkItemDtoInput = z.infer<typeof assignWorkItemDtoSchema>;

// ── Bulk Assign Work Item DTO Schema (Matches BulkAssignWorkItemDto) ───────────
export const bulkAssignWorkItemDtoSchema = z.object({
  workItemIds: z.array(z.string()).min(1, "At least one WorkItem ID must be provided"),
  assigneeId: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
});
export type BulkAssignWorkItemDtoInput = z.infer<typeof bulkAssignWorkItemDtoSchema>;

// ── Set Assignees DTO Schema (Matches SetAssigneesDto) ────────────────────────
export const setAssigneesDtoSchema = z.object({
  assigneeIds: z.array(z.string()),
});
export type SetAssigneesDtoInput = z.infer<typeof setAssigneesDtoSchema>;

// ── Add Assignee DTO Schema (Matches AddAssigneeDto) ──────────────────────────
export const addAssigneeDtoSchema = z.object({
  assigneeId: z.string().min(1, "Assignee ID is required"),
});
export type AddAssigneeDtoInput = z.infer<typeof addAssigneeDtoSchema>;
