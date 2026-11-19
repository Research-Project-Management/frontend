'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { uploadDocument } from '../transport/docs';
import type { SourceAdapter, SourceEntry, UploadingFile } from './source.port';

export const uploadSourceAdapter: SourceAdapter<{
  id: string;
  name: string;
  size?: number;
}> = {
  type: 'upload',
  toSourceEntry(item) {
    if (!item?.id) return null;
    return {
      id: item.id,
      name: item.name || 'Document',
      size: item.size,
      enabled: true,
      sourceType: 'upload',
    };
  },
};

export function useFileUpload(spaceId?: string | null) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const uploadFiles = useCallback(
    async (
      files: File[],
      overrideSpaceId?: string | null,
    ): Promise<SourceEntry[]> => {
      if (!files.length) return [];

      const targetSpaceId =
        overrideSpaceId !== undefined ? overrideSpaceId : spaceId;

      const placeholders: UploadingFile[] = files.map((file, idx) => ({
        id: `upload-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        size: file.size,
        progress: 0,
        stage: 'uploading',
      }));

      setUploadingFiles((prev) => [...prev, ...placeholders]);

      const uploaded: SourceEntry[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const tempId = placeholders[i].id;
        try {
          const res = await uploadDocument(targetSpaceId, file, (progress) => {
            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === tempId
                  ? {
                      ...item,
                      progress: progress.percent,
                      stage: progress.stage,
                    }
                  : item,
              ),
            );
          });
          const entry = uploadSourceAdapter.toSourceEntry({
            id: res.id,
            name: res.name || file.name,
            size: res.size ?? file.size,
          });
          if (entry) {
            uploaded.push(entry);
          }
        } catch (err) {
          toast.error(
            `Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Upload error'}`,
          );
        } finally {
          setUploadingFiles((prev) => prev.filter((item) => item.id !== tempId));
        }
      }

      if (uploaded.length > 0) {
        toast.success(`Attached ${uploaded.length} file(s)`);
      }

      return uploaded;
    },
    [spaceId],
  );

  return {
    uploadingFiles,
    isUploading: uploadingFiles.length > 0,
    uploadFiles,
  };
}
