'use client';

import React, { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  urlImportModalSchema,
  type UrlImportModalFormValues,
} from '@/features/editor/domain/types';
import { manuscriptService } from '@/features/editor/sdk';
import { pageKeys } from '@/features/editor/ui/hooks/document.queries';

export interface UrlTabPaneProps {
  parentPageId: string | null;
  effectiveProjectId: string;
  createFile: {
    mutateAsync: (vars: { parentPageId: string; title: string; content?: string }) => Promise<{ id: string }>;
  };
  uploadFile: {
    mutateAsync: (vars: { file: File; projectId: string; pageId: string }) => Promise<unknown>;
  };
  setSearchParams: (params: Record<string, string>) => void;
  onClose: () => void;
}

export function UrlTabPane({
  parentPageId,
  effectiveProjectId,
  createFile,
  uploadFile,
  setSearchParams,
  onClose,
}: UrlTabPaneProps) {
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
          toast.success(`Linked and imported ${targetName} from URL`, { id: `url-import-${targetName}` });
          queryClient.invalidateQueries({ queryKey: pageKeys.files(parentPageId) });
          queryClient.invalidateQueries({ queryKey: ['storage-files', parentPageId] });
          onClose();
          return;
        } catch (backendErr: unknown) {
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
          toast.success(`Imported ${targetName} from URL`, { id: `url-import-${targetName}` });
          onClose();
        }
      } catch (err: unknown) {
        console.error('External URL fetch error:', err);
        toast.error(
          (err as Error)?.message ||
            'Could not fetch file directly. If this domain blocks cross-origin requests (CORS), please download the file to your computer and upload it via the Upload tab.',
          { id: 'url-import-error' }
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

  const {
    register: registerUrl,
    handleSubmit: handleSubmitUrl,
    setValue: setUrlValue,
    watch: watchUrl,
    reset: resetUrl,
    formState: { errors: urlErrors },
  } = useForm<UrlImportModalFormValues>({
    resolver: zodResolver(urlImportModalSchema),
    defaultValues: { url: '', fileName: '' },
  });

  const handleUrlInputChange = (val: string) => {
    setUrlValue('url', val, { shouldValidate: true });
    try {
      const urlObj = new URL(val);
      const cleanPath = urlObj.pathname.split('/').filter(Boolean).pop();
      if (cleanPath && !watchUrl('fileName')) {
        setUrlValue('fileName', decodeURIComponent(cleanPath), { shouldValidate: true });
      }
    } catch {
      // not valid full URL yet
    }
  };

  const handleFetchFromUrl = async (data: UrlImportModalFormValues) => {
    if (!parentPageId) return;
    await importFromUrl(data.url, data.fileName);
    resetUrl();
  };

  return (
    <form
      onSubmit={handleSubmitUrl(handleFetchFromUrl)}
      className="flex-1 flex flex-col justify-between"
    >
      <div className="space-y-3 pt-1">
        <div className="space-y-1">
          <label className="text-12 font-medium text-foreground">
            URL to fetch
          </label>
          <Input
            {...registerUrl('url')}
            onChange={(e) => handleUrlInputChange(e.target.value)}
            placeholder="https://example.com/dataset.csv or raw GitHub URL"
            className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
          />
          {urlErrors.url && (
            <p className="text-11 text-destructive">{urlErrors.url.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-12 font-medium text-foreground">
            File name in this project
          </label>
          <Input
            {...registerUrl('fileName')}
            placeholder="e.g. data.csv, imported.tex"
            className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
          />
          {urlErrors.fileName && (
            <p className="text-11 text-destructive">{urlErrors.fileName.message}</p>
          )}
        </div>

        <p className="text-11 text-muted-foreground">
          Note: The URL must allow direct public access. For files on GitHub, use the raw content URL.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
        >
          Close
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isFetchingUrl}
          className="h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
        >
          {isFetchingUrl && (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
          )}
          <span>Create</span>
        </Button>
      </div>
    </form>
  );
}
