'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import type { editor } from 'monaco-editor';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { logger } from '@/shared/lib/utils';
import { parseBibContent, type BibEntry } from '@/features/editor/utils/bib-parser.util';

export interface UseEditorCitationOptions {
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  /** All page files in the project (from useQuery filesQuery) */
  pageFiles: Array<{ name: string; content?: string; url?: string }>;
}

export function useEditorCitation({
  editorRef,
  pageFiles,
}: UseEditorCitationOptions) {
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
      const ed = editorRef.current;
      if (!ed) return;
      const sel = ed.getSelection();
      if (sel) {
        ed.executeEdits('event-bus-citation', [
          {
            range: sel,
            text: `\\cite{${bibKey}}`,
            forceMoveMarkers: true,
          },
        ]);
        ed.focus();
      }
    });

    return () => {
      unsubOpen();
      unsubInsert();
    };
  }, [editorRef]);

  const handleInsertCitationSnippet = (snippet: string, _citeKey?: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (sel) {
      ed.executeEdits('citation-picker-modal', [
        {
          range: sel,
          text: snippet,
          forceMoveMarkers: true,
        },
      ]);
    }
    ed.focus();
  };

  /**
   * Register Monaco completion provider for \cite{...}
   * Reads entries from local .bib files in the project — no Library API calls.
   */
  const registerCitationProvider = (monaco: any): { dispose: () => void } => {
    return monaco.languages.registerCompletionItemProvider('latex', {
      triggerCharacters: ['{', ','],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Match \cite{..., \citep{..., \citet{..., \parencite{..., \textcite{...
        const citeMatch = textUntilPosition.match(
          /\\(cite|citep|citet|parencite|textcite|nocite)(?:\[[^\]]*\])*\{([^}]*)$/,
        );
        if (!citeMatch) return { suggestions: [] };

        const entries = bibEntriesRef.current;
        if (entries.length === 0) return { suggestions: [] };

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions = entries.map((entry) => {
          const authors = entry.authors?.join(', ') || '';
          const yearStr = entry.year ? ` (${entry.year})` : '';
          const venue = entry.journal || entry.booktitle || '';

          return {
            label: {
              label: entry.key,
              description: `${entry.type}`,
              detail: entry.title ? ` — ${entry.title.slice(0, 60)}` : '',
            },
            kind: monaco.languages.CompletionItemKind.Reference,
            detail: `${authors}${yearStr}${venue ? ` — ${venue}` : ''}`,
            documentation: {
              value: [
                `### ${entry.title || entry.key}`,
                authors ? `**Authors:** ${authors}` : null,
                entry.year ? `**Year:** ${entry.year}` : null,
                venue ? `**Venue:** *${venue}*` : null,
                entry.doi ? `**DOI:** [${entry.doi}](https://doi.org/${entry.doi})` : null,
                entry.abstract ? `\n---\n*Abstract:*\n${entry.abstract}...` : null,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
            insertText: entry.key,
            range,
            sortText: entry.key,
          };
        });

        return { suggestions };
      },
    });
  };

  return {
    bibEntries,
    citationModalOpen,
    setCitationModalOpen,
    handleInsertCitationSnippet,
    registerCitationProvider,
  };
}

