'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getUserProjectLabels,
  createProjectLabel,
  updateProjectLabel,
  deleteProjectLabel,
  getProjectAssignedLabels,
  assignLabelsToProject,
  removeLabelFromProject,
  projectLabelKeys,
  type ProjectLabel,
  type CreateProjectLabelInput,
  type UpdateProjectLabelInput,
} from '../services/project-label.service';
import { projectKeys } from '../services/project.service';

/**
 * Fetch all project labels/tags created by the current user.
 */
export function useUserProjectLabels() {
  const query = useQuery({
    queryKey: projectLabelKeys.userLabels(),
    queryFn: ({ signal }) => getUserProjectLabels(signal),
    staleTime: 60 * 1000,
  });

  return {
    labels: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Fetch labels assigned to a specific project.
 */
export function useProjectAssignedLabels(projectId?: string) {
  return useQuery({
    queryKey: projectLabelKeys.byProject(projectId ?? ''),
    queryFn: ({ signal }) => getProjectAssignedLabels(projectId!, signal),
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
  });
}

/**
 * Create a new project label/tag.
 */
export function useCreateProjectLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateProjectLabelInput) => createProjectLabel(dto),
    onSuccess: (newLabel) => {
      toast.success(`Tag "${newLabel.name}" created`);
      queryClient.invalidateQueries({ queryKey: projectLabelKeys.userLabels() });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create tag');
    },
  });
}

/**
 * Update an existing project label.
 */
export function useUpdateProjectLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...dto }: UpdateProjectLabelInput & { id: string }) =>
      updateProjectLabel(id, dto),
    onSuccess: (updatedLabel) => {
      toast.success(`Tag "${updatedLabel.name}" updated`);
      queryClient.invalidateQueries({ queryKey: projectLabelKeys.userLabels() });
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update tag');
    },
  });
}

/**
 * Delete a project label.
 */
export function useDeleteProjectLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProjectLabel(id),
    onSuccess: () => {
      toast.success('Tag deleted');
      queryClient.invalidateQueries({ queryKey: projectLabelKeys.userLabels() });
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete tag');
    },
  });
}

/**
 * Assign / update tags for a project.
 */
export function useAssignProjectLabels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, labelIds }: { projectId: string; labelIds: string[] }) =>
      assignLabelsToProject(projectId, labelIds),
    onSuccess: (_data, variables) => {
      toast.success('Project tags updated');
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: projectLabelKeys.byProject(variables.projectId) });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update project tags');
    },
  });
}

/**
 * Remove a specific tag from a project.
 */
export function useRemoveProjectLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, labelId }: { projectId: string; labelId: string }) =>
      removeLabelFromProject(projectId, labelId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all() });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: projectLabelKeys.byProject(variables.projectId) });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to remove tag');
    },
  });
}
