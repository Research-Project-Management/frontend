'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AttachmentService,
  AttachmentsService,
  type AttachmentDto,
} from '../services/attachments.service';
import type { ItemAttachment } from '../types/library.types';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const attachmentKeys = {
  byItem: (scopeId?: string, itemId?: string) =>
    ['attachments', scopeId || 'user', itemId || 'none'] as const,
  revisions: (scopeId?: string, attachmentId?: string) =>
    ['attachments', scopeId || 'user', 'revisions', attachmentId || 'none'] as const,
};

// ── useAttachments ────────────────────────────────────────────────────────────
/**
 * Fetch and mutate item attachments.
 * Backed by GET /items/:itemId/attachments, POST /items/:itemId/attachments, DELETE /attachments/:id
 */
export function useAttachments(scopeId?: string, itemId?: string) {
  const queryClient = useQueryClient();

  const attachmentsQuery = useQuery({
    queryKey: attachmentKeys.byItem(scopeId, itemId || ''),
    queryFn: () => AttachmentsService.getAttachments(scopeId || '', itemId || ''),
    enabled: Boolean(itemId),
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<ItemAttachment>) =>
      AttachmentsService.createAttachment(scopeId || '', itemId || '', data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, itemId),
      });
      toast.success('Attachment added', { id: 'attachment-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to add attachment', {
        description: err?.message || 'Please try again.',
        id: 'attachment-mutation',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      AttachmentsService.deleteAttachment(scopeId || '', attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, itemId),
      });
      toast.success('Attachment deleted', { id: 'attachment-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to delete attachment', {
        description: err?.message || 'Please try again.',
        id: 'attachment-mutation',
      });
    },
  });

  const captureSnapshotMutation = useMutation({
    mutationFn: (url?: string) =>
      AttachmentsService.captureSnapshot(scopeId || '', itemId || '', url),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: ['items'],
      });
      toast.success('Web Snapshot captured', { id: 'snapshot-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to capture snapshot', {
        description: err?.message || 'Please verify the URL is accessible.',
        id: 'snapshot-mutation',
      });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      AttachmentsService.setPrimaryAttachment(scopeId || '', itemId || '', attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, itemId),
      });
      queryClient.invalidateQueries({
        queryKey: ['items'],
      });
      toast.success('Set as primary document', { id: 'primary-attachment-mutation' });
    },
    onError: (err: any) => {
      toast.error('Failed to set primary document', {
        description: err?.message || 'Please try again.',
        id: 'primary-attachment-mutation',
      });
    },
  });

  return {
    attachments: attachmentsQuery.data ?? [],
    isLoading: attachmentsQuery.isLoading,
    error: attachmentsQuery.error,
    // Mutations
    add: addMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    captureSnapshot: captureSnapshotMutation.mutateAsync,
    setPrimary: setPrimaryMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCapturingSnapshot: captureSnapshotMutation.isPending,
    isSettingPrimary: setPrimaryMutation.isPending,
  };
}

// ── useAttachmentRevisions ────────────────────────────────────────────────────
/**
 * Fetch revisions for a single attachment.
 * Backed by GET /attachments/:id/revisions
 */
export function useAttachmentRevisions(scopeId?: string, attachmentId?: string) {
  return useQuery({
    queryKey: attachmentKeys.revisions(scopeId, attachmentId),
    queryFn: () => AttachmentsService.getAttachmentRevisions(scopeId || '', attachmentId || ''),
    enabled: Boolean(attachmentId),
  });
}
