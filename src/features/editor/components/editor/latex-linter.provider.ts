/**
 * latex-linter.provider.ts
 *
 * Monaco Editor bridge for real-time LaTeX Linter & Spellchecker.
 * Debounces execution, registers model markers, and provides 1-click Quick Fixes.
 */

import type { editor, IDisposable } from 'monaco-editor';
import {
  runLatexLinter,
  type LatexLintDiagnostic,
  type RetractedItemInfo,
} from '@/features/editor/utils/latex-linter.util';
import { useSettingsStore } from '@/features/editor/store';

let codeActionProviderDisposable: IDisposable | null = null;

/**
 * Register the LaTeX Linter & Spellchecker on a Monaco Editor instance.
 */
export function registerLatexLinter(
  ed: editor.IStandaloneCodeEditor,
  monaco: typeof import('monaco-editor'),
  getRetractedItemsMap?: () => Map<string, RetractedItemInfo>,
): IDisposable {
  const disposables: IDisposable[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  const runLint = () => {
    const model = ed.getModel();
    if (!model) return;

    const { linterEnabled = true, spellCheck = true } = useSettingsStore.getState() as any;

    if (!linterEnabled && !spellCheck) {
      monaco.editor.setModelMarkers(model, 'latex-linter', []);
      return;
    }

    const content = model.getValue();
    const retractedItemsMap = getRetractedItemsMap?.();
    const diagnostics = runLatexLinter(content, {
      enableStructureLint: linterEnabled,
      enableSpellCheck: spellCheck,
      retractedItemsMap,
    });

    const markers: editor.IMarkerData[] = diagnostics.map((diag) => {
      let severity = monaco.MarkerSeverity.Info;
      if (diag.severity === 'error') severity = monaco.MarkerSeverity.Error;
      else if (diag.severity === 'warning') severity = monaco.MarkerSeverity.Warning;

      return {
        startLineNumber: diag.startLineNumber,
        startColumn: diag.startColumn,
        endLineNumber: diag.endLineNumber,
        endColumn: diag.endColumn,
        message: diag.message,
        severity,
        code: diag.code,
        source: 'LaTeX Linter',
      };
    });

    monaco.editor.setModelMarkers(model, 'latex-linter', markers);
  };

  // Run initial linting
  runLint();

  // Debounced linting on content change
  const contentListener = ed.onDidChangeModelContent(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(runLint, 400);
  });
  disposables.push(contentListener);

  // Register Quick Fix CodeActionProvider (singleton)
  if (!codeActionProviderDisposable) {
    codeActionProviderDisposable = monaco.languages.registerCodeActionProvider('latex', {
      provideCodeActions(model, _range, context) {
        const actions: any[] = [];

        for (const marker of context.markers) {
          if (marker.source !== 'LaTeX Linter') continue;

          // Quick fix for repeated words
          if (marker.code === 'REPEATED_WORD') {
            const raw = model.getValueInRange(marker);
            const firstWord = raw.split(/\s+/)[0];
            if (firstWord) {
              actions.push({
                title: `Remove repeated word '${firstWord}'`,
                diagnostics: [marker],
                kind: 'quickfix',
                isPreferred: true,
                edit: {
                  edits: [
                    {
                      resource: model.uri,
                      textEdit: {
                        range: marker,
                        text: firstWord,
                      },
                    },
                  ],
                },
              });
            }
          }

          // Quick fix for space before punctuation
          if (marker.code === 'SPACE_BEFORE_PUNCT') {
            const raw = model.getValueInRange(marker);
            const cleaned = raw.replace(/\s+([,;:?.!])/, '$1');
            actions.push({
              title: `Remove space before punctuation '${cleaned.slice(-1)}'`,
              diagnostics: [marker],
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: marker,
                      text: cleaned,
                    },
                  },
                ],
              },
            });
          }

          // Quick fix for unclosed environment
          if (marker.code === 'UNCLOSED_ENV') {
            const match = marker.message.match(/\\begin\{([^}]+)\}/);
            if (match) {
              const env = match[1];
              actions.push({
                title: `Insert closing \\end{${env}}`,
                diagnostics: [marker],
                kind: 'quickfix',
                isPreferred: true,
                edit: {
                  edits: [
                    {
                      resource: model.uri,
                      textEdit: {
                        range: new monaco.Range(
                          marker.endLineNumber + 1,
                          1,
                          marker.endLineNumber + 1,
                          1,
                        ),
                        text: `\\end{${env}}\n`,
                      },
                    },
                  ],
                },
              });
            }
          }

          // Quick fix for retracted citation
          if (marker.code === 'RETRACTED_CITATION') {
            const raw = model.getValueInRange(marker);
            actions.push({
              title: `Comment out retracted citation '${raw}'`,
              diagnostics: [marker],
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: marker,
                      text: `% RETRACTED: ${raw}`,
                    },
                  },
                ],
              },
            });
          }
        }

        return {
          actions,
          dispose() {},
        };
      },
    });
  }

  return {
    dispose() {
      if (timer) clearTimeout(timer);
      disposables.forEach((d) => d.dispose());
      const model = ed.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, 'latex-linter', []);
      }
    },
  };
}
