'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectDetails, useUpdateProject } from '@/features/projects/shell/hooks/use-project';
import { toast } from 'sonner';

/**
 * Encapsulates module toggle state, dirty tracking, and save logic.
 */
export function useModules(projectId: string) {
  const { project, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();

  const DEFAULT_MODULES = useMemo(
    () => ['work-items', 'pages', 'chat', 'experiments', 'analytics', 'archives'],
    [],
  );

  const serverModules: string[] = useMemo(() => {
    const raw = project?.modules;
    if (!raw || raw.length === 0) return DEFAULT_MODULES;
    const normalized = raw.map((m: string) => String(m).toLowerCase().replace(/_/g, '-'));
    return normalized.filter(
      (m: string) =>
        m !== 'overview' &&
        m !== 'stickies' &&
        m !== 'settings'
    );
  }, [project?.modules, DEFAULT_MODULES]);
  const serverModulesKey = serverModules.join(',');

  const [active, setActive] = useState<string[]>([]);

  // Sync local state when server data arrives / changes
  useEffect(() => {
    if (serverModules.length > 0) {
      setActive(serverModules);
    }
  }, [serverModulesKey, serverModules]);

  const updateProject = updateMutation.mutate;

  const toggle = useCallback((id: string) => {
    setActive((prev) => {
      const isEnabling = !prev.includes(id);
      const next = isEnabling ? [...prev, id] : prev.filter((m) => m !== id);

      if (id === 'chat' && isEnabling) {
        import('@/features/chat/services/chat.service').then(({ chatService }) => {
          chatService.enableProjectChat(projectId).catch(() => {});
        });
      }

      // Always persist core modules overview and work-items
      const modulesToSave = Array.from(new Set(['overview', 'work-items', ...next]));

      updateProject(
        { projectId, modules: modulesToSave },
        {
          onSuccess: () => toast.success('Modules updated', { id: 'settings-module' }),
          onError: () => {
            setActive(prev);
            toast.error('Failed to update modules', { id: 'settings-module' });
          },
        },
      );
      return next;
    });
  }, [projectId, updateProject]);

  return {
    active,
    toggle,
    isSaving: updateMutation.isPending,
    isLoading,
    isError,
    project,
  };
}
