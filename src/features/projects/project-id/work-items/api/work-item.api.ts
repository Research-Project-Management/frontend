/**
 * Unified WorkItem API Client
 * Consolidated gateway for all Work Item network operations.
 * Replaces 12 fragmented shallow service files with a single cohesive, strongly-typed API.
 */

import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type {
  Item,
  CreateItemInput,
  UpdateItemInput,
  ReorderItemInput,
  BulkUpdateItemInput,
  CreateSubItemInput,
  ProjectItemsData,
  WorkItemState,
  StateGroup,
  ProjectMember,
  Relation,
  Label,
  ActivityLog,
  ItemAttachment,
  Attachments,
  AttachPageItem,
  AttachPaperItem,
  AttachFileItem,
  AttachLinkItem,
  AttachPageInput,
  AttachPaperInput,
  AttachFileInput,
  AttachLinkInput,
} from '../types/work-item.types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateStateInput {
  name: string;
  color?: string;
  icon?: string;
  group: StateGroup;
  sequence?: number;
  isDefault?: boolean;
  description?: string;
}

export interface UpdateStateInput {
  name?: string;
  color?: string;
  icon?: string;
  group?: StateGroup;
  sequence?: number;
  isDefault?: boolean;
  description?: string;
}

export interface ReorderStateItem {
  id: string;
  sequence?: number;
  group?: StateGroup;
  title?: string;
  accentColor?: string;
}

export interface AddRelationInput {
  targetId?: string;
  targetWorkItemId?: string;
  type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of';
}

export interface RelationResponse {
  success: boolean;
  message: string;
  relations?: Relation[];
}

export interface ArchivedItemsResponse {
  archivedItems?: Item[];
  workItems?: Item[];
  count: number;
  total?: number;
}

export interface ProjectAnalyticsDistribution {
  totalItems?: number;
  completedItems?: number;
  completionRate?: number;
  state: Record<string, number>;
  priority: Record<string, number>;
  assignee: Array<{
    userId: string;
    name: string;
    avatar: string | null;
    count: number;
  }>;
}

// ── Unified API Client ──────────────────────────────────────────────────────

