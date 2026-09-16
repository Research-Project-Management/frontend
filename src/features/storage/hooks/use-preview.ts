import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateFileMetadata } from '@/features/storage/services/file.service';
import { previewServices } from '@/features/storage/services/preview.service';
import type { StorageItem } from '@/features/storage/types/storage.types';
import { resolveFileUrl } from '@/shared/lib/file-client';
import { storageKeys } from '../constants/storage.keys';

export function usePreview(item: StorageItem | null) {
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [isSaved, setIsSaved] = useState(true);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (item) {
      setDescription(item.metaData?.description || '');
      setIsSaved(true);
    } else {
      setDescription('');
      setPreviewDataUrl(null);
    }
  }, [item?.id, item?.metaData?.description]);

  const saveDescriptionMutation = useMutation({
    mutationFn: (args: { fileId: string; description: string }) =>
      updateFileMetadata(args.fileId, {
        ...(item?.metaData || {}),
        description: args.description,
      }),
    onSuccess: () => {
      setIsSaved(true);
      toast.success('Đã lưu mô tả tệp');
      queryClient.invalidateQueries({ queryKey: storageKeys.all });
    },
    onError: () => {
      toast.error('Lỗi khi lưu mô tả tệp');
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
  }, [item?.id, item?.url, generateThumbnail]);

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
