'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectDetails, useUpdateProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { toast } from 'sonner';

/**
 * Encapsulates module toggle state, dirty tracking, and save logic.
 */
export function useModules(projectId: string) {
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();

  const project = (projectData as any)?.project || projectData;
  const serverModules: string[] = project?.modules ?? [];

  const [active, setActive] = useState<string[]>([]);

  // Sync local state when server data arrives / changes
  useEffect(() => {
    if (serverModules.length > 0) {
      setActive(serverModules);
    }
  }, [serverModules.join(',')]);

  const toggle = useCallback((id: string) => {
    setActive((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }, []);

  const hasChanges = useMemo(() => {
    const a = [...active].sort().join(',');
    const b = [...serverModules].sort().join(',');
    return a !== b;
  }, [active, serverModules]);

  const save = useCallback(() => {
    updateMutation.mutate(
      { projectId, modules: active },
      { onSuccess: () => toast.success('Modules updated') },
    );
  }, [projectId, active, updateMutation]);

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
