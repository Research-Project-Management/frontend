import type * as Monaco from 'monaco-editor';

export interface LatexLabelItem {
  key: string;
  category: string;
  contextTitle?: string;
  fileSource?: string;
  lineNumber?: number;
}

const LABEL_PREFIX_MAP: Record<string, string> = {
  sec: 'Section',
  subsec: 'Subsection',
  subsubsec: 'Subsubsection',
  fig: 'Figure',
  tab: 'Table',
  eq: 'Equation',
  eqn: 'Equation',
  alg: 'Algorithm',
  lst: 'Listing',
  thm: 'Theorem',
  lem: 'Lemma',
  prop: 'Proposition',
  cor: 'Corollary',
  def: 'Definition',
  ch: 'Chapter',
  chap: 'Chapter',
  app: 'Appendix',
};

/**
 * Detects if the text before cursor is a LaTeX reference command like \ref{, \eqref{, etc.
 */
export function detectRefTrigger(lineUntilPosition: string): {
  isTrigger: boolean;
  searchPrefix: string;
} {
  const refMatch = lineUntilPosition.match(/\\(?:eq|page|auto|[cC])?ref\{([^}]*)$/);
  if (refMatch) {
    const raw = refMatch[1] ?? '';
    // If comma-separated, get the last token after comma
    const lastToken = raw.split(',').pop()?.trimStart() ?? '';
    return { isTrigger: true, searchPrefix: lastToken };
  }
  return { isTrigger: false, searchPrefix: '' };
}

/**
 * Parses LaTeX content to extract all \label{...} declarations with surrounding context.
 */
export function extractLabelsFromText(
  text: string,
  fileSource?: string,
): LatexLabelItem[] {
  if (!text || typeof text !== 'string') return [];
  const lines = text.split('\n');
  const items: LatexLabelItem[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/\\label\{([^}]+)\}/);
    if (!match) continue;

    const key = match[1].trim();
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    // Infer category from prefix (e.g. fig:architecture -> Figure)
    const colonIdx = key.indexOf(':');
    const prefix = colonIdx > 0 ? key.slice(0, colonIdx).toLowerCase() : '';
    let category = LABEL_PREFIX_MAP[prefix] || 'Reference';

    // Scan backwards up to 8 lines to find associated section or caption
    let contextTitle: string | undefined;
    for (let j = i; j >= Math.max(0, i - 8); j--) {
      const prevLine = lines[j];
      const secMatch = prevLine.match(/\\(?:chapter|(?:sub){0,2}section)\*?\{([^}]+)\}/);
      if (secMatch) {
        contextTitle = secMatch[1].trim();
        if (category === 'Reference') category = 'Section';
        break;
      }
      const capMatch = prevLine.match(/\\caption(?:\[[^\]]*\])?\{([^}]+)\}/);
      if (capMatch) {
        contextTitle = capMatch[1].trim();
        break;
      }
    }

    // If still no context title, scan forward 4 lines (e.g. \label before \caption)
    if (!contextTitle) {
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 4); j++) {
        const nextLine = lines[j];
        const capMatch = nextLine.match(/\\caption(?:\[[^\]]*\])?\{([^}]+)\}/);
        if (capMatch) {
          contextTitle = capMatch[1].trim();
          break;
        }
      }
    }

    items.push({
      key,
      category,
      contextTitle,
      fileSource,
      lineNumber: i + 1,
    });
  }

  return items;
}

/**
 * Registers a Monaco completion item provider for \ref{...}, \eqref{...}, etc.
 */
export function registerLabelCompletion(
  monaco: typeof Monaco,
  getOtherFiles?: () => Array<{ title: string; content?: any }>,
  languages: string[] = ['latex', 'markdown'],
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

        const triggerContext = detectRefTrigger(lineUntilPosition);
        if (!triggerContext.isTrigger) {
          return { suggestions: [] };
        }

        // 1. Collect labels from the current editor model
        const currentModelText = model.getValue();
        const currentLabels = extractLabelsFromText(currentModelText, 'Current File');

        // 2. Collect labels from other project files
        const otherFiles = getOtherFiles ? getOtherFiles() : [];
        const otherLabels: LatexLabelItem[] = [];
        for (const file of otherFiles) {
          const contentStr =
            typeof file.content === 'string'
              ? file.content
              : file.content && typeof file.content === 'object'
                ? ((file.content as any).source || (file.content as any).text || '')
                : '';
          if (contentStr) {
            otherLabels.push(...extractLabelsFromText(contentStr, file.title));
          }
        }

        // Merge without duplicates
        const allLabelsMap = new Map<string, LatexLabelItem>();
        [...currentLabels, ...otherLabels].forEach((item) => {
          if (!allLabelsMap.has(item.key)) {
            allLabelsMap.set(item.key, item);
          }
        });

        const allLabels = Array.from(allLabelsMap.values());
        if (allLabels.length === 0) {
          return { suggestions: [] };
        }

        const prefix = triggerContext.searchPrefix;
        const range = new monaco.Range(
          position.lineNumber,
          position.column - prefix.length,
          position.lineNumber,
          position.column,
        );

        const suggestions: Monaco.languages.CompletionItem[] = allLabels.map((item) => {
          return {
            label: {
              label: item.key,
              description: item.category,
              detail: item.contextTitle ? ` — ${item.contextTitle}` : '',
            },
            kind: monaco.languages.CompletionItemKind.Reference,
            insertText: item.key,
            range,
            detail: `${item.category}: \\label{${item.key}}${item.contextTitle ? `\n"${item.contextTitle}"` : ''}`,
            documentation: {
              value: [
                `### ${item.category}: \`${item.key}\``,
                item.contextTitle ? `> ${item.contextTitle}` : null,
                item.fileSource ? `*Source:* \`${item.fileSource}\`${item.lineNumber ? ` (Line ${item.lineNumber})` : ''}` : null,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
            filterText: `${item.key} ${item.category} ${item.contextTitle || ''}`,
            sortText: item.key,
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