export const workItemApi = {
  // ── 1. Items (Core CRUD, Ranking, Hierarchy) ──────────────────────────────
  items: {
    getProjectItems: (projectId: string) =>
      apiGet<ProjectItemsData>(`/api/projects/${projectId}/work-items`),

    getItems: async (): Promise<Item[]> => {
      const response = await apiGet<{ data?: Item[]; workItems?: Item[] } | Item[]>(
        `/api/work-items`,
      );
      if (Array.isArray(response)) return response;
      return response?.data || response?.workItems || [];
    },

    getById: async (id: string): Promise<{ workItem: Item; item: Item }> => {
      const res = await apiGet<{ workItem: Item; item?: Item }>(`/api/work-items/${id}`);
      const item = res.workItem || res.item;
      return { workItem: item, item };
    },

    create: async ({ projectId, ...data }: CreateItemInput & { projectId: string }): Promise<{ workItem: Item; item: Item }> => {
      const res = await apiPost<{ workItem: Item; item?: Item }>(`/api/projects/${projectId}/work-items`, data);
      const item = res.workItem || res.item;
      return { workItem: item, item };
    },

    update: async ({
      id,
      workItemId,
      projectId: _projectId,
      ...data
    }: { id?: string; workItemId?: string; projectId?: string } & UpdateItemInput): Promise<{ workItem: Item; item: Item }> => {
      const targetId = id || workItemId || '';
      const res = await apiPut<{ workItem: Item; item?: Item }>(`/api/work-items/${targetId}`, data);
      const item = res.workItem || res.item;
      return { workItem: item, item };
    },

    delete: (id: string) =>
      apiDelete(`/api/work-items/${id}`),

    duplicate: async ({
      id,
      workItemId,
      itemId,
      projectId,
    }: { id?: string; workItemId?: string; itemId?: string; projectId: string }): Promise<{ workItem: Item; item: Item }> => {
      const targetId = id || workItemId || itemId || '';
      const res = await apiPost<{ workItem: Item; item?: Item; message?: string }>(`/api/work-items/${targetId}/duplicate`, { projectId });
      const item = res.workItem || res.item;
      return { workItem: item, item };
    },

    createChild: async (id: string, data: CreateSubItemInput): Promise<{ workItem: Item; item: Item }> => {
      const res = await apiPost<{ workItem: Item; item?: Item }>(`/api/work-items/${id}/children`, data);
      const item = res.workItem || res.item;
      return { workItem: item, item };
    },

    convertToRoot: async (id: string): Promise<{ workItem: Item; item: Item }> => {
      const res = await apiPost<{ workItem: Item; item?: Item; message?: string }>(`/api/work-items/${id}/convert-to-root`);
      const item = res.workItem || res.item;
      return { workItem: item, item };
    },

    reorder: ({
      projectId,
      id,
      workItemId,
      columnId,
      rank,
    }: ReorderItemInput) => {
      const targetId = id || workItemId || '';
      const payload = { workItemId: targetId, id: targetId, columnId, rank };
      return projectId
        ? apiPut<{ message: string }>(`/api/projects/${projectId}/work-items/reorder`, payload)
        : apiPut<{ message: string }>(`/api/work-items/${targetId}/reorder`, payload);
    },

    bulkUpdate: ({
      ids,
      itemIds,
      workItemIds,
      data,
      projectId,
    }: BulkUpdateItemInput) => {
      const targetIds = ids || itemIds || workItemIds || [];
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
      const targetIds = ids || itemIds || workItemIds || [];
      const payload = { workItemIds: targetIds, ids: targetIds, ...(projectId && { projectId }) };
      return projectId
        ? apiPost(`/api/projects/${projectId}/work-items/bulk-delete`, payload)
        : apiPost(`/api/work-items/bulk-delete`, payload);
    },

    getProjectWorkItems: (projectId: string) =>
      workItemApi.items.getProjectItems(projectId),
    getWorkItems: () =>
      workItemApi.items.getItems(),
    getWorkItemById: (id: string) =>
      workItemApi.items.getById(id),
    createChildWorkItem: (id: string, data: CreateSubItemInput) =>
      workItemApi.items.createChild(id, data),
    createSubItem: (id: string, data: CreateSubItemInput) =>
      workItemApi.items.createChild(id, data),
    convertToRootWorkItem: (id: string) =>
      workItemApi.items.convertToRoot(id),
    reorderWorkItem: (input: ReorderItemInput) =>
      workItemApi.items.reorder(input),
  },

  // ── 2. Workflow States (Kanban Columns) ────────────────────────────────────
  states: {
    getStates: async (projectId: string): Promise<WorkItemState[]> => {
      const res = await apiGet<WorkItemState[] | { states?: WorkItemState[]; columns?: WorkItemState[] }>(`/api/projects/${projectId}/states`);
      if (Array.isArray(res)) return res as WorkItemState[];
      return res?.states || res?.columns || [];
    },

    getStateCounts: (projectId: string): Promise<Record<string, number>> =>
      apiGet<Record<string, number>>(`/api/projects/${projectId}/states/counts`),

    createState: (projectId: string, data: CreateStateInput) =>
      apiPost<{ state: WorkItemState; states: WorkItemState[]; columns: WorkItemState[] }>(
        `/api/projects/${projectId}/states`,
        data,
      ),

    updateState: (projectId: string, stateId: string, data: UpdateStateInput) =>
      apiPut<{ state: WorkItemState; states: WorkItemState[]; columns: WorkItemState[] }>(
        `/api/projects/${projectId}/states/${stateId}`,
        data,
      ),

    reorderStates: (projectId: string, states: ReorderStateItem[]) =>
      apiPut<{ states: WorkItemState[]; columns: WorkItemState[] }>(
        `/api/projects/${projectId}/states/reorder`,
        { states },
      ),

    deleteState: (projectId: string, stateId: string, fallbackStateId?: string) =>
      apiDelete<{ success: boolean; states: WorkItemState[]; columns: WorkItemState[]; migratedTo?: string }>(
        `/api/projects/${projectId}/states/${stateId}${
          fallbackStateId ? `?targetStateId=${fallbackStateId}&fallbackStateId=${fallbackStateId}` : ''
        }`,
      ),

    resetStates: (projectId: string) =>
      apiPost<{ states: WorkItemState[]; columns: WorkItemState[] }>(
        `/api/projects/${projectId}/states/reset`,
        {},
      ),
  },

  // ── 3. Assignments & Members ──────────────────────────────────────────────
  assignments: {
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

    subscribeMe: (projectId: string, itemId: string) =>
      apiPost<{ message: string; workItem: Item; item?: Item }>(
        `/api/projects/${projectId}/work-items/${itemId}/subscribers/me`,
      ),

    unsubscribeMe: (projectId: string, itemId: string) =>
      apiDelete<{ message: string; workItem: Item; item?: Item }>(
        `/api/projects/${projectId}/work-items/${itemId}/subscribers/me`,
      ),
  },

  // ── 4. Relations (Dependencies) ───────────────────────────────────────────
  relations: {
    getRelations: (itemId: string) =>
      apiGet<{ relations: Relation[] }>(`/api/work-items/${itemId}/relations`),

    addRelation: (itemId: string, input: AddRelationInput) => {
      const target = input.targetWorkItemId || input.targetId || '';
      return apiPost<RelationResponse>(`/api/work-items/${itemId}/relations`, {
        targetWorkItemId: target,
        type: input.type,
      });
    },

    removeRelation: (itemId: string, targetId: string) =>
      apiDelete<RelationResponse>(`/api/work-items/${itemId}/relations/${targetId}`),

    getViolations: (itemId: string) =>
      apiGet<unknown[]>(`/api/work-items/${itemId}/relations/violations`),
  },

  // ── 5. Labels & Tags ──────────────────────────────────────────────────────
  labels: {
    getProjectLabels: async (projectId: string): Promise<Label[]> => {
      const data = await apiGet<{ labels?: Label[] }>(`/api/projects/${projectId}/labels`);
      return data.labels ?? [];
    },

    list: async (projectId?: string, type?: string): Promise<Label[]> => {
      if (projectId && projectId !== 'me') {
        return workItemApi.labels.getProjectLabels(projectId);
      }
      const params = new URLSearchParams();
      const normalizedType = type === 'work-item' ? 'work_item' : type;
      if (normalizedType) params.append('type', normalizedType);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const data = await apiGet<Label[] | { labels?: Label[]; data?: Label[] }>(`/api/labels${queryStr}`);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.labels)) return data.labels;
      if (Array.isArray(data?.data)) return data.data;
      return [];
    },
  },

  // ── 6. Comments & Discussions ─────────────────────────────────────────────
  comments: {
    getComments: (itemId: string) =>
      apiGet<ActivityLog[] | { comments?: ActivityLog[]; data?: ActivityLog[] }>(`/api/work-items/${itemId}/comments`),

    addComment: (itemId: string, content: string) =>
      apiPost<ActivityLog>(`/api/work-items/${itemId}/comments`, { content }),

    updateComment: (itemId: string, commentId: string, content: string) =>
      apiPut<{ comment: ActivityLog }>(`/api/work-items/comments/${commentId}`, { content }),

    reactComment: (itemId: string, commentId: string, emoji: string) =>
      apiPost<{ comment: ActivityLog }>(`/api/work-items/comments/${commentId}/reactions`, { emoji }),

    deleteComment: (itemId: string, commentId: string) =>
      apiDelete(`/api/work-items/comments/${commentId}`),

    addReply: (commentId: string, content: string) =>
      apiPost<{ message: string; reply: unknown }>(`/api/work-items/comments/${commentId}/replies`, { content }),
  },

  // ── 7. Attachments & Entity Links ─────────────────────────────────────────
  attachments: {
    presignAttachment: (itemId: string, data: { filename: string; mimeType?: string; size?: number }) =>
      apiPost<{ uploadUrl: string; storageKey: string; publicUrl: string }>(
        `/api/work-items/${itemId}/attachments/presign`,
        data,
      ),

    getWorkItemAttachments: (itemId: string) =>
      apiGet<{
        workItemId?: string;
        total?: number;
        attachments?: ItemAttachment[];
        center?: Attachments;
        pages?: AttachPageItem[];
        papers?: AttachPaperItem[];
        files?: AttachFileItem[];
        links?: AttachLinkItem[];
      }>(`/api/work-items/${itemId}/attachments`),

    getAttachment: (attachmentId: string) =>
      apiGet<unknown>(`/api/attachments/${attachmentId}`),

    uploadFile: async (
      itemId: string,
      file: File,
      options?: { projectId?: string },
    ) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      if (options?.projectId) {
        formData.append('projectId', options.projectId);
      }
      return apiPost<{ file: AttachFileItem; workItem?: Item }>(
        `/api/work-items/${itemId}/attachments/upload`,
        formData,
      );
    },

    uploadAttachment: (itemId: string, formData: FormData) =>
      apiPost(`/api/work-items/${itemId}/attachments/upload`, formData),

    deleteAttachment: (itemId: string, attachmentId: string) =>
      apiDelete(`/api/work-items/${itemId}/attachments/${attachmentId}`),

    attachPage: (itemId: string, data: AttachPageInput) =>
      apiPost<{ message: string; workItem: Item; item?: Item; page: AttachPageItem }>(
        `/api/work-items/${itemId}/attach/pages`,
        data,
      ),

    detachPage: (itemId: string, pageId: string) =>
      apiDelete<{ message: string; workItem: Item; item?: Item }>(
        `/api/work-items/${itemId}/attach/pages/${pageId}`,
      ),

    attachPaper: (itemId: string, data: AttachPaperInput) =>
      apiPost<{ message: string; workItem: Item; item?: Item; paper: AttachPaperItem }>(
        `/api/work-items/${itemId}/attach/papers`,
        data,
      ),

    detachPaper: (itemId: string, paperId: string) =>
      apiDelete<{ message: string; workItem: Item; item?: Item }>(
        `/api/work-items/${itemId}/attach/papers/${paperId}`,
      ),

    attachFile: (itemId: string, data: AttachFileInput) =>
      apiPost<{ message: string; workItem: Item; item?: Item; file: AttachFileItem }>(
        `/api/work-items/${itemId}/attach/files`,
        data,
      ),

    detachFile: (itemId: string, fileId: string) =>
      apiDelete<{ message: string; workItem: Item; item?: Item }>(
        `/api/work-items/${itemId}/attach/files/${fileId}`,
      ),

    attachLink: (itemId: string, data: AttachLinkInput) =>
      apiPost<{ message: string; workItem: Item; item?: Item; link: AttachLinkItem }>(
        `/api/work-items/${itemId}/attach/links`,
        data,
      ),

    detachLink: (itemId: string, linkIndex: number) =>
      apiDelete<{ message: string; workItem: Item; item?: Item }>(
        `/api/work-items/${itemId}/attach/links/${linkIndex}`,
      ),
  },

  // ── 8. History & Activities ───────────────────────────────────────────────
  history: {
    getActivityLogs: (itemId: string) =>
      apiGet<ActivityLog[] | { activities?: ActivityLog[]; data?: ActivityLog[] }>(
        `/api/work-items/${itemId}/activity`,
      ),
  },

  // ── 9. Archive & Retention ────────────────────────────────────────────────
  archive: {
    archive: (id: string) =>
      apiPost<{ message: string; workItem?: Item; item?: Item }>(`/api/work-items/${id}/archive`),

    archiveWorkItem: (id: string) =>
      apiPost<{ message: string; workItem?: Item; item?: Item }>(`/api/work-items/${id}/archive`),

    restore: (id: string) =>
      apiPost<{ message: string; workItem?: Item; item?: Item }>(`/api/work-items/${id}/restore`),

    restoreWorkItem: (id: string) =>
      apiPost<{ message: string; workItem?: Item; item?: Item }>(`/api/work-items/${id}/restore`),

    bulkArchive: (ids: string[], projectId?: string) => {
      const payload = { workItemIds: ids, ids, ...(projectId && { projectId }) };
      return projectId
        ? apiPost<{ message: string; count: number }>(`/api/projects/${projectId}/work-items/bulk-archive`, payload)
        : apiPost<{ message: string; count: number }>(`/api/work-items/bulk-archive`, payload);
    },

    bulkRestore: (ids: string[], projectId?: string) => {
      const payload = { workItemIds: ids, ids, ...(projectId && { projectId }) };
      return projectId
        ? apiPost<{ message: string; count: number }>(`/api/projects/${projectId}/work-items/bulk-restore`, payload)
        : apiPost<{ message: string; count: number }>(`/api/work-items/bulk-restore`, payload);
    },

    getArchived: (projectId: string) =>
      apiGet<ArchivedItemsResponse | Item[]>(`/api/work-items/projects/${projectId}/archived`),

    getArchivedWorkItems: (projectId: string) =>
      apiGet<ArchivedItemsResponse | Item[]>(`/api/work-items/projects/${projectId}/archived`),
  },

  // ── 10. Analytics ─────────────────────────────────────────────────────────
  analytics: {
    getProjectAnalytics: (projectId: string) =>
      apiGet<ProjectAnalyticsDistribution>(`/api/v1/projects/${projectId}/analytics`),
  },
} as const;

