'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { useProjectDetails } from '@/features/workspaces/projects/shell/hooks/use-project';
import { WorklogService } from '../services/worklog.service';
import type { WorklogEntry } from '../types/worklog.types';

export function useWorklogs(projectId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: projectData, isLoading: isProjectLoading } = useProjectDetails(projectId);
  const project = (projectData as any)?.project || projectData;

  // Project members for the user filter
  const members = useMemo(() => {
    return (project?.members || []).map((m: any) => ({
      id: m.user?._id || m.user?.id || m.userId || '',
      name: m.user?.name || 'Unknown User',
      email: m.user?.email || '',
      avatar: m.user?.avatar || '',
    }));
  }, [project]);

  // Query worklogs from backend
  const {
    data: logs = [],
    isLoading: isLogsLoading,
  } = useQuery<WorklogEntry[]>({
    queryKey: ['project-worklogs', projectId],
    queryFn: () => WorklogService.getProjectWorklogs(projectId),
    enabled: Boolean(projectId),
  });

  // Filter state
  const [userIds, setUserIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (userIds.length > 0) {
        const matchUser = userIds.includes(log.userId || '') || userIds.includes(log.user.id || '');
        if (!matchUser) return false;
      }

      if (startDate) {
        if (new Date(log.date) < new Date(startDate)) return false;
      }

      if (endDate) {
        if (new Date(log.date) > new Date(endDate)) return false;
      }

      return true;
    });
  }, [logs, userIds, startDate, endDate]);

  const toggleUserFilter = useCallback((userId: string) => {
    setUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }, []);

  const clearUserFilter = useCallback(() => {
    setUserIds([]);
  }, []);

  const setDateRange = useCallback((start: string | null, end: string | null) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  const clearDateRange = useCallback(() => {
    setStartDate(null);
    setEndDate(null);
  }, []);

  const downloadCsv = useCallback(() => {
    if (filteredLogs.length === 0) {
      toast.info('No worklog entries to download');
      return;
    }

    const headers = ['ID', 'User', 'Email', 'Task / Activity', 'Hours', 'Date', 'Description'];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.user.name.replace(/"/g, '""')}"`,
      `"${(l.user.email || '').replace(/"/g, '""')}"`,
      `"${l.taskTitle.replace(/"/g, '""')}"`,
      l.hours,
      l.date,
      `"${(l.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `worklogs-${project?.name || 'project'}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Worklogs downloaded as CSV');
  }, [filteredLogs, project]);

  const downloadExcel = useCallback(() => {
    if (filteredLogs.length === 0) {
      toast.info('No worklog entries to download');
      return;
    }

    const headers = ['ID', 'User', 'Email', 'Task / Activity', 'Hours', 'Date', 'Description'];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.user.name.replace(/"/g, '""')}"`,
      `"${(l.user.email || '').replace(/"/g, '""')}"`,
      `"${l.taskTitle.replace(/"/g, '""')}"`,
      l.hours,
      l.date,
      `"${(l.description || '').replace(/"/g, '""')}"`,
    ]);

    const content =
      '\uFEFF' + [headers.join('\t'), ...rows.map((e) => e.join('\t'))].join('\n');

    const blob = new Blob([content], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `worklogs-${project?.name || 'project'}-${new Date().toISOString().split('T')[0]}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Worklogs downloaded as Excel');
  }, [filteredLogs, project]);

  const downloadJson = useCallback(() => {
    if (filteredLogs.length === 0) {
      toast.info('No worklog entries to download');
      return;
    }

    const jsonStr = JSON.stringify(filteredLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `worklogs-${project?.name || 'project'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Worklogs downloaded as JSON');
  }, [filteredLogs, project]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { taskTitle: string; hours: number; date: string; description: string }) =>
      WorklogService.createWorklog(projectId, {
        taskTitle: data.taskTitle.trim(),
        hours: data.hours,
        date: data.date,
        description: data.description.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-worklogs', projectId] });
      toast.success('Worklog recorded');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to record worklog');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => WorklogService.deleteWorklog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-worklogs', projectId] });
      toast.success('Worklog removed');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete worklog');
    },
  });

  const addLog = useCallback(
    (data: { taskTitle: string; hours: number; date: string; description: string }) => {
      createMutation.mutate(data);
    },
    [createMutation]
  );

  const deleteLog = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  return {
    logs: filteredLogs,
    allLogs: logs,
    members,
    isLoading: isProjectLoading || isLogsLoading,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    // Filter controls
    userIds,
    toggleUserFilter,
    clearUserFilter,
    startDate,
    endDate,
    setDateRange,
    clearDateRange,
    // Export actions
    downloadCsv,
    downloadExcel,
    downloadJson,
    // Mutations
    addLog,
    deleteLog,
  };
}
