/**
 * latex-linter-extension.ts
 *
 * CodeMirror 6 Linter Extension for LaTeX syntax checking, retracted citations,
 * and TeX compiler diagnostics with interval-indexed file partitioning.
 */

import { lintGutter, linter, type Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { runLatexLinter, type RetractedItemInfo } from '../../../utils/latex-linter.util';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import { diagnosticsCoordinator } from '../../../core/coordinators/diagnostics.coordinator';
import type { CompileError } from '../../../types/compiler.types';

export function createLatexLinterExtension(
  getRetractedMap?: () => Map<string, RetractedItemInfo> | undefined,
  getCompilerErrors?: () => CompileError[] | undefined,
  isCodeCheckEnabled?: () => boolean,
  getFilePath?: () => string | undefined,
) {
  return [
    lintGutter({
      markerFilter: (diagnostics) =>
        diagnostics.filter((d) => d.source !== 'Spell Check' && d.source !== 'spelling'),
      tooltipFilter: (diagnostics) =>
        diagnostics.filter((d) => d.source !== 'Spell Check' && d.source !== 'spelling'),
    }),
    linter(
      (view) => {
        const doc = view.state.doc;
        const text = doc.toString();
        const diagnostics: Diagnostic[] = [];

        // 1. Client-side AST/Syntax Code Check (when enabled in settings)
        if (isCodeCheckEnabled?.() !== false) {
          const rawDiags = runLatexLinter(text, {
            retractedItemsMap: getRetractedMap?.(),
          });

          for (const d of rawDiags) {
            const startLineNum = Math.min(Math.max(1, d.startLineNumber), doc.lines);
            const endLineNum = Math.min(Math.max(1, d.endLineNumber), doc.lines);

            const startLine = doc.line(startLineNum);
            const endLine = doc.line(endLineNum);

            const from = Math.min(startLine.from + Math.max(0, d.startColumn - 1), startLine.to);
            const to = Math.min(endLine.from + Math.max(0, d.endColumn - 1), endLine.to);

            const lintActions: Array<{ name: string; apply: (view: EditorView, from: number, to: number) => void }> = [];
            if (d.suggestions && d.suggestions.length > 0) {
              d.suggestions.forEach((sug) => {
                lintActions.push({
                  name: `Fix: ${sug}`,
                  apply: (editorView: EditorView, aFrom: number, aTo: number) => {
                    editorView.dispatch({
                      changes: { from: aFrom, to: aTo, insert: sug },
                    });
                  },
                });
              });
            }

            lintActions.push({
              name: '✦ Suggest fix',
              apply: () => {
                editorCommandBus.dispatch({
                  type: 'editor:suggest-fix',
                  error: {
                    message: d.message,
                    line: startLineNum,
                  },
                });
              },
            });

            diagnostics.push({
              from: Math.min(from, to),
              to: Math.max(from, to, from + 1),
              severity: d.severity,
              message: d.message,
              source: 'LaTeX Code Check',
              actions: lintActions,
            });
          }
        }

        // 2. Real LaTeX Compiler Diagnostics (TeX Engine: pdflatex / xelatex / lualatex)
        const currentFile = getFilePath?.();
        const indexedErrors = currentFile ? diagnosticsCoordinator.getDiagnosticsForFile(currentFile) : [];

        // Fallback to raw compilerErrors if coordinator has not ingested yet
        const rawErrors = getCompilerErrors?.() || [];
        const effectiveErrors = indexedErrors.length > 0
          ? indexedErrors
          : rawErrors.filter((err) => {
              if (!currentFile || !err.file) return true;
              return (
                err.file === currentFile ||
                currentFile.endsWith(`/${err.file}`) ||
                err.file.endsWith(`/${currentFile}`)
              );
            });

        for (const err of effectiveErrors) {
          const lineNum = err.line ? Math.min(Math.max(1, err.line), doc.lines) : 1;
          const line = doc.line(lineNum);

          const from = line.from;
          const to = Math.max(line.from + 1, line.to);

          const compilerActions: Array<{ name: string; apply: (view: EditorView, from: number, to: number) => void }> = [];

          if (err.suggestion) {
            compilerActions.push({
              name: `Fix: ${err.suggestion}`,
              apply: (editorView: EditorView, aFrom: number, aTo: number) => {
                editorView.dispatch({
                  changes: { from: aFrom, to: aTo, insert: err.suggestion! },
                });
              },
            });
          }

          compilerActions.push({
            name: '✦ Suggest fix',
            apply: () => {
              editorCommandBus.dispatch({
                type: 'editor:suggest-fix',
                error: {
                  message: err.message,
                  line: err.line ?? undefined,
                  file: err.file,
                  context: err.context,
                },
              });
            },
          });

          diagnostics.push({
            from,
            to,
            severity: err.severity === 'warning' ? 'warning' : 'error',
            message: err.message,
            source: 'LaTeX Compiler',
            actions: compilerActions,
          });
        }

        return diagnostics;
      },
      { delay: 400 },
    ),
  ];
}
