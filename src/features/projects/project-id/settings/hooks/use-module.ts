'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectDetails, useUpdateProject } from '@/features/projects/shell/hooks/use-project';
import { toast } from 'sonner';

/**
 * Encapsulates module toggle state, dirty tracking, and save logic.
 */
export function useModules(projectId: string) {
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();

  const project = (projectData as any)?.project || projectData;
  const DEFAULT_MODULES = useMemo(
    () => ['work-items', 'cycles', 'views', 'pages'],
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
        m !== 'storage' &&
        m !== 'analytics' &&
        m !== 'settings'
    );
  }, [project?.modules, DEFAULT_MODULES]);
  const serverModulesKey = serverModules.join(',');

  const [active, setActive] = useState<string[]>([]);

  // Sync local state when server data arrives / changes
  useEffect(() => {
    if (serverModules.length > 0) {
      // Backwards compatibility: if project has legacy modules, default cycles and views to active
      const hasCyclesOrViews = serverModules.includes('cycles') || serverModules.includes('views');
      if (!hasCyclesOrViews && serverModules.includes('work-items')) {
        setActive([...serverModules, 'cycles', 'views']);
      } else {
        setActive(serverModules);
      }
    }
  }, [serverModulesKey, serverModules]);

  const updateProject = updateMutation.mutate;

  const toggle = useCallback((id: string) => {
    setActive((prev) => {
      const next = prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
      updateProject(
        { projectId, modules: next },
        {
          onSuccess: () => toast.success('Modules updated'),
          onError: () => {
            setActive(prev);
            toast.error('Failed to update modules');
          },
        },
      );
      return next;
    });
  }, [projectId, updateProject]);

  const hasChanges = useMemo(() => {
    const a = [...active].sort().join(',');
    const b = [...serverModules].sort().join(',');
    return a !== b;
  }, [active, serverModules]);

  const save = useCallback(() => {
    updateProject(
      { projectId, modules: active },
      { onSuccess: () => toast.success('Modules updated') },
    );
  }, [projectId, active, updateProject]);

  return {
    active,
    toggle,
    hasChanges,
    save,
    isSaving: updateMutation.isPending,
    isLoading,
    isError,
    project,
  };
}
