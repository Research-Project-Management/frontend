'use client';

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { getErrorMessage } from "@/shared/lib/utils";
import {
  useProjectDetails,
  useUpdateProject,
  useDeleteProject,
  useArchiveProject,
  useRestoreProject,
} from '@/features/workspaces/projects/shell/hooks/use-project';
import { uploadGenericFile } from '@/features/workspaces/storage/services/file.service';
import { projectGeneralSchema, type ProjectGeneralFormValues } from '../schemas/general.schema';

export function useGeneral(projectId: string, workspaceId?: string) {
  const router = useRouter();
  const { data: projectData, isLoading, isError } = useProjectDetails(projectId);
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const archiveMutation = useArchiveProject();
  const restoreMutation = useRestoreProject();

  const project = (projectData as any)?.project || projectData;

  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<ProjectGeneralFormValues>({
    resolver: zodResolver(projectGeneralSchema),
    defaultValues: {
      name: '',
      identifier: '',
      description: '',
      isPrivate: false,
      avatar: null,
      cover: null,
    },
    mode: 'onTouched',
  });

  const { reset, setValue, control, register, handleSubmit, formState } = form;

  // Sync from server
  useEffect(() => {
    if (project) {
      const settings = (project.settings as any) || {};
      reset({
        name: project.name || '',
        identifier: project.identifier || settings.identifier || project.key || '',
        description: project.description || '',
        avatar: project.avatar || null,
        cover: project.cover || project.coverImage || settings.cover || null,
        isPrivate: project.isPrivate ?? settings.isPrivate ?? false,
      });
    }
  }, [project, reset]);

  // Reactive field values via useWatch (Rule sub-usewatch-over-watch)
  const name = useWatch({ control, name: 'name' }) ?? '';
  const identifier = useWatch({ control, name: 'identifier' }) ?? '';
  const description = useWatch({ control, name: 'description' }) ?? '';
  const isPrivate = useWatch({ control, name: 'isPrivate' }) ?? false;
  const avatar = useWatch({ control, name: 'avatar' }) ?? null;
  const cover = useWatch({ control, name: 'cover' }) ?? null;

  const onValidSave = useCallback(
    (values: ProjectGeneralFormValues) => {
      const existingSettings = (project?.settings as any) || {};
      const newSettings = {
        ...existingSettings,
        identifier: values.identifier.toUpperCase(),
        cover: values.cover,
        isPrivate: values.isPrivate,
      };

      updateMutation.mutate(
        {
          projectId,
          name: values.name,
          identifier: values.identifier.toUpperCase(),
          cover: values.cover || undefined,
          coverImage: values.cover || undefined,
          description: values.description,
          avatar: values.avatar || undefined,
          settings: newSettings,
        } as any,
        {
          onSuccess: () => {
            toast.success('Project details updated');
            reset(values);
          },
          onError: (err: any) => toast.error(err?.message || 'Failed to update project'),
        },
      );
    },
    [projectId, project, updateMutation, reset]
  );

  const save = useCallback(() => {
    handleSubmit(onValidSave)();
  }, [handleSubmit, onValidSave]);

  const setName = useCallback(
    (val: string) => setValue('name', val, { shouldDirty: true, shouldValidate: true }),
    [setValue]
  );

  const setIdentifier = useCallback(
    (val: string) => setValue('identifier', val, { shouldDirty: true, shouldValidate: true }),
    [setValue]
  );

  const setDescription = useCallback(
    (val: string) => setValue('description', val, { shouldDirty: true, shouldValidate: true }),
    [setValue]
  );

  const setIsPrivate = useCallback(
    (val: boolean) => setValue('isPrivate', val, { shouldDirty: true, shouldValidate: true }),
    [setValue]
  );

  const handleSelectAvatar = useCallback(
    (val: string) => setValue('avatar', val, { shouldDirty: true }),
    [setValue]
  );

  const handleSelectCover = useCallback(
    (coverUrl: string) => setValue('cover', coverUrl, { shouldDirty: true }),
    [setValue]
  );

  const handleUploadCustomCover = useCallback(
    async (file: File) => {
      try {
        setIsUploading(true);
        const url = await uploadGenericFile(file, workspaceId);
        setValue('cover', url, { shouldDirty: true });
        toast.success('Cover uploaded');
      } catch (err: unknown) {
        toast.error(getErrorMessage(err) || 'Failed to upload cover');
      } finally {
        setIsUploading(false);
      }
    },
    [workspaceId, setValue]
  );

  const isArchived = Boolean(
    project?.isActive === false || project?.isArchived || (project?.settings as any)?.isArchived
  );

  const toggleArchive = useCallback(() => {
    if (isArchived) {
      restoreMutation.mutate({ projectId });
    } else {
      archiveMutation.mutate({ projectId });
    }
  }, [projectId, isArchived, restoreMutation, archiveMutation]);

  const deleteProj = useCallback(() => {
    deleteMutation.mutate(
      { projectId },
      {
        onSuccess: () => {
          router.push('/projects');
        },
      },
    );
  }, [projectId, deleteMutation, router]);

  return {
    project,
    isLoading,
    isError,
    // React Hook Form instance & bindings
    form,
    control,
    register,
    handleSubmit,
    errors: formState.errors,
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
    isArchived,
    createdAt: project?.createdAt,
    // Actions
    hasChanges: formState.isDirty,
    save,
    isSaving: updateMutation.isPending,
    isUploading,
    handleSelectAvatar,
    handleSelectCover,
    handleUploadCustomCover,
    toggleArchive,
    deleteProj,
    isDeleting: deleteMutation.isPending || archiveMutation.isPending || restoreMutation.isPending,
  };
}
