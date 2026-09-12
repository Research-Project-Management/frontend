'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUpload } from "@/shared/hooks/use-upload";
import {
  TaskService,
  ArchiveService,
  DraftService,
  TemplateService,
  UpdateService,
  AssignmentService,
  type WorkItemDraftRecord,
  type WorkItemTemplateRecord,
  type WorkItemUpdateRecord,
} from '../services/service';
import { RelationService } from '../services/relation.service';
import { LabelService, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from '../services/label.service';
import { projectKeys } from '@/features/workspaces/projects/shell/services/project.service';
import type {
  Task,
  Column,
  Project,
  ProjectMember,
  Cycle,
  Priority,
  CreateTaskInput,
  UpdateTaskInput,
  ReorderTaskInput,
  BulkUpdateTaskInput,
  CreateSubtaskInput,
  AttachPageInput,
  AttachPaperInput,
  AttachFileInput,
  AttachLinkInput,
} from '../types/types';
import {
  createTaskSchema,
  updateTaskSchema,
  reorderTaskSchema,
  bulkUpdateTaskSchema,
  createSubtaskSchema,
  attachPageInputSchema,
  attachPaperInputSchema,
  attachFileInputSchema,
  attachLinkInputSchema,
} from '../schemas/schema';
import {
  DEFAULT_STATES,
  normalizeStates,
} from '../types/types';
import type { Label, CreateLabelInput, UpdateLabelInput } from '../types/label.types';

import { WorkItemHelpers, TaskHelpers } from '../utils/util';

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR, WorkItemHelpers, TaskHelpers };

// ── 2. Query Keys ───────────────────────────────────────────────────────────

export const taskKeys = {
  all: ['tasks'] as const,
  project: (projectId: string, cycleId?: string) => ['tasks', projectId, cycleId] as const,
  workspace: (workspaceId: string) => ['workspace-tasks', workspaceId] as const,
  cycles: (projectId: string) => ['cycles', projectId] as const,
  comments: (taskId: string) => ['task-comments', taskId] as const,
  activity: (taskId: string) => ['task-activity', taskId] as const,
  labels: (workspaceId: string, type?: string, projectId?: string) => ['labels', workspaceId, type, projectId] as const,
};

export const workItemKeys = taskKeys;

export const archiveKeys = {
  all: ['archived-tasks'] as const,
  project: (projectId: string) => ['archived-tasks', projectId] as const,
};

export const draftKeys = {
  all: ['drafts'] as const,
  project: (projectId?: string) => ['drafts', projectId || 'global'] as const,
  detail: (id: string) => ['draft', id] as const,
};

export const templateKeys = {
  all: ['templates'] as const,
  project: (projectId: string) => ['templates', projectId] as const,
  detail: (projectId: string, id: string) => ['template', projectId, id] as const,
};

export const updateKeys = {
  all: ['task-updates'] as const,
  task: (taskId: string, projectId?: string) =>
    projectId
      ? (['task-updates', taskId, projectId] as const)
      : (['task-updates', taskId] as const),
  latest: (taskId: string, projectId?: string) =>
    projectId
      ? (['task-updates-latest', taskId, projectId] as const)
      : (['task-updates-latest', taskId] as const),
};

export const assignmentKeys = {
  eligible: (projectId: string) => ['eligible-assignees', projectId] as const,
};

// ── 3. Granular Query Hooks (API Bridge) ────────────────────────────────────

