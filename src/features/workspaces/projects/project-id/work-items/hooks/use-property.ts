'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { PropertyService, type UserProjectProperty } from '../services/property.service';

export interface UpdateUserPropertiesPayload {
  filters?: Record<string, unknown>;
  displayFilters?: Record<string, unknown>;
  displayProperties?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  sortOrder?: string;
}

/**
 * Hook to manage User Project Properties & View Preferences (Plane.so parity).
 * Keeps preferences, display properties, and filters synced per project per user.
 */
export function useProperty(projectId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['project-user-properties', projectId];

  const {
    data: userProperties,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => PropertyService.getUserProperties(projectId!),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const {
    mutate: updateProperties,
    mutateAsync: updatePropertiesAsync,
    isPending: isUpdating,
  } = useMutation({
    mutationFn: (data: UpdateUserPropertiesPayload) => {
      if (!projectId) {
        throw new Error('Project ID is required to update properties');
      }
      return PropertyService.updateUserProperties(projectId, data);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateDisplayProperties = useCallback(
    (displayProperties: Record<string, unknown>) => {
      if (!projectId) return;
      return updateProperties({ displayProperties });
    },
    [projectId, updateProperties],
  );

  const updatePreferences = useCallback(
    (preferences: Record<string, unknown>) => {
      if (!projectId) return;
      return updateProperties({ preferences });
    },
    [projectId, updateProperties],
  );

  const updateDisplayFilters = useCallback(
    (displayFilters: Record<string, unknown>) => {
      if (!projectId) return;
      return updateProperties({ displayFilters });
    },
    [projectId, updateProperties],
  );

  const updateDisplayOptions = useCallback(
    (options: {
      properties?: Record<string, unknown>;
      groupBy?: string;
      subGroupBy?: string;
      orderBy?: string;
      orderDirection?: string;
      showEmptyGroups?: boolean;
      showSubtasks?: boolean;
    }) => {
      if (!projectId) return;
      const { properties, ...displayFilters } = options;
      return updateProperties({
        ...(properties && { displayProperties: properties }),
        ...(Object.keys(displayFilters).length > 0 && { displayFilters }),
      });
    },
    [projectId, updateProperties],
  );

  const updateFilters = useCallback(
    (filters: Record<string, unknown>) => {
      if (!projectId) return;
      return updateProperties({ filters });
    },
    [projectId, updateProperties],
  );

  return {
    userProperties,
    isLoading,
    isError,
    error,
    isUpdating,
    refetch,
    updateProperties,
    updatePropertiesAsync,
    updateDisplayProperties,
    updateDisplayOptions,
    updatePreferences,
    updateDisplayFilters,
    updateFilters,
  };
}

export type UsePropertyReturn = ReturnType<typeof useProperty>;