// ── Aliases & Backward Compatibility ─────────────────────────────────────────
export const CoreService = workItemApi.items;
export const StateService = workItemApi.states;
export const AssignmentService = workItemApi.assignments;
export const RelationService = workItemApi.relations;
export const LabelService = workItemApi.labels;
export const CommentService = workItemApi.comments;
export const AttachmentService = workItemApi.attachments;
export const HistoryService = workItemApi.history;
export const ArchiveService = workItemApi.archive;
export const AnalyticsService = workItemApi.analytics;



export const AVAILABLE_LABEL_COLORS = [
  { name: "green_subtle", color: "#baf3db" },
  { name: "yellow_subtle", color: "#f8e6a0" },
  { name: "orange_subtle", color: "#fedec8" },
  { name: "red_subtle", color: "#ffd5d2" },
  { name: "purple_subtle", color: "#dfd8fd" },
  { name: "green", color: "#4bce97" },
  { name: "yellow", color: "#f5cd47" },
  { name: "orange", color: "#fea362" },
  { name: "red", color: "#f87168" },
  { name: "purple", color: "#9f8fef" },
  { name: "green_bold", color: "#1f845a" },
  { name: "yellow_bold", color: "#946f00" },
  { name: "orange_bold", color: "#c25100" },
  { name: "red_bold", color: "#c9372c" },
  { name: "purple_bold", color: "#6e5dc6" },
  { name: "blue_subtle", color: "#cce0ff" },
  { name: "sky_subtle", color: "#c6edfb" },
  { name: "lime_subtle", color: "#d3f1a7" },
  { name: "pink_subtle", color: "#fdd0ec" },
  { name: "grey_subtle", color: "#dcdfe4" },
  { name: "blue", color: "#579dff" },
  { name: "sky", color: "#60c6d2" },
  { name: "lime", color: "#94c748" },
  { name: "pink", color: "#e774bb" },
  { name: "grey", color: "#8590a2" },
  { name: "blue_bold", color: "#0c66e4" },
  { name: "sky_bold", color: "#1d7f8c" },
  { name: "lime_bold", color: "#5b7f24" },
  { name: "pink_bold", color: "#ae4787" },
  { name: "grey_bold", color: "#44546f" },
];

export const DEFAULT_LABEL_COLOR = "#4bce97";

export const fetchLabels = workItemApi.labels.list;

export default workItemApi;
