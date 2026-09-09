import type * as Monaco from 'monaco-editor';
import type { CatalogItem } from '@/features/workspaces/library/types/library.types';
import { detectCitationTrigger, formatItemAuthorSummary } from '../../utils/citation.util';

/**
 * Registers Monaco completion item providers for citations in LaTeX and Markdown files.
 * Provides IntelliSense suggestions when typing \cite{...} or [@...].
 */
export function registerCitationCompletion(
  monaco: typeof Monaco,
  getItems: () => CatalogItem[],
  languages: string[] = ['latex', 'markdown'],
): Monaco.IDisposable {
  const disposables: Monaco.IDisposable[] = [];

  for (const language of languages) {
    const disposable = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['{', ',', '@'],
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

        const items = getItems();
        if (!items || items.length === 0) {
          return { suggestions: [] };
        }

        const prefix = triggerContext.searchPrefix;
        const range = new monaco.Range(
          position.lineNumber,
          position.column - prefix.length,
          position.lineNumber,
          position.column,
        );

        const suggestions: Monaco.languages.CompletionItem[] = items
          .filter((item) => Boolean(item.citationKey))
          .map((item) => {
            const authorYear = formatItemAuthorSummary(item);
            const yearStr = item.year ? ` (${item.year})` : '';
            const authorsList = item.authors?.join(', ') || 'Unknown Authors';

            return {
              label: {
                label: item.citationKey!,
                description: `${authorYear}${yearStr}`,
                detail: ` - ${item.title || 'Untitled'}`,
              },
              kind: monaco.languages.CompletionItemKind.Reference,
              insertText: item.citationKey!,
              range,
              detail: `${item.title || 'Untitled'}\n${authorsList}${yearStr}`,
              documentation: {
                value: [
                  `### ${item.title || 'Untitled'}`,
                  `**Authors:** ${authorsList}`,
                  item.journal ? `**Journal:** *${item.journal}*` : null,
                  item.year ? `**Year:** ${item.year}` : null,
                  item.doi ? `**DOI:** [${item.doi}](https://doi.org/${item.doi})` : null,
                  item.abstract ? `\n> ${item.abstract.slice(0, 300)}${item.abstract.length > 300 ? '...' : ''}` : null,
                ]
                  .filter(Boolean)
                  .join('\n\n'),
              },
              filterText: `${item.citationKey} ${item.title || ''} ${authorsList} ${item.year || ''}`,
              sortText: item.citationKey,
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
