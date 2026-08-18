'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { GeneralSettingsSchema } from '@/features/workspaces/settings/schemas/settings.schema';
import type { GeneralSettingsFormValues } from '@/features/workspaces/settings/types/settings.types';
import {
  useWorkspace,
  useWorkspaces,
  useUpdateWorkspace,
  useDeleteWorkspace,
} from '@/features/workspaces/shell/hooks/use-workspace';
import { useUpload } from '@/shared/hooks/use-upload';

export function useGeneral(workspaceId: string) {
  const router = useRouter();

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  const [host, setHost] = useState('flux.chqv.tech');
  const fileRef = useRef<HTMLInputElement>(null);

  const { workspace, isLoading, isError } = useWorkspace(workspaceId);
  const { workspaces } = useWorkspaces();
  const { uploadFile, isUploading: isUploadingAvatar } = useUpload();

  const updateMutation = useUpdateWorkspace();
  const deleteMutation = useDeleteWorkspace();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHost(window.location.host);
    }
  }, []);

  const form = useForm<GeneralSettingsFormValues>({
    resolver: zodResolver(GeneralSettingsSchema),
    defaultValues: {
      name: '',
      url: '',
      avatar: '',
      teamSize: '2-10',
    },
  });

  useEffect(() => {
    if (workspace) {
      setCurrentAvatar(workspace.avatar || null);
      form.reset({
        name: workspace.name || '',
        url: workspace.url || '',
        avatar: workspace.avatar || '',
        teamSize: (workspace.companySize as GeneralSettingsFormValues['teamSize']) || '2-10',
      });
    }
  }, [workspace, form]);

  const handleUpdate = useCallback(
    (values: GeneralSettingsFormValues) => {
      updateMutation.mutate(
        {
          id: workspaceId,
          data: {
            name: values.name,
            url: values.url,
            avatar: currentAvatar,
            companySize: values.teamSize,
          },
        },
        {
          onSuccess: () => {
            toast.success('Workspace updated successfully');
            if (values.url && values.url !== workspace?.url) {
              router.push(`/${values.url}/settings`);
            }
          },
          onError: () => {
            toast.error('Failed to update workspace');
          },
        },
      );
    },
    [workspaceId, currentAvatar, workspace?.url, updateMutation, router],
  );

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      try {
        const url = await uploadFile(file, 'workspace/avatars');
        setCurrentAvatar(url);
        updateMutation.mutate({
          id: workspaceId,
          data: { avatar: url },
        });
        toast.success('Avatar updated successfully');
      } catch (error) {
        toast.error('Failed to upload avatar');
      }
    },
    [workspaceId, uploadFile, updateMutation],
  );

  const handleDelete = useCallback(() => {
    deleteMutation.mutate(workspaceId, {
      onSuccess: () => {
        toast.success('Workspace deleted');
        const nextWs: any = (workspaces as any[])?.find((w: any) => w.id !== workspaceId);
        if (nextWs?.url) {
          router.push(`/${nextWs.url}`);
        } else {
          router.push('/');
        }
      },
      onError: () => {
        toast.error('Failed to delete workspace');
      },
    });
  }, [workspaceId, workspaces, deleteMutation, router]);

  const hasChanges = useMemo(() => {
    return (
      form.watch('name') !== (workspace?.name || '') ||
      form.watch('teamSize') !== (workspace?.companySize || '')
    );
  }, [form, workspace?.name, workspace?.companySize]);

  return {
    state: {
      form,
      workspace,
      isLoading,
      isError,
      host,
      currentAvatar,
      isUploadingAvatar,
      fileRef,
      isDeleteOpen,
      isSubmitting: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
      hasChanges,
    },
    actions: {
      setIsDeleteOpen,
      handleUpdate,
      handleAvatarUpload,
      handleDelete,
    },
  };
}
