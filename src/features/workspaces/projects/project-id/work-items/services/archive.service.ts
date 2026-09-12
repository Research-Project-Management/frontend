import { apiGet, apiPost } from "@/shared/lib/api";
import type { Item } from "../types/work-item.types";

export interface ArchivedItemsResponse {
  archivedItems?: Item[];
  archivedTasks?: Item[];
  count: number;
}
export type ArchivedTasksResponse = ArchivedItemsResponse;

export const ArchiveService = {
  archive: (id: string) =>
    apiPost<{ message: string; task?: Item; workItem?: Item; item?: Item }>(`/api/work-items/${id}/archive`),
  archiveWorkItem: (id: string) => ArchiveService.archive(id),

  restore: (id: string) =>
    apiPost<{ message: string; task?: Item; workItem?: Item; item?: Item }>(`/api/work-items/${id}/restore`),
  restoreWorkItem: (id: string) => ArchiveService.restore(id),

  bulkArchive: (ids: string[]) =>
    apiPost<{ message: string; count: number }>(`/api/work-items/bulk-archive`, { taskIds: ids, workItemIds: ids, ids }),

  bulkRestore: (ids: string[]) =>
    apiPost<{ message: string; count: number }>(`/api/work-items/bulk-restore`, { taskIds: ids, workItemIds: ids, ids }),

  getArchived: (projectId: string) =>
    apiGet<ArchivedItemsResponse | Item[]>(`/api/work-items/projects/${projectId}/archived`),
  getArchivedWorkItems: (projectId: string) => ArchiveService.getArchived(projectId),
};
