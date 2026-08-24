'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectDetails, useUpdateProject } from '@/features/workspaces/projects/shell/hooks/use-project';
import { toast } from 'sonner';

export function useCycleSettings(projectId: string) {
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();

  const project = (projectData as any)?.project || projectData;
  const cycleSettings = project?.settings?.cycles;

  const [duration, setDuration] = useState<number>(14);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);

  const defaultDurationDays = cycleSettings?.defaultDurationDays;
  const autoAdvanceSetting = cycleSettings?.autoAdvance;

  useEffect(() => {
    if (typeof defaultDurationDays === 'number') {
      setDuration(defaultDurationDays);
    }
    if (typeof autoAdvanceSetting === 'boolean') {
      setAutoAdvance(autoAdvanceSetting);
    }
  }, [defaultDurationDays, autoAdvanceSetting]);

  const hasChanges = useMemo(() => {
    const serverDuration = cycleSettings?.defaultDurationDays ?? 14;
    const serverAuto = cycleSettings?.autoAdvance ?? false;
    return duration !== serverDuration || autoAdvance !== serverAuto;
  }, [duration, autoAdvance, cycleSettings?.defaultDurationDays, cycleSettings?.autoAdvance]);

  const updateProject = updateMutation.mutate;

  const save = useCallback(() => {
    const newSettings = {
      ...(project?.settings || {}),
      cycles: {
        ...(project?.settings?.cycles || {}),
        defaultDurationDays: duration,
        autoAdvance,
      },
    };

    updateProject(
      { projectId, settings: newSettings } as any,
      {
        onSuccess: () => toast.success('Cycle settings updated'),
        onError: (err: any) => toast.error(err?.message || 'Failed to update cycle settings'),
      },
    );
  }, [projectId, project, duration, autoAdvance, updateProject]);

  return {
    project,
    duration,
    setDuration,
    autoAdvance,
    setAutoAdvance,
    hasChanges,
    save,
    isSaving: updateMutation.isPending,
    isLoading,
    isError,
  };
}
