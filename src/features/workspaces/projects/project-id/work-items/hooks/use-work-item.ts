'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { WorkItemService, TaskService } from '../services/work-item.service';
import { LabelService, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from '../services/label.service';
import type {
  WorkItem,
  WorkItemMutationInput,
  Task,
  Column,
  Project,
  ProjectMember,
  Cycle,
  TaskMutationInput,
  Checklist,
  TaskAttachment,
} from '../types/work-item.types';
import { FIXED_WORK_ITEM_COLUMNS, FIXED_TASK_COLUMNS } from '../types/work-item.types';
import type { Label, CreateLabelInput, UpdateLabelInput } from '../types/label.types';

import { WorkItemHelpers, TaskHelpers } from '../utils/work-item.util';

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR, WorkItemHelpers, TaskHelpers };

// ── 2. Query Keys ───────────────────────────────────────────────────────────

export const workItemKeys = {
  all: ['tasks'] as const,
  project: (projectId: string, cycleId?: string) => ['tasks', projectId, cycleId] as const,
  workspace: (workspaceId: string) => ['workspace-tasks', workspaceId] as const,
  cycles: (projectId: string) => ['cycles', projectId] as const,
  comments: (taskId: string) => ['task-comments', taskId] as const,
  activity: (taskId: string) => ['task-activity', taskId] as const,
  labels: (wsId: string, type?: string, projId?: string) => ['labels', wsId, type, projId] as const,
};

export const taskKeys = workItemKeys;

// ── 3. Granular Query Hooks (API Bridge) ────────────────────────────────────

export const useProjectWorkItems = (projectId: string, cycleId?: string) =>
  useQuery({
    queryKey: workItemKeys.project(projectId, cycleId),
    queryFn: () => WorkItemService.getProjectWorkItems(projectId, cycleId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

export const useProjectTasks = useProjectWorkItems;

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
      return (res as any)?.comments || (res as any)?.data || [];
    },
    enabled: Boolean(taskId),
  });

export const useTaskActivityLogs = (taskId: string) =>
  useQuery({
    queryKey: taskKeys.activity(taskId),
    queryFn: async () => {
      try {
        const res = await TaskService.getActivityLogs(taskId);
        return (res as any)?.activities ?? (Array.isArray(res) ? res : []);
      } catch {
        return [];
      }
    },
    enabled: Boolean(taskId),
  });

export const useTaskWorkspaceProjects = (workspaceId: string) =>
  useQuery({
    queryKey: ['workspace-projects', workspaceId],
    queryFn: async () => {
      const res = await TaskService.getWorkspaceProjects(workspaceId);
      if (Array.isArray(res)) return res;
      return (res as any)?.projects || (res as any)?.data || [];
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
  const qc = useQueryClient();
  return useMutation({
    mutationFn: TaskService.create,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks', vars.projectId] });
      toast.success('Task created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create task'),
  });
};

export const useUpdateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, projectId, data, ...rest }: { taskId: string; projectId?: string; data?: Partial<TaskMutationInput> } & Partial<TaskMutationInput>) => {
      const payload = { ...(data || {}), ...rest };
      delete (payload as any).projectId;
      return TaskService.update({ taskId, projectId, ...payload });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: Error) => toast.error(e.message || 'Failed to update task'),
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId }: { taskId: string; projectId?: string }) => TaskService.delete(taskId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to delete task'),
  });
};

export const useDuplicateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { taskId: string; projectId: string }) => TaskService.duplicate(vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task duplicated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to duplicate task'),
  });
};

export const useBulkUpdateTasks = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: TaskService.bulkUpdate,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (e: Error) => toast.error(e.message || 'Failed to update tasks'),
  });
};

export const useAddComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      TaskService.addComment(taskId, content),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: taskKeys.comments(vars.taskId) }),
    onError: (e: Error) => toast.error(e.message || 'Failed to add comment'),
  });
};

export const useUpdateComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId, content }: { taskId: string; commentId: string; content: string }) =>
      TaskService.updateComment(taskId, commentId, content),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: taskKeys.comments(vars.taskId) }),
    onError: (e: Error) => toast.error(e.message || 'Failed to update comment'),
  });
};

export const useReactComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId, emoji }: { taskId: string; commentId: string; emoji: string }) =>
      TaskService.reactComment(taskId, commentId, emoji),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: taskKeys.comments(vars.taskId) }),
    onError: (e: Error) => toast.error(e.message || 'Failed to react to comment'),
  });
};

export const useDeleteComment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      TaskService.deleteComment(taskId, commentId),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: taskKeys.comments(vars.taskId) }),
    onError: (e: Error) => toast.error(e.message || 'Failed to delete comment'),
  });
};

export const useCreateLabel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLabelInput) => LabelService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels'] }),
    onError: (e: Error) => toast.error(e.message || 'Failed to create label'),
  });
};

