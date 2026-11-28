import type { ItemAttachment } from '@/features/library/types/core.types';
import {
  libraryClient,
  resolveLibraryUrl,
  getItemAttachmentUrl,
  getAttachmentUrl,
  isProjectScope,
} from './http.client';
import { smartUpload } from '@/shared/lib/smart-upload-engine';

export const AttachmentsService = {
  list: async (spaceId: string, itemId: string): Promise<ItemAttachment[]> => {
    const res = await libraryClient.get<{ attachments: ItemAttachment[] }>(getItemAttachmentUrl(spaceId, itemId));
    return res.attachments || [];
  },

  delete: async (spaceId: string, attachmentId: string): Promise<boolean> => {
    const res = await libraryClient.delete<{ success: boolean }>(getAttachmentUrl(spaceId, attachmentId));
    return res.success;
  },

  create: async (spaceId: string, itemId: string, data: Record<string, unknown>): Promise<ItemAttachment> => {
    const res = await libraryClient.post<{ attachment?: ItemAttachment } | ItemAttachment>(
      getItemAttachmentUrl(spaceId, itemId),
      data,
    );
    return (res as { attachment?: ItemAttachment }).attachment ?? (res as ItemAttachment);
  },

  rename: async (spaceId: string, attachmentId: string, dto: { filename?: string; pattern?: string }) =>
    libraryClient.patch<{ attachment: ItemAttachment; oldFilename: string; newFilename: string }>(
      getAttachmentUrl(spaceId, attachmentId, 'rename'),
      dto,
    ),

  batchRename: async (spaceId: string, dto: { itemIds?: string[]; attachmentIds?: string[]; pattern?: string }) =>
    libraryClient.post<{
      renamedCount: number;
      results: Array<{ attachmentId: string; itemId: string; oldFilename: string; newFilename: string }>;
    }>(resolveLibraryUrl('extraction', '/attachments/batch-rename', spaceId), dto),

  setPrimary: (spaceId: string, itemId: string, attachmentId: string) =>
    libraryClient.post<{ success: boolean }>(
      getItemAttachmentUrl(spaceId, itemId, `${encodeURIComponent(attachmentId)}/set-primary`),
      {},
    ),
};

export const UploadService = {
  uploadFile: async (
    spaceId: string | undefined,
    file: File,
    options?: {
      contentHash?: string;
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    },
  ): Promise<{
    fileId: string;
    url: string;
    filename: string;
    size: number;
    mimeType: string;
    deduplicated?: boolean;
  }> => {
    const effectiveSpaceId = isProjectScope(spaceId) ? spaceId : undefined;
    const baseEndpoint = resolveLibraryUrl('extraction', '/attachments', effectiveSpaceId);
    const directUploadEndpoint = resolveLibraryUrl('extraction', '/upload', effectiveSpaceId);
    const result = await smartUpload(file, {
      baseEndpoint,
      directUploadEndpoint,
      filename: file.name,
      mimeType: file.type || 'application/pdf',
      spaceId: effectiveSpaceId,
      contentHash: options?.contentHash,
      headers: effectiveSpaceId ? { 'X-Space-Id': effectiveSpaceId } : undefined,
      allowDirectFallback: true,
      onProgress: options?.onProgress,
      signal: options?.signal,
    });
    return {
      fileId: result.fileId,
      url: result.url,
      filename: result.filename || file.name,
      size: result.size ?? file.size,
      mimeType: result.mimeType || file.type || 'application/pdf',
      deduplicated: result.deduplicated,
    };
  },

  uploadMultipart: async (
    spaceId: string | undefined,
    file: File,
    options?: {
      contentHash?: string;
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    },
  ) => UploadService.uploadFile(spaceId, file, options),
};
