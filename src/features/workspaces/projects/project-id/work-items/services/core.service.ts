import { apiGet, apiPost, apiPut, apiDelete } from "@/shared/lib/api";
import type {
  Item,
  CreateItemInput,
  UpdateItemInput,
  ReorderItemInput,
  BulkUpdateItemInput,
  CreateSubItemInput,
  ProjectItemsData,
} from "../types/work-item.types";

export const CoreService = {
  getProjectItems: (projectId: string, cycleId?: string) =>
    apiGet<ProjectItemsData>(
      `/api/projects/${projectId}/work-items${cycleId ? `?cycleId=${cycleId}` : ""}`,
    ),
  getProjectWorkItems: (projectId: string, cycleId?: string) =>
    CoreService.getProjectItems(projectId, cycleId),

  getItems: async () => {
    const response = await apiGet<{ data?: Item[]; tasks?: Item[]; workItems?: Item[] }>(
      `/api/work-items`,
    );
    return response.data || response.workItems || response.tasks || [];
  },
  getWorkItems: () => CoreService.getItems(),

  getById: async (id: string) => {
    const res = await apiGet<{ task?: Item; workItem?: Item; WorkItem?: Item; item?: Item }>(`/api/work-items/${id}`);
    const resolvedItem = (res.task || res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, task: resolvedItem, workItem: resolvedItem, item: resolvedItem };
  },
  getWorkItemById: (id: string) => CoreService.getById(id),

  create: async ({ projectId, ...data }: CreateItemInput & { projectId: string }) => {
    const res = await apiPost<{ task?: Item; workItem?: Item; WorkItem?: Item; item?: Item }>(`/api/projects/${projectId}/work-items`, data);
    const resolvedItem = (res.task || res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, task: resolvedItem, workItem: resolvedItem, item: resolvedItem };
  },

  update: async ({
    id,
    workItemId,
    taskId,
    projectId: _projectId,
    ...data
  }: { id?: string; workItemId?: string; taskId?: string; projectId?: string } & UpdateItemInput) => {
    const targetId = (id || workItemId || taskId) ?? '';
    const res = await apiPut<{ task?: Item; workItem?: Item; WorkItem?: Item; item?: Item }>(`/api/work-items/${targetId}`, data);
    const resolvedItem = (res.task || res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, task: resolvedItem, workItem: resolvedItem, item: resolvedItem };
  },

  delete: (id: string) =>
    apiDelete(`/api/work-items/${id}`),

  duplicate: async ({
    id,
    workItemId,
    taskId,
    projectId,
  }: { id?: string; workItemId?: string; taskId?: string; projectId: string }) => {
    const targetId = (id || workItemId || taskId) ?? '';
    const res = await apiPost<{ task?: Item; workItem?: Item; WorkItem?: Item; item?: Item; message?: string }>(`/api/work-items/${targetId}/duplicate`, { projectId });
    const resolvedItem = (res.task || res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, task: resolvedItem, workItem: resolvedItem, item: resolvedItem };
  },

  createSubItem: async (id: string, data: CreateSubItemInput) => {
    const res = await apiPost<{ task?: Item; workItem?: Item; WorkItem?: Item; item?: Item }>(`/api/work-items/${id}/subtasks`, data);
    const resolvedItem = (res.task || res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, task: resolvedItem, workItem: resolvedItem, item: resolvedItem };
  },
  createSubtask: (id: string, data: CreateSubItemInput) =>
    CoreService.createSubItem(id, data),

  convertToRoot: async (id: string) => {
    const res = await apiPost<{ task?: Item; workItem?: Item; WorkItem?: Item; item?: Item; message?: string }>(`/api/work-items/${id}/convert-to-root`);
    const resolvedItem = (res.task || res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, task: resolvedItem, workItem: resolvedItem, item: resolvedItem };
  },
  convertToRootTask: (id: string) =>
    CoreService.convertToRoot(id),

  reorder: ({
    projectId,
    id,
    workItemId,
    taskId,
    columnId,
    rank,
  }: ReorderItemInput) => {
    const targetId = (id || workItemId || taskId) ?? '';
    const payload = { taskId: targetId, workItemId: targetId, id: targetId, columnId, rank };
    return projectId
      ? apiPut<{ message: string }>(`/api/projects/${projectId}/work-items/reorder`, payload)
      : apiPut<{ message: string }>(`/api/work-items/${targetId}/reorder`, payload);
  },
  reorderWorkItem: (input: ReorderItemInput) => CoreService.reorder(input),
  reorderTask: (input: ReorderItemInput) => CoreService.reorder(input),

  bulkUpdate: ({
    ids,
    itemIds,
    workItemIds,
    taskIds,
    data,
    projectId,
  }: BulkUpdateItemInput) => {
    const targetIds = (ids || itemIds || workItemIds || taskIds) ?? [];
    const payload = { taskIds: targetIds, workItemIds: targetIds, ids: targetIds, data, projectId };
    return projectId
      ? apiPut<{ message: string; count: number }>(`/api/projects/${projectId}/work-items/bulk`, payload)
      : apiPut<{ message: string; count: number }>(`/api/work-items/bulk`, payload);
  },

  bulkDelete: ({
    ids,
    itemIds,
    workItemIds,
    taskIds,
    projectId,
  }: { ids?: string[]; itemIds?: string[]; workItemIds?: string[]; taskIds?: string[]; projectId?: string }) => {
    const targetIds = (ids || itemIds || workItemIds || taskIds) ?? [];
    const payload = { taskIds: targetIds, workItemIds: targetIds, ids: targetIds };
    return projectId
      ? apiPost(`/api/projects/${projectId}/work-items/bulk-delete`, payload)
      : apiPost(`/api/work-items/bulk-delete`, payload);
  },
};
