import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Item, ProjectMember } from "../types/work-item.types";

export const AssignmentService = {
  getEligibleAssignees: (projectId: string) =>
    apiGet<ProjectMember[]>(`/api/projects/${projectId}/work-items/assignees`),

  assign: (projectId: string, itemId: string, assigneeId: string | null) =>
    apiPost<{ message: string; workItem: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/assign`, {
      assigneeId,
    }),

  unassign: (projectId: string, itemId: string) =>
    apiPost<{ message: string; workItem: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/unassign`),

  join: (projectId: string, itemId: string) =>
    apiPost<{ message: string; workItem: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/join`),

  leave: (projectId: string, itemId: string) =>
    apiPost<{ message: string; workItem: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/leave`),

  setAssignees: (projectId: string, itemId: string, assigneeIds: string[]) =>
    apiPut<{ message: string; workItem: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/assignees`, {
      assigneeIds,
    }),

  removeAssignee: (projectId: string, itemId: string, targetUserId: string) =>
    apiDelete<{ message: string; workItem: Item; item?: Item }>(
      `/api/projects/${projectId}/work-items/${itemId}/assignees/${targetUserId}`,
    ),

  bulkAssign: (projectId: string, workItemIds: string[], assigneeId: string | null) =>
    apiPost<{ message: string; updatedCount: number }>(`/api/projects/${projectId}/work-items/bulk-assign`, {
      workItemIds,
      assigneeId,
    }),
};
