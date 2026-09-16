'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectDetails, useUpdateProject } from '@/features/projects/shell/hooks/use-project';
import { toast } from 'sonner';
import {
  type DefaultProjectViewLayout,
  type ProjectViewSettingsConfig,
  DEFAULT_PROJECT_VIEW_SETTINGS,
} from '../types/view.types';

export function useViewSettings(projectId: string) {
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();

  const project = (projectData as any)?.project || projectData;
  const viewSettings = (project?.settings?.views as Partial<ProjectViewSettingsConfig>) || {};

  const [defaultLayout, setDefaultLayout] = useState<DefaultProjectViewLayout>(
    viewSettings.defaultLayout || DEFAULT_PROJECT_VIEW_SETTINGS.defaultLayout,
  );
  const [allowPublicViews, setAllowPublicViews] = useState<boolean>(
    viewSettings.allowPublicViews ?? DEFAULT_PROJECT_VIEW_SETTINGS.allowPublicViews,
  );
  const [showEmptyGroups, setShowEmptyGroups] = useState<boolean>(
    viewSettings.showEmptyGroups ?? DEFAULT_PROJECT_VIEW_SETTINGS.showEmptyGroups,
  );
  const [lockedSystemViews, setLockedSystemViews] = useState<boolean>(
    viewSettings.lockedSystemViews ?? Boolean(DEFAULT_PROJECT_VIEW_SETTINGS.lockedSystemViews),
  );

  useEffect(() => {
    if (viewSettings.defaultLayout) {
      setDefaultLayout(viewSettings.defaultLayout);
    }
    if (typeof viewSettings.allowPublicViews === 'boolean') {
      setAllowPublicViews(viewSettings.allowPublicViews);
    }
    if (typeof viewSettings.showEmptyGroups === 'boolean') {
      setShowEmptyGroups(viewSettings.showEmptyGroups);
    }
    if (typeof viewSettings.lockedSystemViews === 'boolean') {
      setLockedSystemViews(viewSettings.lockedSystemViews);
    }
  }, [
    viewSettings.defaultLayout,
    viewSettings.allowPublicViews,
    viewSettings.showEmptyGroups,
    viewSettings.lockedSystemViews,
  ]);

  const hasChanges = useMemo(() => {
    const serverLayout = viewSettings.defaultLayout || DEFAULT_PROJECT_VIEW_SETTINGS.defaultLayout;
    const serverAllow = viewSettings.allowPublicViews ?? DEFAULT_PROJECT_VIEW_SETTINGS.allowPublicViews;
    const serverEmpty = viewSettings.showEmptyGroups ?? DEFAULT_PROJECT_VIEW_SETTINGS.showEmptyGroups;
    const serverLocked = viewSettings.lockedSystemViews ?? Boolean(DEFAULT_PROJECT_VIEW_SETTINGS.lockedSystemViews);

    return (
      defaultLayout !== serverLayout ||
      allowPublicViews !== serverAllow ||
      showEmptyGroups !== serverEmpty ||
      lockedSystemViews !== serverLocked
    );
  }, [
    defaultLayout,
    allowPublicViews,
    showEmptyGroups,
    lockedSystemViews,
    viewSettings.defaultLayout,
    viewSettings.allowPublicViews,
    viewSettings.showEmptyGroups,
    viewSettings.lockedSystemViews,
  ]);

  const updateProject = updateMutation.mutate;

  const save = useCallback(() => {
    const newSettings = {
      ...(project?.settings || {}),
      views: {
        ...(project?.settings?.views || {}),
        defaultLayout,
        allowPublicViews,
        showEmptyGroups,
        lockedSystemViews,
      },
    };

    updateProject(
      { projectId, settings: newSettings } as any,
      {
        onSuccess: () => toast.success('View settings saved', { id: 'settings-view' }),
        onError: (err: any) => toast.error(err?.message || 'Failed to update view settings', { id: 'settings-view' }),
      },
    );
  }, [
    projectId,
    project,
    defaultLayout,
    allowPublicViews,
    showEmptyGroups,
    lockedSystemViews,
    updateProject,
  ]);

  return {
    project,
    defaultLayout,
    setDefaultLayout,
    allowPublicViews,
    setAllowPublicViews,
    showEmptyGroups,
    setShowEmptyGroups,
    lockedSystemViews,
    setLockedSystemViews,
    hasChanges,
    save,
    isSaving: updateMutation.isPending,
    isLoading,
    isError,
  };
}

export default useViewSettings;
