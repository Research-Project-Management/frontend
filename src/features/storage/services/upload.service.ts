/**
 * @file upload.service.ts
 * @description Frontend upload facade delegating Experiment/Storage uploads to Unified SmartUploadEngine.
 */

import { resolveFileUrl } from '@/shared/lib/file-client';
import { smartUpload } from '@/shared/lib/smart-upload-engine';
import type { UploadFileParams } from '../types/storage.types';

export type { UploadFileParams };

export const uploadFile = async (
  file: File,
  params: UploadFileParams = {},
): Promise<{ fileId: string; url: string }> => {
  const result = await smartUpload(file, {
    baseEndpoint: '/api/v1/experiments/files',
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    spaceId: params.spaceId || undefined,
    parentId: params.parentId,
    metaData: params.metaData,
    onProgress: params.onProgress,
    resolveUrl: resolveFileUrl,
  });

  return { fileId: result.fileId, url: result.url };
};
