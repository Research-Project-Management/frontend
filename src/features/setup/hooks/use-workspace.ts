// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUpload } from '@/shared/hooks';
import { useUpdateWorkspace as useWorkspaceUpdateMutation } from '@/features/workspaces/shell/hooks/use-workspace';
import { useDeleteWorkspace as useWorkspaceDeleteMutation } from '@/features/workspaces/shell/hooks/use-workspace';
import { createWorkspace } from '@/features/workspaces/shell/services/workspace.service';
import { queryKeys } from '@/shared/constants';
import type { CreateWorkspaceSchema } from '../schemas/workspace-schemas';
import type { Workspace } from '../types/workspace-types';

// ─── useCreateWorkspace ────────────────────────────────────────────────────────

export function useCreateWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { uploadFile, isUploading: isUploadingAvatar } = useUpload();

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    'https://i.pinimg.com/736x/5f/08/52/5f085214d65b511a9992497e2d818625.jpg'
  );

  const createMutation = useMutation({
    mutationFn: async (data: CreateWorkspaceSchema) => {
      const finalAvatar = avatarFile ? await uploadAvatar(avatarFile) : (data.avatar ?? null);
      return createWorkspace({ ...data, avatar: finalAvatar ?? undefined });
    },
    onSuccess: (response) => {
      const workspace = response.workspace;
      queryClient.setQueriesData({ queryKey: queryKeys.workspaces.all }, (current: unknown) => {
        if (Array.isArray(current)) {
          const exists = current.some((w: { _id: string }) => w._id === workspace._id);
          return exists ? current : [workspace, ...current];
        }
        return current;
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
      router.replace(`/${workspace.url}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create workspace');
    },
  });

  function handleAvatarSelect(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
    if (avatarPreview?.startsWith('blob:')) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  return {
    createWorkspace: createMutation.mutate,
    isPending: createMutation.isPending || isUploadingAvatar,
    isSuccess: createMutation.isSuccess,
    avatarPreview,
    handleAvatarSelect,
  };
}

// ─── useEditWorkspace ─────────────────────────────────────────────────────────

export function useEditWorkspace() {
  const { uploadFile, isUploading: isUploadingAvatar } = useUpload();
  const updateMutation = useWorkspaceUpdateMutation();

  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);

  useEffect(() => {
    return () => { if (editAvatarPreview?.startsWith('blob:')) URL.revokeObjectURL(editAvatarPreview); };
  }, [editAvatarPreview]);

  const normalizedName = editName.trim();
  const displayAvatar = editAvatarPreview || editAvatar;
  const hasChanges =
    !!editingWorkspace &&
    (normalizedName !== editingWorkspace.name.trim() || !!editAvatarFile);

  function open(workspace: Workspace) {
    if (editAvatarPreview?.startsWith('blob:')) URL.revokeObjectURL(editAvatarPreview);
    setEditingWorkspace(workspace);
    setEditName(workspace.name);
    setEditAvatar(workspace.avatar);
    setEditAvatarPreview(null);
    setEditAvatarFile(null);
  }

  function close() {
    if (editAvatarPreview?.startsWith('blob:')) URL.revokeObjectURL(editAvatarPreview);
    setEditingWorkspace(null);
    setEditName('');
    setEditAvatar(null);
    setEditAvatarPreview(null);
    setEditAvatarFile(null);
  }

  function handleAvatarSelect(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be less than 5MB'); return; }
    if (editAvatarPreview?.startsWith('blob:')) URL.revokeObjectURL(editAvatarPreview);
    setEditAvatarFile(file);
    setEditAvatarPreview(URL.createObjectURL(file));
  }

  async function confirm() {
    if (!editingWorkspace || !hasChanges) { close(); return; }
    if (!normalizedName) { toast.error('Workspace name is required'); return; }

    const finalAvatar = editAvatarFile ? await uploadAvatar(editAvatarFile) : editAvatar;

    updateMutation.mutate(
      { id: editingWorkspace._id, data: { name: normalizedName, ...(finalAvatar ? { avatar: finalAvatar } : {}) } },
      {
        onSuccess: () => { toast.success('Workspace updated'); close(); },
        onError: (error: Error) => { toast.error(error.message || 'Failed to update workspace'); },
      },
    );
  }

  return {
    editingWorkspace, editName, setEditName,
    displayAvatar, hasChanges, isUploadingAvatar,
    isPending: updateMutation.isPending,
    open, close, confirm, handleAvatarSelect,
  };
}

// ─── useDeleteWorkspace ────────────────────────────────────────────────────────

export function useDeleteWorkspace() {
  const deleteMutation = useWorkspaceDeleteMutation();
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);

  function open(workspace: Workspace) { setDeletingWorkspace(workspace); }
  function close() { if (!deleteMutation.isPending) setDeletingWorkspace(null); }

  function confirm() {
    if (!deletingWorkspace) return;
    deleteMutation.mutate(deletingWorkspace._id, {
      onSuccess: () => { setDeletingWorkspace(null); toast.success('Workspace deleted'); },
      onError: (error: Error) => { toast.error(error.message || 'Failed to delete workspace'); },
    });
  }

  return { deletingWorkspace, open, close, confirm, isPending: deleteMutation.isPending };
}


