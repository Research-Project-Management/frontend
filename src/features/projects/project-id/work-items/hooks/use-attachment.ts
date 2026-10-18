'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUpload } from "@/shared/hooks/use-upload";
import { workItemApi } from '@/features/projects/project-id/work-items/api/work-item.api';
import type {
  AttachPageInput,
  AttachPaperInput,
  AttachFileInput,
  AttachLinkInput,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import {
  attachPageInputSchema,
  attachPaperInputSchema,
  attachFileInputSchema,
  attachLinkInputSchema,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import { workItemToast } from './use-work-item-toast';

type WithTargetId = { id?: string; itemId?: string; workItemId?: string };

function resolveTargetId(vars: WithTargetId): string {
  return (vars.id || vars.itemId || vars.workItemId) ?? '';
}

function createAttachmentMutation<TVars extends WithTargetId, TResult = unknown>(config: {
  mutationFn: (targetId: string, vars: TVars) => Promise<TResult>;
  successMessage: string;
  errorMessage: string;
}) {
  return () => {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (vars: TVars) => config.mutationFn(resolveTargetId(vars), vars),
      onSuccess: (_data, vars) => {
        const targetId = resolveTargetId(vars);
        queryClient.invalidateQueries({ queryKey: ['work-items'] });
        if (targetId) {
          queryClient.invalidateQueries({ queryKey: ['work-items', targetId, 'attachments'] });
          queryClient.invalidateQueries({ queryKey: ['work-item-activity', targetId] });
        }
        workItemToast.success(config.successMessage, 'attachment');
      },
      onError: (error: Error) =>
        workItemToast.error(error, config.errorMessage, 'attachment'),
    });
  };
}

export const useAttachPage = createAttachmentMutation<WithTargetId & AttachPageInput>({
  mutationFn: (targetId, { pageId, title }) => {
    const parsed = attachPageInputSchema.safeParse({ pageId, title });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || 'Invalid page attachment input');
    }
    return workItemApi.attachments.attachPage(targetId, parsed.data);
  },
  successMessage: 'Page attached to work item',
  errorMessage: 'Failed to attach page',
});

export const useDetachPage = createAttachmentMutation<WithTargetId & { pageId: string }>({
  mutationFn: (targetId, { pageId }) => workItemApi.attachments.detachPage(targetId, pageId),
  successMessage: 'Page detached',
  errorMessage: 'Failed to detach page',
});

export const useAttachPaper = createAttachmentMutation<WithTargetId & AttachPaperInput>({
  mutationFn: (targetId, { paperId, title, doi, citationKey }) => {
    const parsed = attachPaperInputSchema.safeParse({ paperId, title, doi, citationKey });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || 'Invalid paper attachment input');
    }
    return workItemApi.attachments.attachPaper(targetId, parsed.data);
  },
  successMessage: 'Paper attached to work item',
  errorMessage: 'Failed to attach paper',
});

export const useDetachPaper = createAttachmentMutation<WithTargetId & { paperId: string }>({
  mutationFn: (targetId, { paperId }) => workItemApi.attachments.detachPaper(targetId, paperId),
  successMessage: 'Paper detached',
  errorMessage: 'Failed to detach paper',
});

export const useAttachFile = createAttachmentMutation<WithTargetId & AttachFileInput>({
  mutationFn: (targetId, { name, url, size, type }) => {
    const parsed = attachFileInputSchema.safeParse({ name, url, size, type });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || 'Invalid file attachment input');
    }
    return workItemApi.attachments.attachFile(targetId, parsed.data);
  },
  successMessage: 'File attached',
  errorMessage: 'Failed to attach file',
});

export const useDetachFile = createAttachmentMutation<WithTargetId & { fileId: string }>({
  mutationFn: (targetId, { fileId }) => workItemApi.attachments.detachFile(targetId, fileId),
  successMessage: 'File removed',
  errorMessage: 'Failed to remove file',
});

export const useAttachLink = createAttachmentMutation<WithTargetId & AttachLinkInput>({
  mutationFn: (targetId, { title, url }) => {
    const parsed = attachLinkInputSchema.safeParse({ title, url });
    if (!parsed.success) {
      throw new Error(parsed.error.issues[0]?.message || 'Invalid link attachment input');
    }
    return workItemApi.attachments.attachLink(targetId, parsed.data);
  },
  successMessage: 'Link attached',
  errorMessage: 'Failed to attach link',
});

export const useDetachLink = createAttachmentMutation<WithTargetId & { linkIndex: number }>({
  mutationFn: (targetId, { linkIndex }) => workItemApi.attachments.detachLink(targetId, linkIndex),
  successMessage: 'Link removed',
  errorMessage: 'Failed to remove link',
});

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
          workItemToast.success(options?.successMessage || 'File attached successfully', 'upload');
        }
        return results;
      } catch (err) {
        workItemToast.error(err, options?.errorMessage || 'Failed to upload file', 'upload');
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
    queryFn: () => (workItemId ? workItemApi.attachments.getWorkItemAttachments(workItemId) : Promise.resolve(null)),
    enabled: Boolean(workItemId),
  });
};

