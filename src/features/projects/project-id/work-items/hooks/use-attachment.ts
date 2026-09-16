'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUpload } from "@/shared/hooks/use-upload";
import { AttachmentService } from '../services/attachment.service';
import type {
  AttachPageInput,
  AttachPaperInput,
  AttachFileInput,
  AttachLinkInput,
} from '../types/work-item.types';
import {
  attachPageInputSchema,
  attachPaperInputSchema,
  attachFileInputSchema,
  attachLinkInputSchema,
} from '../schemas/work-item.schema';

export const useAttachPage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, pageId, title }: { id?: string; itemId?: string; workItemId?: string } & AttachPageInput) => {
      const targetId = (id || itemId || workItemId) ?? '';
      const parsed = attachPageInputSchema.safeParse({ pageId, title });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid page attachment input');
      }
      return AttachmentService.attachPage(targetId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Page attached to work item', { id: 'work-item-attachment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach page', { id: 'work-item-attachment' }),
  });
};

export const useDetachPage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, pageId }: { id?: string; itemId?: string; workItemId?: string; pageId: string }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return AttachmentService.detachPage(targetId, pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Page detached', { id: 'work-item-attachment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to detach page', { id: 'work-item-attachment' }),
  });
};

export const useAttachPaper = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      paperId,
      title,
      doi,
      citationKey,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
    } & AttachPaperInput) => {
      const targetId = (id || itemId || workItemId) ?? '';
      const parsed = attachPaperInputSchema.safeParse({ paperId, title, doi, citationKey });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid paper attachment input');
      }
      return AttachmentService.attachPaper(targetId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Paper attached to work item', { id: 'work-item-attachment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach paper', { id: 'work-item-attachment' }),
  });
};

export const useDetachPaper = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, paperId }: { id?: string; itemId?: string; workItemId?: string; paperId: string }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return AttachmentService.detachPaper(targetId, paperId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Paper detached', { id: 'work-item-attachment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to detach paper', { id: 'work-item-attachment' }),
  });
};

export const useAttachFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      workItemId,
      name,
      url,
      size,
      type,
    }: {
      id?: string;
      itemId?: string;
      workItemId?: string;
    } & AttachFileInput) => {
      const targetId = (id || itemId || workItemId) ?? '';
      const parsed = attachFileInputSchema.safeParse({ name, url, size, type });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid file attachment input');
      }
      return AttachmentService.attachFile(targetId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('File attached', { id: 'work-item-attachment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach file', { id: 'work-item-attachment' }),
  });
};

export const useDetachFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, fileId }: { id?: string; itemId?: string; workItemId?: string; fileId: string }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return AttachmentService.detachFile(targetId, fileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('File removed', { id: 'work-item-attachment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove file', { id: 'work-item-attachment' }),
  });
};

export const useAttachLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, title, url }: { id?: string; itemId?: string; workItemId?: string} & AttachLinkInput) => {
      const targetId = (id || itemId || workItemId) ?? '';
      const parsed = attachLinkInputSchema.safeParse({ title, url });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid link attachment input');
      }
      return AttachmentService.attachLink(targetId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Link attached', { id: 'work-item-attachment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach link', { id: 'work-item-attachment' }),
  });
};

export const useDetachLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, workItemId, linkIndex }: { id?: string; itemId?: string; workItemId?: string; linkIndex: number }) => {
      const targetId = (id || itemId || workItemId) ?? '';
      return AttachmentService.detachLink(targetId, linkIndex);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      toast.success('Link removed', { id: 'work-item-attachment' });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove link', { id: 'work-item-attachment' }),
  });
};

export const useUploadFilesWithToast = () => {
  const { uploadFileDetailed } = useUpload();
  return useCallback(
    async (
      files: File[],
      options?: {
        showSuccessToast?: boolean;
        successMessage?: string;
        errorMessage?: string;
        projectId?: string;
      }
    ) => {
      try {
        const results = await Promise.all(
          files.map(async (file) => {
            const res = await uploadFileDetailed(file, {
              prefix: options?.projectId
                ? `project/${options.projectId}`
                : undefined,
            });
            return { file, url: res.url, fileId: res.fileId };
          })
        );
        if (options?.showSuccessToast ?? true) {
          toast.success(options?.successMessage || 'File attached successfully', { id: 'work-item-upload' });
        }
        return results;
      } catch (err) {
        toast.error(options?.errorMessage || 'Failed to upload file', { id: 'work-item-upload' });
        throw err;
      }
    },
    [uploadFileDetailed]
  );
};

export const useUploadAttachmentWithToast = () => {
  const uploadFiles = useUploadFilesWithToast();
  return useCallback(
    async (file: File) => {
      const results = await uploadFiles([file]);
      return results[0]?.url;
    },
    [uploadFiles]
  );
};

export const useWorkItemAttachments = (workItemId?: string | null) => {
  return useQuery({
    queryKey: ['work-items', workItemId, 'attachments'],
    queryFn: () => (workItemId ? AttachmentService.getWorkItemAttachments(workItemId) : Promise.resolve(null)),
    enabled: Boolean(workItemId),
  });
};
export const useItemAttachments = useWorkItemAttachments;
