'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { logger } from '@/shared/lib/utils';
import { parseBibContent, type BibEntry } from '@/features/editor/utils/bib-parser.util';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';

export interface UseEditorCitationOptions {
  /** All page files in the project (from useQuery filesQuery) */
  pageFiles?: Array<{ name?: string; title?: string; filename?: string; content?: string; url?: string }>;
  /** Optional library items from the project / personal scope */
  libraryItems?: any[];
  projectId?: string;
}

export function useEditorCitation({
  pageFiles = [],
  libraryItems = [],
  projectId,
}: UseEditorCitationOptions) {
  const { engine } = useEditorInstance();
  const [citationModalOpen, setCitationModalOpen] = useState(false);

  // Parse BibTeX entries from all .bib files in the project + enrich with Library items
  const bibEntries = useMemo<BibEntry[]>(() => {
    const bibFiles = (pageFiles || []).filter((f: any) => {
      const fileName = (f?.name || f?.title || f?.filename || '').toLowerCase();
      return fileName.endsWith('.bib') && Boolean(f?.content);
    });

    const allEntries: BibEntry[] = [];
    const seenKeys = new Set<string>();

    for (const f of bibFiles) {
      try {
        const entries = parseBibContent(f.content!);
        for (const entry of entries) {
          const lowerKey = entry.key?.toLowerCase();
          if (lowerKey && !seenKeys.has(lowerKey)) {
            seenKeys.add(lowerKey);
            allEntries.push(entry);
          }
        }
      } catch (err) {
        logger.warn(`[BibParser] Failed to parse ${(f as any).name || (f as any).title}`, { error: err });
      }
    }

    // Enrich with items from project Library
    if (Array.isArray(libraryItems)) {
      for (const item of libraryItems) {
        const key = item.citationKey || item.key;
        const lowerKey = key?.toLowerCase();
        if (lowerKey && !seenKeys.has(lowerKey)) {
          seenKeys.add(lowerKey);
          allEntries.push({
            key,
            type: item.itemType || 'article',
            title: item.title,
            authors: Array.isArray(item.authors)
              ? item.authors
              : (item.firstAuthor ? [item.firstAuthor] : undefined),
            year: item.year ? String(item.year) : undefined,
            journal: item.publicationTitle || item.journal,
            doi: item.doi,
            abstract: item.abstract,
          });
        }
      }
    }

    return allEntries;
  }, [pageFiles, libraryItems]);

  const bibEntriesRef = useRef<BibEntry[]>(bibEntries);
  bibEntriesRef.current = bibEntries;

  // Listen to external citation events (from Citation sidebar panel)
  useEffect(() => {
    const unsubOpen = EditorEventBus.on('flux:open-citation-picker', () => {
      setCitationModalOpen(true);
    });

    const unsubInsert = EditorEventBus.on('flux:insert-citation', (detail) => {
      const bibKey = detail?.bibKey;
      if (!bibKey) return;
      if (engine) {
        engine.insertText(`\\cite{${bibKey}}`);
      }
    });

    return () => {
      unsubOpen();
      unsubInsert();
    };
  }, [engine]);

  const handleInsertCitationSnippet = (snippet: string, _citeKey?: string) => {
    if (engine) {
      engine.insertText(snippet);
    }
  };

  const registerCitationProvider = (_monaco?: any): { dispose: () => void } => {
    return {
      dispose: () => {},
    };
  };

  return {
    projectId,
    bibEntries,
    citationModalOpen,
    setCitationModalOpen,
    handleInsertCitationSnippet,
    registerCitationProvider,
  };
}
