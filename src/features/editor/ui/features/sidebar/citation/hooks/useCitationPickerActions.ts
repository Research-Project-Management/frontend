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
 * - Insert citation command into active editor instance
 *
 * Adheres strictly to the architectural constraint:
 * All toasts are strictly managed within hooks; presentation components do not hold toast.
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { formatBibEntryToBibtex } from '@/features/editor/utils/citation.util';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import type { BibEntry } from '@/features/editor/utils/bib-parser.util';

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

  const insertCiteKey = useCallback(
    (
      key: string,
      matchedEntry?: any,
      engine?: any,
      refreshContent?: () => void,
    ) => {
      const entryPayload = matchedEntry
        ? {
            key: matchedEntry.key,
            title: matchedEntry.title,
            year: matchedEntry.year,
            journal: matchedEntry.journal,
            source: matchedEntry.source,
          }
        : undefined;

      if (engine) {
        engine.insertText(`\\cite{${key}}`);
        engine.focus();
        toast.success(`Inserted \\cite{${key}}`);
        if (refreshContent) refreshContent();
        EditorEventBus.emit('flux:insert-citation', {
          bibKey: key,
          textInserted: true,
          entry: entryPayload,
        });
        return;
      }

      EditorEventBus.emit('flux:insert-citation', {
        bibKey: key,
        textInserted: false,
        entry: entryPayload,
      });
      toast.success(`Inserted \\cite{${key}}`);
    },
    [],
  );

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
    insertCiteKey,
    resolveAcademicIdentifier,
  };
}
