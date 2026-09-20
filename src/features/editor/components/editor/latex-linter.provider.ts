/**
 * latex-linter.provider.ts
 *
 * Monaco Editor bridge for real-time LaTeX Linter & Syntax Diagnostics.
 * Debounces execution, registers model markers, broadcasts diagnostics,
 * and provides 1-click Quick Fixes for LaTeX pitfalls.
 */

import type { editor, IDisposable } from 'monaco-editor';
import {
  runLatexLinter,
  type LatexLintDiagnostic,
  type RetractedItemInfo,
} from '@/features/editor/utils/latex-linter.util';
import { useSettingsStore } from '@/features/editor/store';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

let codeActionProviderDisposable: IDisposable | null = null;

/**
 * Register the LaTeX Linter & Syntax Diagnostics on a Monaco Editor instance.
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

    const { linterEnabled = true } = useSettingsStore.getState() as any;

    if (!linterEnabled) {
      monaco.editor.setModelMarkers(model, 'latex-linter', []);
      EditorEventBus.emit('flux:diagnostics-updated', {
        diagnostics: [],
        errorCount: 0,
        warningCount: 0,
      });
      return;
    }

    const content = model.getValue();
    const retractedItemsMap = getRetractedItemsMap?.();
    const diagnostics = runLatexLinter(content, {
      enableStructureLint: linterEnabled,
      enableSyntaxDiagnostics: linterEnabled,
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

    // Broadcast diagnostics for status badge and problems inspector
    const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
    const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
    EditorEventBus.emit('flux:diagnostics-updated', {
      diagnostics,
      errorCount,
      warningCount,
    });
  };

  // Run initial linting
  runLint();

  // Debounced linting on content change (350ms)
  const contentListener = ed.onDidChangeModelContent(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(runLint, 350);
  });
  disposables.push(contentListener);

  // Register Quick Fix CodeActionProvider (singleton)
  if (!codeActionProviderDisposable) {
    codeActionProviderDisposable = monaco.languages.registerCodeActionProvider('latex', {
      provideCodeActions(model, _range, context) {
        const actions: any[] = [];

        for (const marker of context.markers) {
          if (marker.source !== 'LaTeX Linter') continue;

          // Quick fix for unescaped percent %
          if (marker.code === 'UNESCAPED_PERCENT') {
            actions.push({
              title: `Escape '%' with '\\%'`,
              diagnostics: [marker],
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: marker,
                      text: '\\%',
                    },
                  },
                ],
              },
            });
          }

          // Quick fix for unescaped underscore _
          if (marker.code === 'UNESCAPED_UNDERSCORE') {
            actions.push({
              title: `Escape '_' with '\\_'`,
              diagnostics: [marker],
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: marker,
                      text: '\\_',
                    },
                  },
                ],
              },
            });
          }

          // Quick fix for unescaped ampersand &
          if (marker.code === 'UNESCAPED_AMPERSAND') {
            actions.push({
              title: `Escape '&' with '\\&'`,
              diagnostics: [marker],
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: marker,
                      text: '\\&',
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

          // Quick fix for unclosed opening brace {
          if (marker.code === 'UNCLOSED_OPENING_BRACE') {
            actions.push({
              title: `Insert closing brace '}'`,
              diagnostics: [marker],
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: new monaco.Range(
                        marker.endLineNumber,
                        marker.endColumn,
                        marker.endLineNumber,
                        marker.endColumn,
                      ),
                      text: '}',
                    },
                  },
                ],
              },
            });
          }

          // Quick fix for unclosed inline math $
          if (marker.code === 'UNCLOSED_INLINE_MATH') {
            actions.push({
              title: `Close inline math with '$'`,
              diagnostics: [marker],
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: new monaco.Range(
                        marker.endLineNumber,
                        marker.endColumn,
                        marker.endLineNumber,
                        marker.endColumn,
                      ),
                      text: '$',
                    },
                  },
                ],
              },
            });
          }

          // Quick fix for command typos
          if (marker.code === 'COMMAND_TYPO') {
            const match = marker.message.match(/Did you mean '([^']+)'\?/);
            if (match) {
              const correct = match[1];
              actions.push({
                title: `Change to '${correct}'`,
                diagnostics: [marker],
                kind: 'quickfix',
                isPreferred: true,
                edit: {
                  edits: [
                    {
                      resource: model.uri,
                      textEdit: {
                        range: marker,
                        text: correct,
                      },
                    },
                  ],
                },
              });
            }
          }

          // Quick fix for deprecated LaTeX 2.09 commands
          if (marker.code === 'DEPRECATED_COMMAND') {
            const raw = model.getValueInRange(marker);
            let replacement = '\\textbf';
            if (raw === '\\it') replacement = '\\textit';
            else if (raw === '\\rm') replacement = '\\textrm';
            else if (raw === '\\tt') replacement = '\\texttt';
            else if (raw === '\\sf') replacement = '\\textsf';
            else if (raw === '\\sc') replacement = '\\textsc';
            else if (raw === '\\sl') replacement = '\\textsl';

            actions.push({
              title: `Replace '${raw}' with modern '${replacement}'`,
              diagnostics: [marker],
              kind: 'quickfix',
              isPreferred: true,
              edit: {
                edits: [
                  {
                    resource: model.uri,
                    textEdit: {
                      range: marker,
                      text: replacement,
                    },
                  },
                ],
              },
            });
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
      EditorEventBus.emit('flux:diagnostics-updated', {
        diagnostics: [],
        errorCount: 0,
        warningCount: 0,
      });
    },
  };
}