export const useProjectTasks = (projectId: string, cycleId?: string) =>
  useQuery({
    queryKey: taskKeys.project(projectId, cycleId),
    queryFn: () => TaskService.getProjectTasks(projectId, cycleId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

export const useProjectWorkItems = useProjectTasks;
export const useTask = useProjectTasks;

export const useWorkspaceTasks = (workspaceId: string) =>
  useQuery({
    queryKey: taskKeys.workspace(workspaceId),
    queryFn: () => TaskService.getWorkspaceTasks(workspaceId),
    enabled: Boolean(workspaceId),
  });

export const useTaskCycles = (projectId: string) =>
  useQuery({
    queryKey: taskKeys.cycles(projectId),
    queryFn: () => TaskService.getProjectCycles(projectId),
    enabled: Boolean(projectId),
  });

export const useTaskComments = (taskId: string) =>
  useQuery({
    queryKey: taskKeys.comments(taskId),
    queryFn: async () => {
      const res = await TaskService.getComments(taskId);
      if (Array.isArray(res)) return res;
      if (res && 'comments' in res && Array.isArray(res.comments)) return res.comments;
      if (res && 'data' in res && Array.isArray(res.data)) return res.data;
      return [];
    },
    enabled: Boolean(taskId),
  });

export const useTaskActivityLogs = (taskId: string) =>
  useQuery({
    queryKey: taskKeys.activity(taskId),
    queryFn: async () => {
      try {
        const res = await TaskService.getActivityLogs(taskId);
        if (Array.isArray(res)) return res;
        if (res && 'activities' in res && Array.isArray(res.activities)) return res.activities;
        if (res && 'data' in res && Array.isArray(res.data)) return res.data;
        return [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(taskId),
  });

export const useTaskWorkspaceProjects = (workspaceId: string) =>
  useQuery({
    queryKey: projectKeys.all(workspaceId),
    queryFn: async () => {
      const res = await TaskService.getWorkspaceProjects(workspaceId);
      if (Array.isArray(res)) return res;
      if (res && typeof res === 'object' && 'projects' in res && Array.isArray((res as { projects: unknown[] }).projects)) {
        return (res as { projects: unknown[] }).projects;
      }
      return [];
    },
    enabled: Boolean(workspaceId),
  });

export const useTaskProjectDetails = (projectId: string) =>
  useQuery({
    queryKey: ['project-details', projectId],
    queryFn: () => TaskService.getProjectDetails(projectId),
    enabled: Boolean(projectId),
  });

export const useLabelsQuery = (workspaceId: string, type?: string, projectId?: string) =>
  useQuery({
    queryKey: taskKeys.labels(workspaceId, type, projectId),
    queryFn: () => LabelService.list(workspaceId, type, projectId),
    enabled: Boolean(workspaceId),
  });

// ── 4. Granular Mutation Hooks ──────────────────────────────────────────────

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput & { projectId: string }) => {
      const parsed = createTaskSchema.safeParse(input);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || 'Invalid work item data';
        throw new Error(errorMsg);
      }
      return TaskService.create(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Task created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create task'),
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, projectId, data, ...rest }: { taskId: string; projectId?: string; data?: Partial<UpdateTaskInput> } & Partial<UpdateTaskInput>) => {
      const { projectId: _ignored, ...cleanPayload } = { ...(data || {}), ...rest } as Record<string, unknown>;
      const parsed = updateTaskSchema.safeParse(cleanPayload);
      if (!parsed.success) {
        const errorMsg = parsed.error.issues[0]?.message || 'Invalid update data';
        throw new Error(errorMsg);
      }
      return TaskService.update({ taskId, projectId, ...cleanPayload });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update task'),
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId?: string }) => TaskService.delete(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Task deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete task'),
  });
};

export const useDuplicateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { taskId: string; projectId: string }) => TaskService.duplicate(vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Task duplicated');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to duplicate task'),
  });
};

export const useBulkUpdateTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: BulkUpdateTaskInput) => {
      const parsed = bulkUpdateTaskSchema.safeParse(vars);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid bulk update data');
      }
      return TaskService.bulkUpdate(vars);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      if (vars.taskIds && vars.taskIds.length > 0) {
        toast.success(`Updated ${vars.taskIds.length} items`);
      } else {
        toast.success('Tasks updated');
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update tasks'),
  });
};

export const useBulkDeleteTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskIds, projectId }: { taskIds: string[]; projectId?: string }) =>
      TaskService.bulkDelete({ taskIds, projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Tasks deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete tasks'),
  });
};

export const useCreateSubtask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, ...data }: { taskId: string } & CreateSubtaskInput) => {
      const parsed = createSubtaskSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid subtask data');
      }
      return TaskService.createSubtask(taskId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Subtask created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create subtask'),
  });
};

export const useReorderTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ReorderTaskInput) => {
      const parsed = reorderTaskSchema.safeParse(params);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid reorder data');
      }
      return TaskService.reorderTask(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to reorder task'),
  });
};

export const useAttachPage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, pageId, title }: { taskId: string } & AttachPageInput) => {
      const parsed = attachPageInputSchema.safeParse({ pageId, title });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid page attachment input');
      }
      return TaskService.attachPage(taskId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Page attached to work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach page'),
  });
};

export const useDetachPage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, pageId }: { taskId: string; pageId: string }) =>
      TaskService.detachPage(taskId, pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Page detached');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to detach page'),
  });
};

export const useAttachPaper = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      paperId,
      title,
      doi,
      citationKey,
    }: {
      taskId: string;
    } & AttachPaperInput) => {
      const parsed = attachPaperInputSchema.safeParse({ paperId, title, doi, citationKey });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid paper attachment input');
      }
      return TaskService.attachPaper(taskId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Paper attached to work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach paper'),
  });
};

