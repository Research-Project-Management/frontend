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
    const response = await apiGet<{ data?: Item[]; workItems?: Item[] }>(
      `/api/work-items`,
    );
    return response.data || response.workItems || [];
  },
  getWorkItems: () => CoreService.getItems(),

  getById: async (id: string) => {
    const res = await apiGet<{ workItem?: Item; WorkItem?: Item; item?: Item }>(`/api/work-items/${id}`);
    const resolvedItem = (res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, workItem: resolvedItem, item: resolvedItem };
  },
  getWorkItemById: (id: string) => CoreService.getById(id),

  create: async ({ projectId, ...data }: CreateItemInput & { projectId: string }) => {
    const res = await apiPost<{ workItem?: Item; WorkItem?: Item; item?: Item }>(`/api/projects/${projectId}/work-items`, data);
    const resolvedItem = (res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, workItem: resolvedItem, item: resolvedItem };
  },

  update: async ({
    id,
    workItemId,
    projectId: _projectId,
    ...data
  }: { id?: string; workItemId?: string; projectId?: string } & UpdateItemInput) => {
    const targetId = (id || workItemId) ?? '';
    const res = await apiPut<{ workItem?: Item; WorkItem?: Item; item?: Item }>(`/api/work-items/${targetId}`, data);
    const resolvedItem = (res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, workItem: resolvedItem, item: resolvedItem };
  },

  delete: (id: string) =>
    apiDelete(`/api/work-items/${id}`),

  duplicate: async ({
    id,
    workItemId,
    itemId,
    projectId,
  }: { id?: string; workItemId?: string; itemId?: string; projectId: string }) => {
    const targetId = (id || workItemId || itemId) ?? '';
    const res = await apiPost<{ workItem?: Item; WorkItem?: Item; item?: Item; message?: string }>(`/api/work-items/${targetId}/duplicate`, { projectId });
    const resolvedItem = (res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, workItem: resolvedItem, item: resolvedItem };
  },

  createChildWorkItem: async (id: string, data: CreateSubItemInput) => {
    const res = await apiPost<{ workItem?: Item; WorkItem?: Item; item?: Item }>(`/api/work-items/${id}/children`, data);
    const resolvedItem = (res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, workItem: resolvedItem, item: resolvedItem };
  },
  createSubItem: (id: string, data: CreateSubItemInput) =>
    CoreService.createChildWorkItem(id, data),

  convertToRoot: async (id: string) => {
    const res = await apiPost<{ workItem?: Item; WorkItem?: Item; item?: Item; message?: string }>(`/api/work-items/${id}/convert-to-root`);
    const resolvedItem = (res.workItem || res.WorkItem || res.item) as Item;
    return { ...res, workItem: resolvedItem, item: resolvedItem };
  },
  convertToRootWorkItem: (id: string) =>
    CoreService.convertToRoot(id),

  reorder: ({
    projectId,
    id,
    workItemId,
    columnId,
    rank,
  }: ReorderItemInput) => {
    const targetId = (id || workItemId) ?? '';
    const payload = { workItemId: targetId, id: targetId, columnId, rank };
    return projectId
      ? apiPut<{ message: string }>(`/api/projects/${projectId}/work-items/reorder`, payload)
      : apiPut<{ message: string }>(`/api/work-items/${targetId}/reorder`, payload);
  },
  reorderWorkItem: (input: ReorderItemInput) => CoreService.reorder(input),

  bulkUpdate: ({
    ids,
    itemIds,
    workItemIds,
    data,
    projectId,
  }: BulkUpdateItemInput) => {
    const targetIds = (ids || itemIds || workItemIds) ?? [];
    const payload = { workItemIds: targetIds, ids: targetIds, data, projectId };
    return projectId
      ? apiPut<{ message: string; count: number }>(`/api/projects/${projectId}/work-items/bulk`, payload)
      : apiPut<{ message: string; count: number }>(`/api/work-items/bulk`, payload);
  },

  bulkDelete: ({
    ids,
    itemIds,
    workItemIds,
    projectId,
  }: { ids?: string[]; itemIds?: string[]; workItemIds?: string[]; projectId?: string }) => {
    const targetIds = (ids || itemIds || workItemIds) ?? [];
    const payload = { workItemIds: targetIds, ids: targetIds };
    return projectId
      ? apiPost(`/api/projects/${projectId}/work-items/bulk-delete`, payload)
      : apiPost(`/api/work-items/bulk-delete`, payload);
  },
};
