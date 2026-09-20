import type * as Monaco from 'monaco-editor';
import type { BibEntry } from '../../utils/bib-parser.util';
import { detectCitationTrigger } from '../../utils/citation.util';

/**
 * Registers Monaco completion item providers for citations in LaTeX files.
 * Provides IntelliSense suggestions when typing \cite{...}.
 *
 * Source: Follows Overleaf's approach — reads entries from local .bib files
 * in the project, NOT from the Library module (which is not connected to Editor).
 */
export function registerCitationCompletion(
  monaco: typeof Monaco,
  getItems: () => BibEntry[],
  languages: string[] = ['latex'],
): Monaco.IDisposable {
  const disposables: Monaco.IDisposable[] = [];

  for (const language of languages) {
    const disposable = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['{', ','],
      provideCompletionItems(model, position) {
        const lineUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const triggerContext = detectCitationTrigger(lineUntilPosition);
        if (!triggerContext.isTrigger) {
          return { suggestions: [] };
        }

        const entries = getItems();
        if (!entries || entries.length === 0) {
          return { suggestions: [] };
        }

        const prefix = triggerContext.searchPrefix;
        const range = new monaco.Range(
          position.lineNumber,
          position.column - prefix.length,
          position.lineNumber,
          position.column,
        );

        const suggestions: Monaco.languages.CompletionItem[] = entries.map((entry) => {
          const authors = entry.authors?.join(', ') || '';
          const yearStr = entry.year ? ` (${entry.year})` : '';
          const venue = entry.journal || entry.booktitle || '';

          return {
            label: {
              label: entry.key,
              description: entry.type,
              detail: entry.title ? ` — ${entry.title.slice(0, 60)}` : '',
            },
            kind: monaco.languages.CompletionItemKind.Reference,
            insertText: entry.key,
            range,
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
            filterText: `${entry.key} ${entry.title || ''} ${authors} ${entry.year || ''}`,
            sortText: entry.key,
          };
        });

        return { suggestions };
      },
    });

    disposables.push(disposable);
  }

  return {
    dispose() {
      disposables.forEach((d) => d.dispose());
    },
  };
}