export const useDetachPaper = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, paperId }: { taskId: string; paperId: string }) =>
      TaskService.detachPaper(taskId, paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Paper detached');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to detach paper'),
  });
};

export const useAttachFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      name,
      url,
      size,
      type,
    }: {
      taskId: string;
    } & AttachFileInput) => {
      const parsed = attachFileInputSchema.safeParse({ name, url, size, type });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid file attachment input');
      }
      return TaskService.attachFile(taskId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('File attached');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach file'),
  });
};

export const useDetachFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, fileId }: { taskId: string; fileId: string }) =>
      TaskService.detachFile(taskId, fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('File removed');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove file'),
  });
};

export const useAttachLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, title, url }: { taskId: string } & AttachLinkInput) => {
      const parsed = attachLinkInputSchema.safeParse({ title, url });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid link attachment input');
      }
      return TaskService.attachLink(taskId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Link attached');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach link'),
  });
};

export const useDetachLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, linkIndex }: { taskId: string; linkIndex: number }) =>
      TaskService.detachLink(taskId, linkIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Link removed');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove link'),
  });
};

export const useAddComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      TaskService.addComment(taskId, content),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['comments', vars.taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add comment'),
  });
};

export const useDeleteComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      TaskService.deleteComment(taskId, commentId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['comments', vars.taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete comment'),
  });
};

export const useUpdateComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId, content }: { taskId: string; commentId: string; content: string }) =>
      TaskService.updateComment(taskId, commentId, content),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['comments', vars.taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update comment'),
  });
};

export const useReactComment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId, emoji }: { taskId: string; commentId: string; emoji: string }) =>
      TaskService.reactComment(taskId, commentId, emoji),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['comments', vars.taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to react to comment'),
  });
};

export const useConvertToRootTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: string) =>
      TaskService.convertToRootTask(subtaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Converted to root task');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to convert subtask'),
  });
};

export const useAddRelationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, targetTaskId, type }: { taskId: string; targetTaskId: string; type: 'blocks' | 'blocked_by' | 'relates_to' | 'duplicate_of' }) =>
      RelationService.addRelation(taskId, { targetTaskId, type }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-relations', vars.taskId] });
      queryClient.invalidateQueries({ queryKey: ['task-relations', vars.targetTaskId] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to add relation'),
  });
};

export const useRemoveRelationMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, relationId, targetTaskId }: { taskId: string; relationId?: string; targetTaskId?: string }) =>
      RelationService.removeRelation(taskId, targetTaskId || relationId || ''),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-relations', vars.taskId] });
      if (vars.targetTaskId) {
        queryClient.invalidateQueries({ queryKey: ['task-relations', vars.targetTaskId] });
      }
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove relation'),
  });
};

export const useCreateLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLabelInput & { projectId?: string }) => LabelService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      queryClient.invalidateQueries({ queryKey: ['project-labels'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create label'),
  });
};

export const useUpdateLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLabelInput & { projectId?: string }) => LabelService.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      queryClient.invalidateQueries({ queryKey: ['project-labels'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update label'),
  });
};

export const useDeleteLabel = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { labelId: string; projectId?: string }) => {
      const labelId = typeof input === 'string' ? input : input.labelId;
      const projectId = typeof input === 'string' ? undefined : input.projectId;
      return LabelService.delete(labelId, projectId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
      queryClient.invalidateQueries({ queryKey: ['project-labels'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete label'),
  });
};

// ── Column Mutation Hooks ───────────────────────────────────────────────────

export const useAddColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...data }: { projectId: string; title: string; accentColor?: string; id?: string }) =>
      TaskService.addColumn(projectId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.project(vars.projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-details', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Column created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create column'),
  });
};

export const useUpdateColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, columnId, data }: { projectId: string; columnId: string; data: { title?: string; accentColor?: string } }) =>
      TaskService.updateColumn(projectId, columnId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.project(vars.projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-details', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Column updated');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update column'),
  });
};

export const useDeleteColumn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, columnId, targetColumnId }: { projectId: string; columnId: string; targetColumnId?: string }) =>
      TaskService.deleteColumn(projectId, columnId, targetColumnId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.project(vars.projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-details', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Column deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete column'),
  });
};

export const useReorderColumns = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, columns }: { projectId: string; columns: Column[] }) =>
      TaskService.reorderColumns(projectId, columns),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.project(vars.projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-details', vars.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Columns reordered');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to reorder columns'),
  });
};

