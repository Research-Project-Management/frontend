'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateFileMetadata, previewServices } from '@/features/storage/services/drive.service';
import type { StorageItem } from '@/features/storage/types/storage.types';
import { resolveFileUrl } from '@/shared/lib/file-client';
import { storageKeys } from '../constants/storage.keys';
import { usePreviewStore } from '../store/storage-ui.store';

export function usePreview(item: StorageItem | null) {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  const queryClient = useQueryClient();

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

  const saveDescriptionMutation = useMutation({
    mutationFn: (args: { fileId: string; description: string }) =>
      updateFileMetadata(args.fileId, {
        ...(item?.metaData || {}),
        description: args.description,
      }),
    onSuccess: (_data, args) => {
      setIsSaved(true);
      toast.success('Description saved');
      const current = usePreviewStore.getState().selectedItem;
      if (current && current.id === args.fileId) {
        usePreviewStore.getState().setSelectedItem({
          ...current,
          metaData: {
            ...(current.metaData || {}),
            description: args.description,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
    onError: () => {
      toast.error('Failed to save description');
    },
  });

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
    saveDescriptionMutation.mutate({
      fileId: item.id,
      description: description.trim(),
    });
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
    isSavingDescription: saveDescriptionMutation.isPending,
    handleSaveDescription,
  };
}