export const useUpdateLabel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateLabelInput) => LabelService.update(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels'] }),
    onError: (e: Error) => toast.error(e.message || 'Failed to update label'),
  });
};

export const useDeleteLabel = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => LabelService.delete(labelId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels'] }),
    onError: (e: Error) => toast.error(e.message || 'Failed to delete label'),
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

  const items = useMemo(() => tasksQ.data?.tasks ?? [], [tasksQ.data?.tasks]);
  const project = useMemo(() => {
    const d = detailsQ.data as any;
    return (d?.project || d) as Project | undefined;
  }, [detailsQ.data]);

  const columns = useMemo(() => {
    const rawCols = tasksQ.data?.columns || (project as any)?.taskColumns;
    if (Array.isArray(rawCols) && rawCols.length > 0) return rawCols;
    return FIXED_TASK_COLUMNS;
  }, [tasksQ.data?.columns, project]);
  const members = useMemo(() => (project?.members ?? []) as ProjectMember[], [project?.members]);
  const cycles = useMemo(() => (cyclesQ.data?.cycles ?? []) as Cycle[], [cyclesQ.data?.cycles]);
  const currentCycle = useMemo(
    () => (cycleId ? cycles.find((c) => c.id === cycleId) : undefined),
    [cycles, cycleId],
  );
  const labels = useMemo(() => labelsQ.data ?? [], [labelsQ.data]);

  const labelMap = useMemo(() => {
    return new Map(labels.map((l: any) => [l.id, { id: l.id, name: l.name, color: l.color }]));
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
      isSaving: updateMut.isPending || createMut.isPending,
      isDeleting: deleteMut.isPending,
      error: tasksQ.error || detailsQ.error,
    },
    isLoading: tasksQ.isLoading || detailsQ.isLoading,
    isError: tasksQ.isError || detailsQ.isError,
    error: tasksQ.error || detailsQ.error,
    isSavingTask: updateMut.isPending || createMut.isPending,
    isDeletingTask: deleteMut.isPending,
  };

  const createMutAsync = createMut.mutateAsync;
  const updateMutMutate = updateMut.mutate;
  const deleteMutAsync = deleteMut.mutateAsync;
  const duplicateMutAsync = duplicateMut.mutateAsync;
  const bulkMutAsync = bulkMut.mutateAsync;
  const refetchTasks = tasksQ.refetch;
  const refetchDetails = detailsQ.refetch;

  const actions = {
    create: useCallback((d: Parameters<typeof createMutAsync>[0]) => createMutAsync(d), [createMutAsync]),
    update: useCallback((d: Parameters<typeof updateMutMutate>[0]) => updateMutMutate(d), [updateMutMutate]),
    delete: useCallback((d: { taskId: string; projectId?: string }) => deleteMutAsync(d), [deleteMutAsync]),
    duplicate: useCallback(
      (d: { taskId: string; projectId?: string }) =>
        duplicateMutAsync({ projectId: d.projectId || projectId, taskId: d.taskId }),
      [duplicateMutAsync, projectId],
    ),
    bulk: useCallback((d: Parameters<typeof bulkMutAsync>[0]) => bulkMutAsync(d), [bulkMutAsync]),
    refetch: useCallback(() => {
      refetchTasks();
      refetchDetails();
    }, [refetchTasks, refetchDetails]),

    // Aliases
    createTask: useCallback((d: Parameters<typeof createMutAsync>[0]) => createMutAsync(d), [createMutAsync]),
    updateTask: useCallback((d: Parameters<typeof updateMutMutate>[0]) => updateMutMutate(d), [updateMutMutate]),
    deleteTask: useCallback((d: { taskId: string; projectId?: string }) => deleteMutAsync(d), [deleteMutAsync]),
    duplicateTask: useCallback(
      (d: { taskId: string; projectId?: string }) =>
        duplicateMutAsync({ projectId: d.projectId || projectId, taskId: d.taskId }),
      [duplicateMutAsync, projectId],
    ),
    bulkUpdateTasks: useCallback((d: Parameters<typeof bulkMutAsync>[0]) => bulkMutAsync(d), [bulkMutAsync]),
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
    return (labels as Label[]).filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));
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
        name: name.trim(),
        color,
        type: type || 'task',
        projectId,
      });
    } else if (view === 'edit' && editId) {
      await updateLabelMutateAsync({
        labelId: editId,
        name: name.trim(),
        color,
      });
    }
    setView('list');
    setName('');
    setEditId(null);
  }, [createLabelMutateAsync, updateLabelMutateAsync, view, name, color, workspaceId, type, projectId, editId]);

  const remove = useCallback(
    async (labelId?: string) => {
      const targetId = labelId || editId;
      if (!targetId) return;
      await deleteLabelMutateAsync(targetId);
      if (editId === targetId) {
        setView('list');
        setName('');
        setEditId(null);
      }
    },
    [deleteLabelMutateAsync, editId],
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