export const useResetColumns = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => TaskService.resetColumns(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: taskKeys.project(projectId) });
      queryClient.invalidateQueries({ queryKey: ['project-details', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Columns reset to default');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to reset columns'),
  });
};

// ── 5. Main Task Project Hook (useTaskProject) ──────────────────────────────

export interface UseTaskProjectOptions {
  projectId: string;
  cycleId?: string;
  workspaceId?: string;
}

export function useTaskProject({ projectId, cycleId, workspaceId }: UseTaskProjectOptions) {
  const tasksQ = useProjectTasks(projectId, cycleId);
  const detailsQ = useTaskProjectDetails(projectId);
  const cyclesQ = useTaskCycles(projectId);
  const labelsQ = useLabelsQuery(workspaceId || '', 'task', projectId);

  const createMut = useCreateTask();
  const updateMut = useUpdateTask();
  const deleteMut = useDeleteTask();
  const duplicateMut = useDuplicateTask();
  const bulkMut = useBulkUpdateTasks();
  const reorderMut = useReorderTask();
  const subtaskMut = useCreateSubtask();
  const addColMut = useAddColumn();
  const updateColMut = useUpdateColumn();
  const deleteColMut = useDeleteColumn();
  const reorderColMut = useReorderColumns();
  const resetColMut = useResetColumns();

  const items = useMemo(() => tasksQ.data?.tasks ?? [], [tasksQ.data?.tasks]);
  const project = useMemo(() => {
    const projectData = detailsQ.data;
    if (!projectData) return undefined;
    return ('project' in projectData && projectData.project ? projectData.project : projectData) as Project | undefined;
  }, [detailsQ.data]);

  const projectTaskColumns = (project as any)?.taskColumns;
  const columns = useMemo(() => {
    const rawCols = tasksQ.data?.columns || (tasksQ.data as any)?.states;
    if (Array.isArray(rawCols) && rawCols.length > 0) return normalizeStates(rawCols);
    if (Array.isArray(projectTaskColumns) && projectTaskColumns.length > 0) return normalizeStates(projectTaskColumns);
    return [...DEFAULT_STATES];
  }, [tasksQ.data, projectTaskColumns]);
  const members = useMemo(() => (project?.members ?? []) as ProjectMember[], [project?.members]);
  const cycles = useMemo(() => (cyclesQ.data?.cycles ?? []) as Cycle[], [cyclesQ.data?.cycles]);
  const currentCycle = useMemo(
    () => (cycleId ? cycles.find((cycle) => cycle.id === cycleId) : undefined),
    [cycles, cycleId],
  );
  const labels = useMemo(() => labelsQ.data ?? [], [labelsQ.data]);

  const labelMap = useMemo(() => {
    return new Map(labels.map((label) => [label.id, { id: label.id, name: label.name, color: label.color || '#94a3b8' }]));
  }, [labels]);

  const state = {
    items,
    allTasks: items,
    columns,
    project,
    members,
    cycles,
    currentCycle,
    labels,
    labelMap,
    status: {
      isLoading: tasksQ.isLoading || detailsQ.isLoading,
      isError: tasksQ.isError || detailsQ.isError,
      isSaving: updateMut.isPending || createMut.isPending || addColMut.isPending || updateColMut.isPending || deleteColMut.isPending,
      isDeleting: deleteMut.isPending || deleteColMut.isPending,
      error: tasksQ.error || detailsQ.error,
    },
    isLoading: tasksQ.isLoading || detailsQ.isLoading,
    isError: tasksQ.isError || detailsQ.isError,
    error: tasksQ.error || detailsQ.error,
    isSavingTask: updateMut.isPending || createMut.isPending,
    isDeletingTask: deleteMut.isPending,
    isMutatingColumn: addColMut.isPending || updateColMut.isPending || deleteColMut.isPending || reorderColMut.isPending,
  };

  const createMutAsync = createMut.mutateAsync;
  const updateMutAsync = updateMut.mutateAsync;
  const deleteMutAsync = deleteMut.mutateAsync;
  const duplicateMutAsync = duplicateMut.mutateAsync;
  const bulkMutAsync = bulkMut.mutateAsync;
  const addColAsync = addColMut.mutateAsync;
  const updateColAsync = updateColMut.mutateAsync;
  const deleteColAsync = deleteColMut.mutateAsync;
  const reorderColAsync = reorderColMut.mutateAsync;
  const resetColAsync = resetColMut.mutateAsync;
  const reorderMutAsync = reorderMut.mutateAsync;
  const subtaskMutAsync = subtaskMut.mutateAsync;
  const refetchTasks = tasksQ.refetch;
  const refetchDetails = detailsQ.refetch;

  const actions = {
    create: useCallback((payload: Parameters<typeof createMutAsync>[0]) => createMutAsync(payload), [createMutAsync]),
    update: useCallback((payload: Parameters<typeof updateMutAsync>[0]) => updateMutAsync(payload), [updateMutAsync]),
    delete: useCallback((target: { taskId: string; projectId?: string }) => deleteMutAsync(target), [deleteMutAsync]),
    duplicate: useCallback(
      (target: { taskId: string; projectId?: string }) =>
        duplicateMutAsync({ projectId: target.projectId || projectId, taskId: target.taskId }),
      [duplicateMutAsync, projectId],
    ),
    bulk: useCallback((payload: Parameters<typeof bulkMutAsync>[0]) => bulkMutAsync(payload), [bulkMutAsync]),
    refetch: useCallback(() => {
      refetchTasks();
      refetchDetails();
    }, [refetchTasks, refetchDetails]),

    // Column Actions
    addColumn: useCallback(
      (columnInput: { title: string; accentColor?: string; id?: string; projectId?: string }) =>
        addColAsync({ projectId: columnInput.projectId || projectId, ...columnInput }),
      [addColAsync, projectId],
    ),
    updateColumn: useCallback(
      (columnId: string, data: { title?: string; accentColor?: string }, targetProjectId?: string) =>
        updateColAsync({ projectId: targetProjectId || projectId, columnId, data }),
      [updateColAsync, projectId],
    ),
    deleteColumn: useCallback(
      (columnId: string, targetColumnId?: string, targetProjectId?: string) =>
        deleteColAsync({ projectId: targetProjectId || projectId, columnId, targetColumnId }),
      [deleteColAsync, projectId],
    ),
    reorderColumns: useCallback(
      (newColumns: Column[], targetProjectId?: string) =>
        reorderColAsync({ projectId: targetProjectId || projectId, columns: newColumns }),
      [reorderColAsync, projectId],
    ),
    resetColumns: useCallback(
      (targetProjectId?: string) => resetColAsync(targetProjectId || projectId),
      [resetColAsync, projectId],
    ),

    // Aliases
    createTask: useCallback((payload: Parameters<typeof createMutAsync>[0]) => createMutAsync(payload), [createMutAsync]),
    updateTask: useCallback((payload: Parameters<typeof updateMutAsync>[0]) => updateMutAsync(payload), [updateMutAsync]),
    moveTask: useCallback(
      (moveInput: { taskId: string; columnId: string; projectId?: string }) =>
        updateMutAsync({
          projectId: moveInput.projectId || projectId,
          taskId: moveInput.taskId,
          columnId: moveInput.columnId,
        }),
      [updateMutAsync, projectId],
    ),
    deleteTask: useCallback((target: { taskId: string; projectId?: string }) => deleteMutAsync(target), [deleteMutAsync]),
    duplicateTask: useCallback(
      (target: { taskId: string; projectId?: string }) =>
        duplicateMutAsync({ projectId: target.projectId || projectId, taskId: target.taskId }),
      [duplicateMutAsync, projectId],
    ),
    bulkUpdateTasks: useCallback((payload: Parameters<typeof bulkMutAsync>[0]) => bulkMutAsync(payload), [bulkMutAsync]),
    reorderTask: useCallback(
      (reorderInput: { taskId: string; rank: number; columnId?: string; projectId?: string }) =>
        reorderMutAsync({
          projectId: reorderInput.projectId || projectId,
          taskId: reorderInput.taskId,
          columnId: reorderInput.columnId,
          rank: reorderInput.rank,
        }),
      [reorderMutAsync, projectId],
    ),
    createSubtask: useCallback(
      (subtaskInput: { taskId: string; title: string; columnId?: string; priority?: Priority }) =>
        subtaskMutAsync(subtaskInput),
      [subtaskMutAsync],
    ),
    removeFromCycle: useCallback(
      (taskId: string, callback?: () => void) => {
        updateMutAsync({ taskId, projectId, cycleId: null })
          .then(() => {
            toast.success('Task removed from cycle');
            callback?.();
          })
          .catch((err: any) => {
            toast.error(err?.message || 'Failed to remove task from cycle');
          });
      },
      [updateMutAsync, projectId]
    ),
    assignTasksToDate: useCallback(
      (taskIds: string[], dueDate: string, quiet = false, startDate?: string | null) => {
        if (taskIds.length === 0) return;
        taskIds.forEach((taskId) => {
          const payload: any = { taskId, projectId, dueDate };
          if (startDate !== undefined) payload.startDate = startDate;
          updateMutAsync(payload);
        });
        if (!quiet) {
          toast.success(
            taskIds.length === 1
              ? 'Task added to calendar'
              : `${taskIds.length} tasks added to calendar`
          );
        }
      },
      [updateMutAsync, projectId]
    ),
    notifyAnalyticsComingSoon: useCallback(() => {
      toast.info('Analytics is coming soon');
    }, []),
  };

  return { state, actions };
}

