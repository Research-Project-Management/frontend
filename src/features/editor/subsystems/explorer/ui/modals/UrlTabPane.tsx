'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { invalidateFileTreeQueries } from '@/features/editor/core/queries/document.queries';
import {
  editorCommandBus,
  usePageStore,
  resolveEditorScopeFromState,
} from '@/features/editor/core';

export interface UrlTabPaneProps {
  parentPageId: string | null;
  projectId?: string;
  onClose: () => void;
}

export function UrlTabPane({
  parentPageId,
  projectId,
  onClose,
}: UrlTabPaneProps) {
  const queryClient = useQueryClient();
  const resolvedSpaceId = usePageStore(
    (s) => resolveEditorScopeFromState(s, { pageId: parentPageId, projectId }).effectiveScopeId,
  );
  const [url, setUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    const targetSpaceId = resolvedSpaceId || projectId || parentPageId || '';
    if (!targetSpaceId) {
      toast.error('Unable to resolve target workspace for URL import.');
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading('Fetching file from URL...');
    try {
      const res = await pagesService.export.importFromUrl(targetSpaceId, {
        url: trimmedUrl,
        filename: filename.trim() || undefined,
        pageId: parentPageId || undefined,
      });

      invalidateFileTreeQueries(queryClient, {
        parentPageId: parentPageId || undefined,
        includeDeleted: false,
      });
      editorCommandBus.dispatch({ type: 'filetree:updated' });

      toast.success(`Imported ${res.filename}`, { id: toastId });
      setUrl('');
      setFilename('');
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to import file from URL.',
        { id: toastId },
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex-1 flex flex-col justify-between"
    >
      <div className="space-y-4">
        <div className="space-y-1.5 pt-1">
          <label htmlFor="import-url-input" className="text-12 font-medium text-foreground">
            URL to fetch file from
          </label>
          <Input
            id="import-url-input"
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/paper/references.bib"
            className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="import-url-filename" className="text-12 font-medium text-foreground">
            File name in this project
          </label>
          <Input
            id="import-url-filename"
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="Optional — inferred from URL if left blank"
            className="h-8 text-12 bg-muted/40 rounded-md border-border/60 focus:bg-background"
          />
          <p className="text-11 text-muted-foreground">
            Supports HTTP/HTTPS URLs up to 25 MB (.tex, .bib, .sty, .cls, figures, PDFs).
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-border mt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isImporting}
          className="w-full sm:w-auto h-8 px-4 text-12 font-medium cursor-pointer rounded-md border-border bg-background hover:bg-muted text-foreground shadow-none"
        >
          Close
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isImporting || !url.trim()}
          className="w-full sm:w-auto h-8 px-4 text-12 font-medium cursor-pointer rounded-md bg-primary hover:bg-primary-hover text-primary-foreground shadow-none gap-1.5"
        >
          {isImporting && (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" strokeWidth={1.5} />
          )}
          <span>Create</span>
        </Button>
      </div>
    </form>
  );
}
