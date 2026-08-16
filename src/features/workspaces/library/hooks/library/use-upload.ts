'use client';

import { useState, useCallback } from 'react';
import { uploadFile, getAllFiles, createFolder } from '@/features/workspaces/storage/services/file.service';




interface UseUploadOptions {
  workspaceId: string;
}

interface UseUploadReturn {
  uploading: boolean;
  uploadedUrl: string | null;
  uploadToStorage: (file: File) => Promise<string>;
  reset: () => void;
}

/**
 * Wraps file service calls for uploading papers to workspace storage.
 * Ensures a "Paper Upload" folder exists before uploading.
 */
export function useUpload({ workspaceId }: UseUploadOptions): UseUploadReturn {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const upload = useCallback(async (file: File): Promise<string> => {
    setUploading(true);
    try {
      let folderId = null;
      try {
        const data = (await getAllFiles(workspaceId, null)) as any;
        const files = data?.files || [];
        const existingFolder = files.find(
          (item: any) => item.isFolder && item.filename === 'Paper Upload',
        );
        if (existingFolder) {
          folderId = existingFolder._id;
        } else {
          const newFolder = (await createFolder('Paper Upload', {
            workspaceId,
          })) as any;
          folderId = newFolder?.folder?._id || newFolder?._id;
        }
      } catch (e) {
        console.error('Failed to setup library upload folder:', e);
      }

      const res = (await uploadFile(file, {
        workspaceId,
        parentId: folderId,
      })) as any;

      const fileUrl = res?.file?.url || res?.url;
      if (!fileUrl) throw new Error('Upload failed: missing url');

      setUploadedUrl(fileUrl);
      return fileUrl;
    } finally {
      setUploading(false);
    }
  }, [workspaceId]);

  const reset = useCallback(() => {
    setUploading(false);
    setUploadedUrl(null);
  }, []);

  return { uploading, uploadedUrl, uploadToStorage: upload, reset };
}
