'use client';

/**
 * useAddFilesActions.ts
 *
 * Dedicated hook for AddFilesModal:
 * - External URL importing (backend LinkedFiles service with browser fallback)
 * - Encapsulated toast notifications for file linking and errors
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { pageKeys } from '@/features/editor/hooks/use-core';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

export interface UseAddFilesActionsOptions {
  parentPageId: string | null;
  effectiveProjectId: string;
  createFile: any;
  uploadFile: any;
  setSearchParams: (params: Record<string, string>) => void;
  onClose: () => void;
}

export function useAddFilesActions({
  parentPageId,
  effectiveProjectId,
  createFile,
  uploadFile,
  setSearchParams,
  onClose,
}: UseAddFilesActionsOptions) {
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const queryClient = useQueryClient();

  const importFromUrl = useCallback(
    async (rawUrl: string, targetName: string) => {
      if (!parentPageId || !rawUrl.trim() || !targetName.trim()) return;
      setIsFetchingUrl(true);

      try {
        // 1. Primary path: Use backend Linked Files service (SSRF-protected)
        try {
          await manuscriptService.linkedFiles.create(effectiveProjectId, {
            name: targetName,
            url: rawUrl,
            providerType: 'URL',
            provider: 'url',
          });
          toast.success(`Linked and imported ${targetName} from URL`);
          queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
          queryClient.invalidateQueries({ queryKey: ['storage-files', parentPageId] });
          EditorEventBus.emit('flux:upload-file');
          onClose();
          return;
        } catch (backendErr: any) {
          console.warn('Backend linked-file create failed, falling back to direct browser fetch:', backendErr);
          // 2. Fallback path: Direct browser fetch
          const response = await fetch(rawUrl);
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }

          const contentType = response.headers.get('content-type') || '';
          const isText =
            contentType.includes('text/') ||
            contentType.includes('json') ||
            contentType.includes('javascript') ||
            /\.(tex|bib|sty|cls|dtx|ltx|txt|md|csv|tsv|json)$/i.test(targetName);

          if (isText) {
            const textContent = await response.text();
            const created = await createFile.mutateAsync({
              parentPageId,
              title: targetName,
              content: textContent,
            });
            setSearchParams({ file: created.id });
          } else {
            const blob = await response.blob();
            const file = new File([blob], targetName, {
              type: blob.type || 'application/octet-stream',
            });
            await uploadFile.mutateAsync({
              file,
              projectId: effectiveProjectId,
              pageId: parentPageId,
            });
          }
          queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
          queryClient.invalidateQueries({ queryKey: ['storage-files', parentPageId] });
          EditorEventBus.emit('flux:upload-file');
          onClose();
        }
      } catch (err: any) {
        console.error('External URL fetch error:', err);
        toast.error(
          err?.message ||
            'Could not fetch file directly. If this domain blocks cross-origin requests (CORS), please download the file to your computer and upload it via the Upload tab.',
        );
      } finally {
        setIsFetchingUrl(false);
      }
    },
    [
      parentPageId,
      effectiveProjectId,
      createFile,
      uploadFile,
      queryClient,
      setSearchParams,
      onClose,
    ],
  );

  return {
    isFetchingUrl,
    importFromUrl,
  };
}