// ── 6. Labels Manager Hook (useLabels) ──────────────────────────────────────

export function useLabels(workspaceId: string, type?: string, projectId?: string) {
  const { data: labels = [] } = useLabelsQuery(workspaceId, type, projectId);
  const createMut = useCreateLabel();
  const updateMut = useUpdateLabel();
  const deleteMut = useDeleteLabel();

  const createLabelMutateAsync = createMut.mutateAsync;
  const updateLabelMutateAsync = updateMut.mutateAsync;
  const deleteLabelMutateAsync = deleteMut.mutateAsync;

  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_LABEL_COLOR);

  const filtered = useMemo(() => {
    return (labels as Label[]).filter((label) => label.name.toLowerCase().includes(search.toLowerCase()));
  }, [labels, search]);

  const createNew = useCallback(() => {
    setEditId(null);
    setName('');
    setColor(DEFAULT_LABEL_COLOR);
    setView('create');
  }, []);

  const edit = useCallback((label: { id: string; name: string; color: string }) => {
    setEditId(label.id);
    setName(label.name);
    setColor(label.color);
    setView('edit');
  }, []);

  const save = useCallback(async () => {
    if (!name.trim()) return;
    if (view === 'create') {
      await createLabelMutateAsync({
        workspaceId,
        projectId,
        name: name.trim(),
        color,
        type: type || 'task',
      });
    } else if (view === 'edit' && editId) {
      await updateLabelMutateAsync({
        labelId: editId,
        projectId,
        name: name.trim(),
        color,
      });
    }
    setView('list');
    setName('');
    setEditId(null);
  }, [createLabelMutateAsync, updateLabelMutateAsync, view, name, color, workspaceId, projectId, type, editId]);

  const remove = useCallback(
    async (labelId?: string) => {
      const targetLabelId = labelId || editId;
      if (!targetLabelId) return;
      await deleteLabelMutateAsync({ labelId: targetLabelId, projectId });
      if (editId === targetLabelId) {
        setView('list');
        setName('');
        setEditId(null);
      }
    },
    [deleteLabelMutateAsync, editId, projectId],
  );

  const state = {
    items: labels as Label[],
    labels: labels as Label[],
    filteredLabels: filtered,
    filtered,
    view,
    search,
    labelSearch: search,
    editId,
    editingLabelId: editId,
    name,
    editingName: name,
    color,
    selectedColor: color,
    status: {
      isLoading: false,
      isSaving: createMut.isPending || updateMut.isPending,
      isDeleting: deleteMut.isPending,
    },
    isSaving: createMut.isPending || updateMut.isPending,
    isDeleting: deleteMut.isPending,
  };

  const actions = {
    setView,
    setSearch,
    setLabelSearch: setSearch,
    setName,
    setEditingName: setName,
    setColor,
    setSelectedColor: setColor,
    createNew,
    edit,
    save,
    delete: remove,
    handleCreateNew: createNew,
    handleEdit: edit,
    handleSave: save,
    handleDelete: remove,
  };

  return {
    state,
    actions,
    ...state,
    ...actions,
  };
}

