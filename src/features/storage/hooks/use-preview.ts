'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { previewServices } from '@/features/storage/services/drive.service';
import type { StorageItem } from '@/features/storage/types/storage.types';
import { resolveFileUrl } from '@/shared/lib/file-client';
import { useUpdateFileMetadata } from './use-storage';

export function usePreview(item: StorageItem | null) {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  const updateMetadataMutation = useUpdateFileMetadata();

  const itemId = item?.id;
  const itemDescription = typeof item?.metaData?.description === 'string' ? item.metaData.description : '';

  useEffect(() => {
    if (itemId) {
      setDescription(itemDescription);
      setIsSaved(true);
    } else {
      setDescription('');
      setPreviewDataUrl(null);
    }
  }, [itemId, itemDescription]);

  const generateThumbnail = useCallback(async (fileItem: StorageItem) => {
    const isPdf =
      fileItem.filename?.toLowerCase().endsWith('.pdf') ||
      fileItem.mimeType === 'application/pdf';

    if (!isPdf || !fileItem.url) {
      setPreviewDataUrl(null);
      setLoading(false);
      return;
    }

    const resolvedUrl = resolveFileUrl(fileItem.url);
    if (!resolvedUrl) return;

    try {
      setLoading(true);
      const dataUrl = await previewServices.generatePreview(resolvedUrl);
      setPreviewDataUrl(dataUrl);
    } catch {
      setPreviewDataUrl(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (item && !item.isFolder) {
      generateThumbnail(item);
    } else {
      setPreviewDataUrl(null);
      setLoading(false);
    }
  }, [item, generateThumbnail]);

  const handleSaveDescription = () => {
    if (!item?.id) return;
    updateMetadataMutation.mutate(
      {
        fileId: item.id,
        metaData: {
          ...(item.metaData || {}),
          description: description.trim(),
        },
      },
      {
        onSuccess: () => {
          setIsSaved(true);
          toast.success('Description saved');
        },
        onError: () => {
          toast.error('Failed to save description');
        },
      },
    );
  };

  return {
    previewDataUrl,
    loading,
    description,
    setDescription: (val: string) => {
      setDescription(val);
      setIsSaved(false);
    },
    isSaved,
    isSavingDescription: updateMetadataMutation.isPending,
    handleSaveDescription,
  };
}
