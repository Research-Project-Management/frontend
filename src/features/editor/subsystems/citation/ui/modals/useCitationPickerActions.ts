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
import { manuscriptService } from '@/features/editor/sdk/manuscript.service';
import { formatBibEntryToBibtex } from '@/features/editor/subsystems/citation/model/citation-formatter';
import type { BibEntry } from '@/features/editor/domain/latex/bib-parser';

export function useCitationPickerActions() {
  const [isResolving, setIsResolving] = useState(false);

  const copyCitationSnippet = useCallback((snippet: string) => {
    navigator.clipboard.writeText(snippet);
    toast.success(`Copied "${snippet}"`);
  }, []);

  const copyBibtex = useCallback((entry: BibEntry) => {
    const code = formatBibEntryToBibtex(entry);
    navigator.clipboard.writeText(code);
    toast.success(`Copied BibTeX for ${entry.key}`);
  }, []);

  const copyKey = useCallback((key: string) => {
    navigator.clipboard.writeText(key);
    toast.success(`Copied citation key "${key}"`);
  }, []);

  const copyDoi = useCallback((doi: string) => {
    navigator.clipboard.writeText(doi);
    toast.success(`Copied DOI "${doi}"`);
  }, []);

  const copyCiteKey = useCallback((key: string) => {
    navigator.clipboard.writeText(`\\cite{${key}}`);
    toast.success(`Copied \\cite{${key}} to clipboard`);
  }, []);

  const resolveAcademicIdentifier = useCallback(
    async (projectId: string, query: string): Promise<BibEntry | null> => {
      const trimmed = query.trim();
      if (!projectId || !trimmed) return null;

      setIsResolving(true);
      try {
        const res = await manuscriptService.citations.resolve(projectId, trimmed);
        if (res?.entry?.key) {
          toast.success(`Resolved BibTeX for ${res.entry.key}`);
          const newEntry: BibEntry = {
            key: res.entry.key,
            type: res.entry.type || 'article',
            title: res.entry.title,
            authors: res.entry.author ? [res.entry.author] : undefined,
            year: res.entry.year,
            journal: res.entry.journal,
            doi: res.entry.doi,
            raw: res.entry.rawBibtex,
            source: 'server',
            sourceFile: 'server',
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

  return {
    isResolving,
    copyCitationSnippet,
    copyBibtex,
    copyKey,
    copyDoi,
    copyCiteKey,
    resolveAcademicIdentifier,
  };
}