// ── 7. Action Hooks with Toast Encapsulation (No Toasts in Pages/Components) ─

export const useCopyTaskText = () => {
  return useCallback((text: string, successMessage = 'Copied to clipboard') => {
    if (typeof window !== 'undefined' && navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(successMessage);
    }
  }, []);
};

export const useWorkItemDraftNotification = () => {
  const notifyDiscard = useCallback(() => {
    toast.info('Work item creation discarded');
  }, []);
  const notifyCleared = useCallback(() => {
    toast.info('Draft cleared');
  }, []);
  return { notifyDiscard, notifyCleared };
};

export const useTransferTasks = (projectId: string) => {
  const bulkUpdateMutation = useBulkUpdateTasks();
  const { mutateAsync } = bulkUpdateMutation;
  const transferTasks = useCallback(
    async ({
      selectedIds,
      targetCycleId,
      onSuccess,
    }: {
      selectedIds: string[];
      targetCycleId: string;
      onSuccess?: () => void;
    }) => {
      if (!targetCycleId) {
        toast.error('Please select a destination cycle');
        return false;
      }
      if (selectedIds.length === 0) {
        toast.error('Please select at least one task to transfer');
        return false;
      }
      try {
        await mutateAsync({
          taskIds: selectedIds,
          data: { cycleId: targetCycleId === 'unassigned' ? null : targetCycleId },
          projectId,
        });
        toast.success(`Successfully transferred ${selectedIds.length} tasks`);
        onSuccess?.();
        return true;
      } catch {
        toast.error('Failed to transfer tasks');
        return false;
      }
    },
    [mutateAsync, projectId]
  );
  return { transferTasks, isPending: bulkUpdateMutation.isPending };
};

