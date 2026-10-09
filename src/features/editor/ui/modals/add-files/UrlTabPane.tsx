'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  urlImportModalSchema,
  type UrlImportModalFormValues,
} from '@/features/editor/domain/types';
import { useAddFilesActions } from '../hooks/useAddFilesActions';

export interface UrlTabPaneProps {
  parentPageId: string | null;
  effectiveProjectId: string;
  createFile: any;
  uploadFile: any;
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
  const { isFetchingUrl, importFromUrl } = useAddFilesActions({
    parentPageId,
    effectiveProjectId,
    createFile,
    uploadFile,
    setSearchParams,
    onClose,
  });

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
