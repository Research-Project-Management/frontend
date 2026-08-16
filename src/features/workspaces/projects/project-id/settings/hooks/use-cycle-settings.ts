'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectDetails, useUpdateProject } from '@/features/workspaces/projects/shell';
import { toast } from 'sonner';

export function useCycleSettings(projectId: string) {
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();

  const project = (projectData as any)?.project || projectData;
  const cycleSettings = project?.settings?.cycles || {};

  const [duration, setDuration] = useState<number>(14);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(false);

  useEffect(() => {
    if (cycleSettings) {
      if (typeof cycleSettings.defaultDurationDays === 'number') {
        setDuration(cycleSettings.defaultDurationDays);
      }
      if (typeof cycleSettings.autoAdvance === 'boolean') {
        setAutoAdvance(cycleSettings.autoAdvance);
      }
    }
  }, [cycleSettings?.defaultDurationDays, cycleSettings?.autoAdvance]);

  const hasChanges = useMemo(() => {
    const serverDuration = cycleSettings?.defaultDurationDays ?? 14;
    const serverAuto = cycleSettings?.autoAdvance ?? false;
    return duration !== serverDuration || autoAdvance !== serverAuto;
  }, [duration, autoAdvance, cycleSettings]);

  const save = useCallback(() => {
    const newSettings = {
      ...(project?.settings || {}),
      cycles: {
        ...(project?.settings?.cycles || {}),
        defaultDurationDays: duration,
        autoAdvance,
      },
    };

    updateMutation.mutate(
      { projectId, settings: newSettings } as any,
      {
        onSuccess: () => toast.success('Cycle settings updated'),
        onError: (err: any) => toast.error(err?.message || 'Failed to update cycle settings'),
      },
    );
  }, [projectId, project, duration, autoAdvance, updateMutation]);

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
