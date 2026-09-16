'use client';

import { useState, useRef, useEffect } from 'react';
import type { editor } from 'monaco-editor';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { ItemService } from '@/features/library/services/items.service';
import { generateCitationKey } from '@/features/library/utils/library.util';
import { logger } from '@/shared/lib/utils';
import type { Item } from '@/features/library/types/library.types';

export interface UseEditorCitationOptions {
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  projectId: string;
}

export function useEditorCitation({
  editorRef,
  projectId,
}: UseEditorCitationOptions) {
  const [citationModalOpen, setCitationModalOpen] = useState(false);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // Listen to external citation events
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

  const handleInsertCitationSnippet = (snippet: string) => {
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

  const registerCitationProvider = (monaco: any): { dispose: () => void } => {
    return monaco.languages.registerCompletionItemProvider('latex', {
      triggerCharacters: ['{', ','],
      provideCompletionItems: async (model: any, position: any) => {
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
        if (!citeMatch) {
          return { suggestions: [] };
        }

        const currentProjectId = projectIdRef.current;

        try {
          const res = await ItemService.getAll(currentProjectId, { limit: 100 });
          const papers: any[] = Array.isArray(res)
            ? res
            : (res as any)?.papers || [];

          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          const suggestions = papers.map((p: any) => {
            const citeKey = p.citationKey || generateCitationKey(p);
            const authors = p.authors?.join(', ') || 'Unknown Author';
            const yearStr = p.year ? ` (${p.year})` : '';
            const venue = p.journal || p.publicationTitle || p.publisher || '';
            const title = p.title || 'Untitled Paper';

            return {
              label: citeKey,
              kind: monaco.languages.CompletionItemKind.Reference,
              detail: `${authors}${yearStr} — ${title}`,
              documentation: {
                value: `### ${title}\n\n**Authors:** ${authors}\n\n**Year:** ${p.year || 'N/A'}${venue ? `\n\n**Venue:** *${venue}*` : ''}${p.doi ? `\n\n**DOI:** [${p.doi}](https://doi.org/${p.doi})` : ''}${p.abstract ? `\n\n---\n*Abstract:*\n${p.abstract.slice(0, 300)}...` : ''}`,
              },
              insertText: citeKey,
              range,
            };
          });

          return { suggestions };
        } catch (err) {
          logger.warn('[Editor] Citation autocomplete error', { error: err });
          return { suggestions: [] };
        }
      },
    });
  };

  return {
    citationModalOpen,
    setCitationModalOpen,
    handleInsertCitationSnippet,
    registerCitationProvider,
  };
}
