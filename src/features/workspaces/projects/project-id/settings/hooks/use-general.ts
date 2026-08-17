'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getErrorMessage } from '@/shared/utils/error.util';
import { useProjectDetails, useUpdateProject, useDeleteProject } from '@/features/workspaces/projects/shell';
import { uploadGenericFile } from '@/features/workspaces/storage/services/file.service';

export function useGeneral(projectId: string, workspaceId: string) {
  const router = useRouter();
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  const project = (projectData as any)?.project || projectData;

  // Local form state
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [isUploading, setIsUploading] = useState(false);

  // Sync from server
  useEffect(() => {
    if (project) {
      const settings = (project.settings as any) || {};
      setName(project.name || '');
      setIdentifier(project.identifier || settings.identifier || project.key || '');
      setDescription(project.description || '');
      setAvatar(project.avatar || null);
      setCover(project.cover || settings.cover || null);
      setIsPrivate(project.isPrivate ?? settings.isPrivate ?? false);
      setTimezone(project.timezone || settings.timezone || 'Asia/Ho_Chi_Minh');
    }
  }, [project]);

  const hasChanges = useMemo(() => {
    if (!project) return false;
    const settings = (project.settings as any) || {};
    return (
      name !== (project.name || '') ||
      identifier !== (project.identifier || settings.identifier || project.key || '') ||
      description !== (project.description || '') ||
      avatar !== (project.avatar || null) ||
      cover !== (project.cover || settings.cover || null) ||
      isPrivate !== (project.isPrivate ?? settings.isPrivate ?? false) ||
      timezone !== (project.timezone || settings.timezone || 'Asia/Ho_Chi_Minh')
    );
  }, [project, name, identifier, description, avatar, cover, isPrivate, timezone]);

  const save = useCallback(() => {
    const existingSettings = (project?.settings as any) || {};
    const newSettings = {
      ...existingSettings,
      identifier,
      cover,
      isPrivate,
      timezone,
    };

    updateMutation.mutate(
      {
        projectId,
        name,
        description,
        avatar: avatar || undefined,
        settings: newSettings,
      } as any,
      {
        onSuccess: () => toast.success('Project details updated'),
        onError: (err: any) => toast.error(err?.message || 'Failed to update project'),
      },
    );
  }, [projectId, project, name, description, avatar, cover, identifier, isPrivate, timezone, updateMutation]);

  const handleSelectAvatar = useCallback((val: string) => {
    setAvatar(val);
  }, []);

  const handleSelectCover = useCallback((coverUrl: string) => {
    setCover(coverUrl);
  }, []);

  const handleUploadCustomCover = useCallback(async (file: File) => {
    try {
      setIsUploading(true);
      const url = await uploadGenericFile(file, workspaceId);
      setCover(url);
      toast.success('Cover uploaded');
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to upload cover');
    } finally {
      setIsUploading(false);
    }
  }, [workspaceId]);

  const toggleArchive = useCallback(() => {
    const existingSettings = (project?.settings as any) || {};
    const nextArchived = !existingSettings.isArchived && !project?.isArchived;
    const newSettings = {
      ...existingSettings,
      isArchived: nextArchived,
    };
    updateMutation.mutate(
      { projectId, settings: newSettings } as any,
      {
        onSuccess: () => {
          toast.success(nextArchived ? 'Project archived' : 'Project restored');
        },
        onError: (err: unknown) => toast.error(getErrorMessage(err) || 'Failed to update archive status'),
      },
    );
  }, [projectId, project, updateMutation]);

  const deleteProj = useCallback(() => {
    deleteMutation.mutate(
      { projectId },
      {
        onSuccess: () => {
          router.push(`/${workspaceId}/projects`);
        },
      },
    );
  }, [projectId, workspaceId, deleteMutation, router]);

  return {
    project,
    isLoading,
    isError,
    // Fields
    name,
    setName,
    identifier,
    setIdentifier,
    description,
    setDescription,
    avatar,
    cover,
    isPrivate,
    setIsPrivate,
    timezone,
    setTimezone,
    isArchived: Boolean(project?.isArchived || (project?.settings as any)?.isArchived),
    createdAt: project?.createdAt,
    // Actions
    hasChanges,
    save,
    isSaving: updateMutation.isPending,
    isUploading,
    handleSelectAvatar,
    handleSelectCover,
    handleUploadCustomCover,
    toggleArchive,
    deleteProj,
    isDeleting: deleteMutation.isPending,
  };
}