export const useAddExistingTasksToCycle = (projectId: string, currentCycleId: string) => {
  const bulkUpdateMutation = useBulkUpdateTasks();
  const { mutateAsync } = bulkUpdateMutation;
  const addTasks = useCallback(
    async ({
      selectedIds,
      onSuccess,
    }: {
      selectedIds: string[];
      onSuccess?: () => void;
    }) => {
      if (selectedIds.length === 0) {
        toast.error('Please select at least one task');
        return false;
      }
      try {
        await mutateAsync({
          taskIds: selectedIds,
          data: { cycleId: currentCycleId },
          projectId,
        });
        toast.success(`Successfully added ${selectedIds.length} tasks to cycle`);
        onSuccess?.();
        return true;
      } catch {
        toast.error('Failed to add tasks to cycle');
        return false;
      }
    },
    [mutateAsync, projectId, currentCycleId]
  );
  return { addTasks, isPending: bulkUpdateMutation.isPending };
};

export const useConvertSubtaskToRoot = () => {
  const mut = useConvertToRootTask();
  const { mutateAsync } = mut;
  return useCallback(
    async (subtaskId?: string) => {
      if (!subtaskId) {
        toast.error('Cannot convert unsaved subtask');
        return false;
      }
      try {
        await mutateAsync(subtaskId);
        return true;
      } catch {
        return false;
      }
    },
    [mutateAsync]
  );
};

export const useSubtaskNotification = () => {
  const notifySubtaskAdded = useCallback(() => {
    toast.success('Subtask added');
  }, []);
  return { notifySubtaskAdded };
};

export const useUploadFilesWithToast = () => {
  const { uploadFile } = useUpload();
  return useCallback(
    async (
      files: File[],
      options?: {
        showSuccessToast?: boolean;
        successMessage?: string;
        errorMessage?: string;
      }
    ) => {
      try {
        const results = await Promise.all(
          files.map(async (file) => {
            const url = await uploadFile(file);
            return { file, url };
          })
        );
        if (options?.showSuccessToast ?? true) {
          toast.success(options?.successMessage || 'File attached successfully');
        }
        return results;
      } catch (err) {
        toast.error(options?.errorMessage || 'Failed to upload file');
        throw err;
      }
    },
    [uploadFile]
  );
};

export const useUploadAttachmentWithToast = () => {
  const uploadFiles = useUploadFilesWithToast();
  return useCallback(
    async (file: File) => {
      const results = await uploadFiles([file]);
      return results[0]?.url;
    },
    [uploadFiles]
  );
};

// ── Archive Hooks ──────────────────────────────────────────────────────────

export const useArchivedTasks = (projectId: string) =>
  useQuery({
    queryKey: archiveKeys.project(projectId),
    queryFn: () => TaskService.getArchivedTasks(projectId),
    enabled: Boolean(projectId),
  });

export const useArchiveTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => TaskService.archiveTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-tasks'] });
      toast.success('Task archived');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to archive task'),
  });
};

export const useRestoreTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => TaskService.restoreTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-tasks'] });
      toast.success('Task restored');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to restore task'),
  });
};

export const useBulkArchiveTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { taskIds: string[]; projectId?: string }) => TaskService.bulkArchive(vars),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-tasks'] });
      toast.success(`Archived ${vars.taskIds.length} items`);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to bulk archive tasks'),
  });
};

export const useBulkRestoreTasks = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { taskIds: string[]; projectId?: string }) => TaskService.bulkRestore(vars),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['archived-tasks'] });
      toast.success(`Restored ${vars.taskIds.length} items`);
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to bulk restore tasks'),
  });
};

