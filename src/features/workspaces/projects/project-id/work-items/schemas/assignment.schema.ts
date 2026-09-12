import { z } from "zod";

// ── Assign Task DTO Schema (Matches AssignTaskDto) ────────────────────────────
export const assignTaskDtoSchema = z.object({
  assigneeId: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
});
export type AssignTaskDtoInput = z.infer<typeof assignTaskDtoSchema>;

// ── Bulk Assign Task DTO Schema (Matches BulkAssignTaskDto) ───────────────────
export const bulkAssignTaskDtoSchema = z.object({
  taskIds: z.array(z.string()).min(1, "At least one WorkItem ID must be provided"),
  assigneeId: z.string().nullable().optional(),
  assignee: z.string().nullable().optional(),
});
export type BulkAssignTaskDtoInput = z.infer<typeof bulkAssignTaskDtoSchema>;

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
