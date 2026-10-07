'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { logger } from '@/shared/lib/utils';
import { parseBibContent, type BibEntry } from '@/features/editor/utils/bib-parser.util';
import { extractCitationKeys, formatBibEntryToBibtex } from '@/features/editor/utils/citation.util';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { filesQuery } from '@/features/editor/hooks/use-core';
import { manuscriptService } from '@/features/editor/services/manuscript.service';
import { fileService } from '@/features/editor/services/core.service';
import { toast } from 'sonner';

export interface UseEditorCitationOptions {
  /** All page files in the project (from useQuery filesQuery) */
  pageFiles?: Array<{ id?: string; _id?: string; name?: string; title?: string; filename?: string; content?: string; url?: string }>;
  /** Optional library items from the project / personal scope */
  libraryItems?: any[];
  projectId?: string;
  rootPageId?: string | null;
}

export function useEditorCitation({
  pageFiles = [],
  libraryItems = [],
  projectId,
  rootPageId,
}: UseEditorCitationOptions) {
  const queryClient = useQueryClient();
  const { engine, getContent } = useEditorInstance();
  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const [initialCitationQuery, setInitialCitationQuery] = useState('');
  const [initialCitationKey, setInitialCitationKey] = useState('');

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
            volume: item.volume,
            pages: item.pages,
            publisher: item.publisher,
            url: item.url,
            source: 'library',
            collectionId: item.collectionId,
            collectionIds: item.collectionIds,
          });
        }
      }
    }

    return allEntries;
  }, [pageFiles, libraryItems]);

  const bibEntriesRef = useRef<BibEntry[]>(bibEntries);
  bibEntriesRef.current = bibEntries;

  // Extract cited keys from current document content
  const citedKeys = useMemo(() => {
    try {
      const text = getContent ? getContent() : '';
      return extractCitationKeys(text);
    } catch {
      return [];
    }
  }, [getContent, citationModalOpen]);

  // Keep track of keys currently being appended to avoid duplicate writes
  const appendingKeysRef = useRef(new Set<string>());

  const ensureEntryInBibFile = useCallback(
    async (citeKey: string, providedEntry?: BibEntry) => {
      if (!citeKey) return;
      const cleanKey = citeKey.trim();
      if (!cleanKey) return;
      const lowerKey = cleanKey.toLowerCase();

      if (appendingKeysRef.current.has(lowerKey)) {
        return;
      }

      // Check if citeKey is already present in any project .bib file
      const bibFiles = (pageFiles || []).filter((f: any) => {
        const fileName = (f?.name || f?.title || f?.filename || '').toLowerCase();
        return fileName.endsWith('.bib');
      });

      const isAlreadyPresent = bibFiles.some((f: any) => {
        if (!f?.content) return false;
        const escaped = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`@[a-zA-Z]+\\s*\\{\\s*${escaped}\\s*,`, 'i');
        return regex.test(f.content);
      });

      if (isAlreadyPresent) {
        return;
      }

      appendingKeysRef.current.add(lowerKey);

      // Locate entry metadata to generate clean BibTeX
      const entry =
        providedEntry ||
        bibEntriesRef.current.find((e) => e.key?.toLowerCase() === lowerKey);

      // Only proceed if entry exists from Library or resolved sources (don't create fake @misc on typos)
      if (!entry) {
        return;
      }

      let bibtexSnippet = entry.raw?.trim();
      if (!bibtexSnippet) {
        bibtexSnippet = formatBibEntryToBibtex(entry).trim();
      }
      if (!bibtexSnippet) {
        return;
      }

      try {
        if (bibFiles.length > 0) {
          // Find primary bib file (references.bib, refs.bib or first available)
          const targetFile =
            bibFiles.find((f: any) => {
              const name = (f?.name || f?.title || f?.filename || '').toLowerCase();
              return name === 'references.bib' || name === 'refs.bib' || name === 'ref.bib';
            }) || bibFiles[0];

          const targetId = (targetFile as any).id || (targetFile as any)._id;
          if (targetId) {
            const currentContent = targetFile.content || '';
            const separator = currentContent.endsWith('\n\n')
              ? ''
              : currentContent.endsWith('\n')
              ? '\n'
              : '\n\n';
            const updatedContent = currentContent + separator + bibtexSnippet + '\n';

            // Optimistic in-memory update
            (targetFile as any).content = updatedContent;

            await manuscriptService.docs.updateContent(targetId, updatedContent);
            if (rootPageId) {
              queryClient.invalidateQueries({ queryKey: filesQuery(rootPageId).queryKey });
            }
            const fileName = (targetFile as any).title || (targetFile as any).name || 'references.bib';
            toast.info(`Added "${cleanKey}" to ${fileName}`);
          }
        } else if (rootPageId) {
          // Overleaf parity: auto-create references.bib if project does not have one
          await fileService.create({
            parentPageId: rootPageId,
            title: 'references.bib',
            content: bibtexSnippet + '\n',
          });
          queryClient.invalidateQueries({ queryKey: filesQuery(rootPageId).queryKey });
          toast.success(`Created references.bib and added "${cleanKey}"`);
        }
      } catch (err) {
        logger.error(`[BibAutoAppend] Failed to persist citation ${cleanKey}`, { error: err });
      } finally {
        setTimeout(() => {
          appendingKeysRef.current.delete(lowerKey);
        }, 2000);
      }
    },
    [pageFiles, rootPageId, queryClient],
  );

  // Listen to external citation events (from Citation sidebar panel & CodeMirror completion)
  useEffect(() => {
    const unsubOpen = editorCommandBus.subscribe('dialog:open', (cmd) => {
      if (cmd.dialog === 'citation-picker') {
        setCitationModalOpen(true);
        if (cmd.payload && typeof cmd.payload === 'object') {
          if (cmd.payload.initialQuery) setInitialCitationQuery(cmd.payload.initialQuery);
          if (cmd.payload.initialKey) setInitialCitationKey(cmd.payload.initialKey);
        } else {
          setInitialCitationQuery('');
          setInitialCitationKey('');
        }
      }
    });

    const unsubInsert = editorCommandBus.subscribe('editor:insert-citation', (cmd) => {
      const bibKey = cmd.bibKey;
      if (!bibKey) return;
      if (!cmd.textInserted && engine) {
        engine.insertText(`\\cite{${bibKey}}`);
      }
      ensureEntryInBibFile(bibKey, cmd.entry);
    });

    return () => {
      unsubOpen();
      unsubInsert();
    };
  }, [engine, ensureEntryInBibFile]);

  const handleInsertCitationSnippet = useCallback(
    (snippet: string, citeKey?: string, entry?: BibEntry) => {
      if (engine) {
        engine.insertText(snippet);
      }
      if (citeKey) {
        ensureEntryInBibFile(citeKey, entry);
      } else {
        const match = snippet.match(/\\(?:auto|paren|text|foot|no)?cite[a-z*]*\{([^}]+)\}/i);
        if (match && match[1]) {
          const keys = match[1].split(',').map((k) => k.trim());
          for (const k of keys) {
            if (k) ensureEntryInBibFile(k, entry);
          }
        }
      }
    },
    [engine, ensureEntryInBibFile],
  );

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
    initialCitationQuery,
    initialCitationKey,
    citedKeys,
  };
}
