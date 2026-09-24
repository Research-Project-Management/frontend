'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { logger } from '@/shared/lib/utils';
import { parseBibContent, type BibEntry } from '@/features/editor/utils/bib-parser.util';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';

export interface UseEditorCitationOptions {
  editorRef?: React.MutableRefObject<any>;
  /** All page files in the project (from useQuery filesQuery) */
  pageFiles: Array<{ name: string; content?: string; url?: string }>;
}

export function useEditorCitation({
  pageFiles,
}: UseEditorCitationOptions) {
  const { engine } = useEditorInstance();
  const [citationModalOpen, setCitationModalOpen] = useState(false);

  // Parse BibTeX entries from all .bib files in the project
  const bibEntries = useMemo<BibEntry[]>(() => {
    const bibFiles = pageFiles.filter(
      (f) => f.name?.toLowerCase().endsWith('.bib') && f.content,
    );
    if (bibFiles.length === 0) return [];

    const allEntries: BibEntry[] = [];
    const seenKeys = new Set<string>();
    for (const f of bibFiles) {
      try {
        const entries = parseBibContent(f.content!);
        for (const entry of entries) {
          if (!seenKeys.has(entry.key)) {
            seenKeys.add(entry.key);
            allEntries.push(entry);
          }
        }
      } catch (err) {
        logger.warn(`[BibParser] Failed to parse ${f.name}`, { error: err });
      }
    }
    return allEntries;
  }, [pageFiles]);

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
    bibEntries,
    citationModalOpen,
    setCitationModalOpen,
    handleInsertCitationSnippet,
    registerCitationProvider,
  };
}
