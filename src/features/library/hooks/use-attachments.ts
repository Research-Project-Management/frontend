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
    mutationFn: async ({ attachmentId, itemId: callerItemId }: { attachmentId: string; itemId?: string }) => {
      await AttachmentsService.deleteAttachment(scopeId || '', attachmentId);
      return { itemId: callerItemId };
    },
    onSuccess: (result) => {
      // Use the itemId threaded from the caller, falling back to the hook's outer itemId.
      // This ensures the correct item's attachment cache is invalidated.
      const effectiveItemId = result.itemId || itemId;
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(scopeId, effectiveItemId),
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

/**
 * Rename a single attachment file.
 * Backed by PATCH /api/v1/library/attachments/:attachmentId/rename
 */
export function useRenameAttachment(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: ({
      attachmentId,
      filename,
      pattern,
    }: {
      attachmentId: string;
      filename?: string;
      pattern?: string;
    }) =>
      AttachmentsService.renameAttachment(effectiveScope, attachmentId, {
        filename,
        pattern,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('File renamed', {
        description: `Renamed to "${res.newFilename}"`,
        id: 'attachment-rename',
      });
    },
    onError: (err: any) => {
      toast.error('Rename failed', {
        description: err?.message || 'Could not rename file.',
        id: 'attachment-rename',
      });
    },
  });
}

/**
 * Batch rename attachments matching items or attachment IDs.
 * Backed by POST /api/v1/library/attachments/batch-rename
 */
export function useBatchRenameAttachments(scopeId?: string) {
  const queryClient = useQueryClient();
  const effectiveScope = scopeId || 'user';

  return useMutation({
    mutationFn: (dto: { itemIds?: string[]; attachmentIds?: string[]; pattern?: string }) =>
      AttachmentsService.batchRenameAttachments(effectiveScope, dto),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['attachments'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      toast.success('Files renamed', {
        description: `Successfully renamed ${res.renamedCount} attachment file(s) according to pattern.`,
        id: 'batch-attachment-rename',
      });
    },
    onError: (err: any) => {
      toast.error('Batch rename failed', {
        description: err?.message || 'Could not rename files.',
        id: 'batch-attachment-rename',
      });
    },
  });
}

