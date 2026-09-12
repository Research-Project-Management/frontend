'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    mutationFn: ({ id, itemId, taskId, pageId, title }: { id?: string; itemId?: string; taskId?: string } & AttachPageInput) => {
      const targetId = (id || itemId || taskId) ?? '';
      const parsed = attachPageInputSchema.safeParse({ pageId, title });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid page attachment input');
      }
      return AttachmentService.attachPage(targetId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Page attached to work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach page'),
  });
};

export const useDetachPage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, taskId, pageId }: { id?: string; itemId?: string; taskId?: string; pageId: string }) => {
      const targetId = (id || itemId || taskId) ?? '';
      return AttachmentService.detachPage(targetId, pageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Page detached');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to detach page'),
  });
};

export const useAttachPaper = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      taskId,
      paperId,
      title,
      doi,
      citationKey,
    }: {
      id?: string;
      itemId?: string;
      taskId?: string;
    } & AttachPaperInput) => {
      const targetId = (id || itemId || taskId) ?? '';
      const parsed = attachPaperInputSchema.safeParse({ paperId, title, doi, citationKey });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid paper attachment input');
      }
      return AttachmentService.attachPaper(targetId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Paper attached to work item');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach paper'),
  });
};

export const useDetachPaper = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, taskId, paperId }: { id?: string; itemId?: string; taskId?: string; paperId: string }) => {
      const targetId = (id || itemId || taskId) ?? '';
      return AttachmentService.detachPaper(targetId, paperId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Paper detached');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to detach paper'),
  });
};

export const useAttachFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      itemId,
      taskId,
      name,
      url,
      size,
      type,
    }: {
      id?: string;
      itemId?: string;
      taskId?: string;
    } & AttachFileInput) => {
      const targetId = (id || itemId || taskId) ?? '';
      const parsed = attachFileInputSchema.safeParse({ name, url, size, type });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid file attachment input');
      }
      return AttachmentService.attachFile(targetId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('File attached');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach file'),
  });
};

export const useDetachFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, taskId, fileId }: { id?: string; itemId?: string; taskId?: string; fileId: string }) => {
      const targetId = (id || itemId || taskId) ?? '';
      return AttachmentService.detachFile(targetId, fileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('File removed');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove file'),
  });
};

export const useAttachLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, taskId, title, url }: { id?: string; itemId?: string; taskId?: string } & AttachLinkInput) => {
      const targetId = (id || itemId || taskId) ?? '';
      const parsed = attachLinkInputSchema.safeParse({ title, url });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || 'Invalid link attachment input');
      }
      return AttachmentService.attachLink(targetId, parsed.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Link attached');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to attach link'),
  });
};

export const useDetachLink = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, taskId, linkIndex }: { id?: string; itemId?: string; taskId?: string; linkIndex: number }) => {
      const targetId = (id || itemId || taskId) ?? '';
      return AttachmentService.detachLink(targetId, linkIndex);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-items'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Link removed');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to remove link'),
  });
};

export const useUploadFilesWithToast = () => {
  const { uploadFile } = useUpload();
  return useCallback(
    async (
      files: File[],
      options?: {
        showSuccessToast?: boolean;
        successMessage?: string;
        errorMessage?: string;
      }
    ) => {
      try {
        const results = await Promise.all(
          files.map(async (file) => {
            const url = await uploadFile(file);
            return { file, url };
          })
        );
        if (options?.showSuccessToast ?? true) {
          toast.success(options?.successMessage || 'File attached successfully');
        }
        return results;
      } catch (err) {
        toast.error(options?.errorMessage || 'Failed to upload file');
        throw err;
      }
    },
    [uploadFile]
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