// ── Draft Hooks ────────────────────────────────────────────────────────────

export const useDraftsQuery = (projectId?: string) =>
  useQuery({
    queryKey: draftKeys.project(projectId),
    queryFn: () => DraftService.getDrafts(projectId),
  });

export const useCreateDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreateTaskInput> & { projectId: string }) =>
      DraftService.createDraft(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      toast.success('Draft saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save draft'),
  });
};

export const useUpdateDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTaskInput> }) =>
      DraftService.updateDraft(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update draft'),
  });
};

export const usePublishDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, columnId }: { id: string; columnId?: string }) =>
      DraftService.publishDraft(id, { columnId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Draft published to project');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to publish draft'),
  });
};

export const useDeleteDraftMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => DraftService.deleteDraft(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      toast.success('Draft deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete draft'),
  });
};

// ── Template Hooks ─────────────────────────────────────────────────────────

export const useTemplatesQuery = (projectId: string) =>
  useQuery({
    queryKey: templateKeys.project(projectId),
    queryFn: () => TemplateService.getTemplates(projectId),
    enabled: Boolean(projectId),
  });

export const useCreateTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: {
        name: string;
        description?: string;
        title?: string;
        content?: string;
        priority?: string;
        labels?: string[];
        defaultCycleId?: string;
        defaultColumnId?: string;
        isShared?: boolean;
      };
    }) => TemplateService.createTemplate(projectId, data),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.project(vars.projectId) });
      toast.success('Template saved');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save template'),
  });
};

export const useInstantiateTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      templateId,
      overrides,
    }: {
      projectId: string;
      templateId: string;
      overrides?: Record<string, unknown>;
    }) => TemplateService.instantiateTemplate(projectId, templateId, { overrides }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-tasks'] });
      toast.success('Work item created from template');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to instantiate template'),
  });
};

export const useDeleteTemplateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, templateId }: { projectId: string; templateId: string }) =>
      TemplateService.deleteTemplate(projectId, templateId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.project(vars.projectId) });
      toast.success('Template deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete template'),
  });
};

// ── Update Hooks (Progress Briefing) ───────────────────────────────────────

export const useTaskUpdatesQuery = (taskId: string, projectId?: string) =>
  useQuery({
    queryKey: updateKeys.task(taskId, projectId),
    queryFn: () => UpdateService.getUpdates(taskId, projectId),
    enabled: Boolean(taskId),
  });

export const useTaskLatestUpdateQuery = (taskId: string, projectId?: string) =>
  useQuery({
    queryKey: updateKeys.latest(taskId, projectId),
    queryFn: () => UpdateService.getLatestUpdate(taskId, projectId),
    enabled: Boolean(taskId),
  });

export const useCreateTaskUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      projectId,
      data,
    }: {
      taskId: string;
      projectId?: string;
      data: { content: string; status?: string; percent?: number };
    }) => UpdateService.createUpdate(taskId, data, projectId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.task(vars.taskId) });
      queryClient.invalidateQueries({ queryKey: updateKeys.latest(vars.taskId) });
      toast.success('Progress update posted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to post update'),
  });
};

export const useDeleteTaskUpdateMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      updateId,
      projectId,
    }: {
      taskId: string;
      updateId: string;
      projectId?: string;
    }) => UpdateService.deleteUpdate(taskId, updateId, projectId),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: updateKeys.task(vars.taskId) });
      queryClient.invalidateQueries({ queryKey: updateKeys.latest(vars.taskId) });
      toast.success('Update deleted');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to delete update'),
  });
};

// ── Assignment Hooks ───────────────────────────────────────────────────────

export const useEligibleAssigneesQuery = (projectId: string) =>
  useQuery({
    queryKey: assignmentKeys.eligible(projectId),
    queryFn: () => AssignmentService.getEligibleAssignees(projectId),
    enabled: Boolean(projectId),
  });

export const useJoinTaskMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskId }: { projectId: string; taskId: string }) =>
      AssignmentService.joinTask(projectId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Joined work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to join task'),
  });
};

export const useLeaveTaskMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskId }: { projectId: string; taskId: string }) =>
      AssignmentService.leaveTask(projectId, taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Left work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to leave task'),
  });
};

export const useSetAssigneesMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      taskId,
      assigneeIds,
    }: {
      projectId: string;
      taskId: string;
      assigneeIds: string[];
    }) => AssignmentService.setAssignees(projectId, taskId, assigneeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update assignees'),
  });
};


