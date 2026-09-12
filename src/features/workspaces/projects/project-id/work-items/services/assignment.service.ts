import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type { Item, ProjectMember } from "../types/work-item.types";

export const AssignmentService = {
  getEligibleAssignees: (projectId: string) =>
    apiGet<ProjectMember[]>(`/api/projects/${projectId}/work-items/assignees`),

  assign: (projectId: string, itemId: string, assigneeId: string | null) =>
    apiPost<{ message: string; task: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/assign`, {
      assigneeId,
    }),
  assignTask: (projectId: string, taskId: string, assigneeId: string | null) =>
    AssignmentService.assign(projectId, taskId, assigneeId),

  unassign: (projectId: string, itemId: string) =>
    apiPost<{ message: string; task: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/unassign`),
  unassignTask: (projectId: string, taskId: string) =>
    AssignmentService.unassign(projectId, taskId),

  join: (projectId: string, itemId: string) =>
    apiPost<{ message: string; task: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/join`),
  joinTask: (projectId: string, taskId: string) =>
    AssignmentService.join(projectId, taskId),

  leave: (projectId: string, itemId: string) =>
    apiPost<{ message: string; task: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/leave`),
  leaveTask: (projectId: string, taskId: string) =>
    AssignmentService.leave(projectId, taskId),

  setAssignees: (projectId: string, itemId: string, assigneeIds: string[]) =>
    apiPut<{ message: string; task: Item; item?: Item }>(`/api/projects/${projectId}/work-items/${itemId}/assignees`, {
      assigneeIds,
    }),

  removeAssignee: (projectId: string, itemId: string, targetUserId: string) =>
    apiDelete<{ message: string; task: Item; item?: Item }>(
      `/api/projects/${projectId}/work-items/${itemId}/assignees/${targetUserId}`,
    ),

  bulkAssign: (projectId: string, taskIds: string[], assigneeId: string | null) =>
    apiPost<{ message: string; updatedCount: number }>(`/api/projects/${projectId}/work-items/bulk-assign`, {
      taskIds,
      assigneeId,
    }),
};
