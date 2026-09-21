import type * as Monaco from 'monaco-editor';

export interface FileCompletionItem {
  id?: string;
  title: string;
}

export type FileTriggerType = 'image' | 'tex' | 'bib' | 'any';

export interface FileTriggerContext {
  isTrigger: boolean;
  type: FileTriggerType;
  searchPrefix: string;
}

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.pdf',
  '.eps',
  '.svg',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
]);

const TEX_EXTENSIONS = new Set(['.tex']);
const BIB_EXTENSIONS = new Set(['.bib']);

/**
 * Detects if the current line ending at cursor is an inclusion command like:
 * - \includegraphics[...]{path
 * - \includegraphics{path
 * - \input{path
 * - \include{path
 * - \subfile{path
 * - \bibliography{path
 * - \addbibresource{path
 */
export function detectFilePathTrigger(lineUntilPosition: string): FileTriggerContext {
  // 1. \includegraphics[options]{path
  const imgMatch = lineUntilPosition.match(/\\includegraphics(?:\[[^\]]*\])?\{([^}]*)$/);
  if (imgMatch) {
    const raw = imgMatch[1] ?? '';
    const lastToken = raw.split(',').pop()?.trimStart() ?? '';
    return { isTrigger: true, type: 'image', searchPrefix: lastToken };
  }

  // 2. \input{path, \include{path, \subfile{path
  const texMatch = lineUntilPosition.match(/\\(?:input|include|subfile)\{([^}]*)$/);
  if (texMatch) {
    const raw = texMatch[1] ?? '';
    const lastToken = raw.split(',').pop()?.trimStart() ?? '';
    return { isTrigger: true, type: 'tex', searchPrefix: lastToken };
  }

  // 3. \bibliography{path, \addbibresource{path
  const bibMatch = lineUntilPosition.match(/\\(?:bibliography|addbibresource)\{([^}]*)$/);
  if (bibMatch) {
    const raw = bibMatch[1] ?? '';
    const lastToken = raw.split(',').pop()?.trimStart() ?? '';
    return { isTrigger: true, type: 'bib', searchPrefix: lastToken };
  }

  return { isTrigger: false, type: 'any', searchPrefix: '' };
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
}

/**
 * Registers Monaco completion item providers for file paths in LaTeX documents.
 * Follows Overleaf 1:1 behavior:
 * - \includegraphics -> lists all image assets & folders
 * - \input / \include -> lists .tex files (with and without extension)
 * - \bibliography -> lists .bib files
 */
export function registerFilePathCompletion(
  monaco: typeof Monaco,
  getPageFiles: () => FileCompletionItem[],
  languages: string[] = ['latex'],
): Monaco.IDisposable {
  const disposables: Monaco.IDisposable[] = [];

  for (const language of languages) {
    const disposable = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ['{', '/', ','],
      provideCompletionItems(model, position) {
        const lineUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const triggerContext = detectFilePathTrigger(lineUntilPosition);
        if (!triggerContext.isTrigger) {
          return { suggestions: [] };
        }

        const files = getPageFiles();
        if (!files || files.length === 0) {
          return { suggestions: [] };
        }

        const prefix = triggerContext.searchPrefix;
        const range = new monaco.Range(
          position.lineNumber,
          position.column - prefix.length,
          position.lineNumber,
          position.column,
        );

        const suggestions: Monaco.languages.CompletionItem[] = [];
        const seenSuggestions = new Set<string>();

        // Collect folders from file paths (e.g. "figures/diag.png" -> "figures/")
        const folders = new Set<string>();
        for (const file of files) {
          const parts = file.title.split('/');
          if (parts.length > 1) {
            let currentPath = '';
            for (let i = 0; i < parts.length - 1; i++) {
              currentPath += (currentPath ? '/' : '') + parts[i];
              folders.add(currentPath + '/');
            }
          }
        }

        // Add folder suggestions
        for (const folder of folders) {
          if (!seenSuggestions.has(folder)) {
            seenSuggestions.add(folder);
            suggestions.push({
              label: {
                label: folder,
                description: 'Directory',
              },
              kind: monaco.languages.CompletionItemKind.Folder,
              insertText: folder,
              range,
              detail: `Folder: ${folder}`,
              filterText: folder,
              sortText: `0_${folder}`,
            });
          }
        }

        // Add file suggestions based on trigger type
        for (const file of files) {
          const filename = file.title;
          const ext = getFileExtension(filename);

          let isMatch = false;
          let detail = 'Project File';

          if (triggerContext.type === 'image') {
            isMatch = IMAGE_EXTENSIONS.has(ext) || ext === '';
            detail = `Image (${ext || 'asset'})`;
          } else if (triggerContext.type === 'tex') {
            isMatch = TEX_EXTENSIONS.has(ext);
            detail = 'LaTeX document';
          } else if (triggerContext.type === 'bib') {
            isMatch = BIB_EXTENSIONS.has(ext);
            detail = 'BibTeX database';
          } else {
            isMatch = true;
          }

          if (!isMatch) continue;

          // 1. Full filename suggestion (e.g. "figures/plot.pdf")
          if (!seenSuggestions.has(filename)) {
            seenSuggestions.add(filename);
            suggestions.push({
              label: {
                label: filename,
                description: ext.slice(1).toUpperCase() || 'FILE',
              },
              kind: monaco.languages.CompletionItemKind.File,
              insertText: filename,
              range,
              detail,
              filterText: filename,
              sortText: `1_${filename}`,
            });
          }

          // 2. For .tex files or images, LaTeX often allows omitting extension
          if (triggerContext.type === 'tex' && filename.endsWith('.tex')) {
            const noExt = filename.slice(0, -4);
            if (!seenSuggestions.has(noExt)) {
              seenSuggestions.add(noExt);
              suggestions.push({
                label: {
                  label: noExt,
                  description: 'without .tex',
                },
                kind: monaco.languages.CompletionItemKind.File,
                insertText: noExt,
                range,
                detail: `LaTeX document (${noExt})`,
                filterText: noExt,
                sortText: `2_${noExt}`,
              });
            }
          } else if (triggerContext.type === 'image' && ext) {
            const noExt = filename.slice(0, filename.lastIndexOf('.'));
            if (!seenSuggestions.has(noExt)) {
              seenSuggestions.add(noExt);
              suggestions.push({
                label: {
                  label: noExt,
                  description: 'without ext',
                },
                kind: monaco.languages.CompletionItemKind.File,
                insertText: noExt,
                range,
                detail: `Image (${noExt})`,
                filterText: noExt,
                sortText: `2_${noExt}`,
              });
            }
          }
        }

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
