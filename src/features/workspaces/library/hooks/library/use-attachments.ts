'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AttachmentService,
  AttachmentsService,
  type AttachmentDto,
} from '../../services/attachment.service';
import { CatalogItemService } from '../../services/catalog.service';
import type { ItemAttachment, PaperAttachment } from '../../types/library.types';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const attachmentKeys = {
  byItem: (workspaceId: string, itemId: string) =>
    ['attachments', workspaceId, itemId] as const,
  revisions: (workspaceId: string, attachmentId: string) =>
    ['attachments', workspaceId, 'revisions', attachmentId] as const,
};

// ── useAttachments ────────────────────────────────────────────────────────────
/**
 * Fetch and mutate item attachments.
 * Backed by GET /items/:itemId/attachments, POST /items/:itemId/attachments, DELETE /attachments/:id
 */
export function useAttachments(workspaceId: string, itemId: string) {
  const queryClient = useQueryClient();

  const attachmentsQuery = useQuery({
    queryKey: attachmentKeys.byItem(workspaceId, itemId),
    queryFn: () => AttachmentsService.getAttachments(workspaceId, itemId),
    enabled: Boolean(workspaceId && itemId),
  });

  const addMutation = useMutation({
    mutationFn: (data: Partial<PaperAttachment>) =>
      CatalogItemService.addAttachment(workspaceId, itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(workspaceId, itemId),
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
      AttachmentsService.deleteAttachment(workspaceId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: attachmentKeys.byItem(workspaceId, itemId),
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

  return {
    attachments: attachmentsQuery.data ?? [],
    isLoading: attachmentsQuery.isLoading,
    error: attachmentsQuery.error,
    // Mutations
    add: addMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ── useAttachmentRevisions ────────────────────────────────────────────────────
/**
 * Fetch revisions for a single attachment.
 * Backed by GET /attachments/:id/revisions
 */
export function useAttachmentRevisions(workspaceId: string, attachmentId: string) {
  return useQuery({
    queryKey: attachmentKeys.revisions(workspaceId, attachmentId),
    queryFn: () => AttachmentsService.getAttachmentRevisions(workspaceId, attachmentId),
    enabled: Boolean(workspaceId && attachmentId),
  });
}
