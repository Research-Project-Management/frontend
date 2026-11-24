'use client';

/**
 * useCitationPickerActions.ts
 *
 * Dedicated custom hook encapsulating citation actions, identifier resolution, and notifications:
 * - Copy formatted citation snippet to clipboard
 * - Copy raw BibTeX entry
 * - Copy citation key
 * - Copy DOI
 * - Resolve academic identifier (DOI / arXiv / BibTeX via backend)
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { pagesService } from '@/features/editor/sdk/pages.service';
import {
  formatBibEntryToBibtex,
  parseBibtexAuthors,
  cleanBibtexTitle,
} from '@/features/editor/subsystems/citation/model/citation-formatter';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';

export function useCitationPickerActions() {
  const [isResolving, setIsResolving] = useState(false);

  const copyCitationSnippet = useCallback((snippet: string) => {
    navigator.clipboard.writeText(snippet);
    toast.success('Copied');
  }, []);

  const copyBibtex = useCallback((entry: BibEntry) => {
    const code = formatBibEntryToBibtex(entry);
    navigator.clipboard.writeText(code);
    toast.success('Copied BibTeX');
  }, []);

  const copyKey = useCallback((key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Copied citation key');
  }, []);

  const copyDoi = useCallback((doi: string) => {
    navigator.clipboard.writeText(doi);
    toast.success('Copied DOI');
  }, []);

  const copyCiteKey = useCallback((key: string) => {
    navigator.clipboard.writeText(`\\cite{${key}}`);
    toast.success('Copied citation');
  }, []);

  const resolveAcademicIdentifier = useCallback(
    async (projectId: string, query: string): Promise<BibEntry | null> => {
      const trimmed = query.trim();
      if (!projectId || !trimmed) return null;

      setIsResolving(true);
      try {
        const res = await pagesService.citations.resolve(projectId, trimmed);
        const resolved = res?.entries?.[0];
        if (resolved?.key) {
          toast.success(`Resolved BibTeX for ${resolved.key}`);
          const newEntry: BibEntry = {
            key: resolved.key,
            type: resolved.type || 'article',
            title: cleanBibtexTitle(resolved.title),
            authors: Array.isArray(resolved.authors) ? resolved.authors : parseBibtexAuthors(resolved.author),
            author: Array.isArray(resolved.authors) ? resolved.authors.join(' and ') : resolved.author,
            year: resolved.year,
            journal: resolved.journal,
            doi: resolved.doi,
            source: 'server',
            sourceFile: resolved.sourceFile || res.filePath || 'references.bib',
          };
          return newEntry;
        } else {
          toast.error('Identifier could not be resolved');
          return null;
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to resolve academic identifier';
        toast.error(message);
        return null;
      } finally {
        setIsResolving(false);
      }
    },
    [],
  );

  const syncLibraryToProject = useCallback(
    async (projectId: string, collectionId?: string | null, targetFilename?: string) => {
      if (!projectId) return null;
      try {
        const res = await pagesService.citations.syncLibrary(projectId, {
          collectionId: collectionId ?? '',
          targetBibFile: targetFilename,
        });
        if (res?.conflicts && res.conflicts.length > 0) {
          toast.warning(
            `Synced ${res.entries.length} references (${res.conflicts.length} conflicting citekey(s) skipped: ${res.conflicts.slice(0, 3).join(', ')})`,
          );
        } else if (res) {
          toast.success(`Synced ${res.entries.length} references to ${res.filePath}`);
        }
        return res;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to sync library references';
        toast.error(message);
        return null;
      }
    },
    [],
  );

  return {
    isResolving,
    copyCitationSnippet,
    copyBibtex,
    copyKey,
    copyDoi,
    copyCiteKey,
    resolveAcademicIdentifier,
    syncLibraryToProject,
  };
}
