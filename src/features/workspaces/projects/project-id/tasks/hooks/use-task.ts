'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { TaskService } from '../services/task.service';
import { LabelService, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from '../services/label.service';
import type {
  Task,
  Column,
  Project,
  ProjectMember,
  Cycle,
  TaskMutationInput,
  Checklist,
  TaskAttachment,
} from '../types/task.types';
import { FIXED_TASK_COLUMNS } from '../types/task.types';
import type { Label, CreateLabelInput, UpdateLabelInput } from '../types/label.types';

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR };

// ── 1. Consolidated Task Domain Helpers ─────────────────────────────────────

export const TaskHelpers = {
  getInitials: (name?: string): string => {
    if (!name?.trim()) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  },

  formatActivityTime: (dateStr?: string): string => {
    if (!dateStr) return 'Just now';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Just now';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
  },

  formatDate: (val?: string | null): string => {
    if (!val) return '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  },

  checkOverdue: (val?: string | null): boolean => {
    if (!val) return false;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d.getTime() < now.getTime();
  },

  uniqueLabels: (list?: string[]): string[] => Array.from(new Set(list || [])),

  createSnapshot: (data: Partial<TaskMutationInput>): string =>
    JSON.stringify({
      title: data.title,
      content: data.content,
      description: data.description,
      priority: data.priority,
      labels: data.labels,
      startDate: data.startDate,
      dueDate: data.dueDate,
      assigneeId: data.assigneeId,
      columnId: data.columnId,
      checklists: data.checklists,
      attachments: data.attachments,
    }),

  normalizeChecklists: (items: any[]) => {
    if (!Array.isArray(items)) return [];
    return items.map((c, index) => {
      if (!c.items && (c.text || c.title !== undefined)) {
        return {
          title: c.name || 'Checklist',
          items: [{
            title: c.text || c.title || '',
            completed: Boolean(c.completed),
            assigneeId: c.assigneeId,
            dueDate: c.dueDate,
          }],
        };
      }
      return {
        title: c.title || `Checklist ${index + 1}`,
        items: (Array.isArray(c.items) ? c.items : []).map((i: any) => ({
          title: i.title || i.text || '',
          completed: Boolean(i.completed),
          assigneeId: i.assigneeId,
          dueDate: i.dueDate,
        })),
      };
    });
  },
};

// ── 2. Query Keys ───────────────────────────────────────────────────────────

export const taskKeys = {
  all: ['tasks'] as const,
  project: (projectId: string, cycleId?: string) => ['tasks', projectId, cycleId] as const,
  workspace: (workspaceId: string) => ['workspace-tasks', workspaceId] as const,
  cycles: (projectId: string) => ['cycles', projectId] as const,
  comments: (taskId: string) => ['task-comments', taskId] as const,
  activity: (taskId: string) => ['task-activity', taskId] as const,
  labels: (wsId: string, type?: string, projId?: string) => ['labels', wsId, type, projId] as const,
};

// ── 3. Granular Query Hooks (API Bridge) ────────────────────────────────────

export const useProjectTasks = (projectId: string, cycleId?: string) =>
  useQuery({
    queryKey: taskKeys.project(projectId, cycleId),
    queryFn: () => TaskService.getProjectTasks(projectId, cycleId),
    enabled: Boolean(projectId),
    staleTime: 30_000,
  });

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
  const columns = useMemo(() => {
    const rawCols = tasksQ.data?.columns;
    if (Array.isArray(rawCols) && rawCols.length > 0) return rawCols;
    return FIXED_TASK_COLUMNS;
  }, [tasksQ.data?.columns]);

  const project = useMemo(() => detailsQ.data as Project | undefined, [detailsQ.data]);
  const members = useMemo(() => (project?.members ?? []) as ProjectMember[], [project?.members]);
  const cycles = useMemo(() => (cyclesQ.data?.cycles ?? []) as Cycle[], [cyclesQ.data?.cycles]);
  const currentCycle = useMemo(
    () => (cycleId ? cycles.find((c) => c._id === cycleId) : undefined),
    [cycles, cycleId],
  );
  const labels = useMemo(() => labelsQ.data ?? [], [labelsQ.data]);

  const labelMap = useMemo(() => {
    return new Map(labels.map((l: any) => [l._id, { _id: l._id, name: l.name, color: l.color }]));
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

  const actions = {
    create: useCallback((d: Parameters<typeof createMut.mutateAsync>[0]) => createMut.mutateAsync(d), [createMut]),
    update: useCallback((d: Parameters<typeof updateMut.mutate>[0]) => updateMut.mutate(d), [updateMut]),
    delete: useCallback((d: { taskId: string; projectId?: string }) => deleteMut.mutateAsync(d), [deleteMut]),
    duplicate: useCallback(
      (d: { taskId: string; projectId?: string }) =>
        duplicateMut.mutateAsync({ projectId: d.projectId || projectId, taskId: d.taskId }),
      [duplicateMut, projectId],
    ),
    bulk: useCallback((d: Parameters<typeof bulkMut.mutateAsync>[0]) => bulkMut.mutateAsync(d), [bulkMut]),
    refetch: useCallback(() => {
      tasksQ.refetch();
      detailsQ.refetch();
    }, [tasksQ, detailsQ]),

    // Aliases
    createTask: useCallback((d: Parameters<typeof createMut.mutateAsync>[0]) => createMut.mutateAsync(d), [createMut]),
    updateTask: useCallback((d: Parameters<typeof updateMut.mutate>[0]) => updateMut.mutate(d), [updateMut]),
    deleteTask: useCallback((d: { taskId: string; projectId?: string }) => deleteMut.mutateAsync(d), [deleteMut]),
    duplicateTask: useCallback(
      (d: { taskId: string; projectId?: string }) =>
        duplicateMut.mutateAsync({ projectId: d.projectId || projectId, taskId: d.taskId }),
      [duplicateMut, projectId],
    ),
    bulkUpdateTasks: useCallback((d: Parameters<typeof bulkMut.mutateAsync>[0]) => bulkMut.mutateAsync(d), [bulkMut]),
  };

  return { state, actions };
}

// ── 6. Labels Manager Hook (useLabels) ──────────────────────────────────────

export function useLabels(workspaceId: string, type?: string, projectId?: string) {
  const { data: labels = [] } = useLabelsQuery(workspaceId, type, projectId);
  const createMut = useCreateLabel();
  const updateMut = useUpdateLabel();
  const deleteMut = useDeleteLabel();

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

  const edit = useCallback((label: { _id: string; name: string; color: string }) => {
    setEditId(label._id);
    setName(label.name);
    setColor(label.color);
    setView('edit');
  }, []);

  const save = useCallback(async () => {
    if (!name.trim()) return;
    if (view === 'create') {
      await createMut.mutateAsync({
        workspaceId,
        name: name.trim(),
        color,
        type: type || 'task',
        projectId,
      });
    } else if (view === 'edit' && editId) {
      await updateMut.mutateAsync({
        labelId: editId,
        name: name.trim(),
        color,
      });
    }
    setView('list');
    setName('');
    setEditId(null);
  }, [createMut, updateMut, view, name, color, workspaceId, type, projectId, editId]);

  const remove = useCallback(
    async (labelId?: string) => {
      const targetId = labelId || editId;
      if (!targetId) return;
      await deleteMut.mutateAsync(targetId);
      if (editId === targetId) {
        setView('list');
        setName('');
        setEditId(null);
      }
    },
    [deleteMut, editId],
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
