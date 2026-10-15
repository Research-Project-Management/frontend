/**
 * diagnostics-gutter.ts
 *
 * CodeMirror 6 Linter Bridge & Gutter Integration (Layer 2: Technology Engines).
 * Integrates CodeMirror 6 with the application-wide DiagnosticsCoordinator.
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import { type Extension } from '@codemirror/state';
import type { EditorDiagnosticItem } from '@/features/editor/core/bus/command-bus.port';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';

export interface DiagnosticsGutterOptions {
  filePath?: string;
  enabled?: boolean;
  getDiagnostics?: (filePath: string) => EditorDiagnosticItem[];
}

export function createDiagnosticsGutter(options: DiagnosticsGutterOptions = {}): Extension {
  const {
    filePath,
    enabled = true,
    getDiagnostics = (fp: string) => diagnosticsCoordinator.getFileDiagnostics(fp),
  } = options;

  if (!enabled || !filePath) {
    return [];
  }

  return linter((view) => {
    const doc = view.state.doc;
    const fileDiagnostics = getDiagnostics(filePath);

    if (fileDiagnostics.length === 0) {
      return [];
    }

    const diagnostics: Diagnostic[] = [];

    for (const item of fileDiagnostics) {
      const lineNum = Math.max(1, Math.min(item.line, doc.lines));
      const line = doc.line(lineNum);

      let from = line.from;
      if (item.column && item.column > 0) {
        from = Math.min(line.from + item.column - 1, line.to);
      }

      const to = Math.max(from + 1, Math.min(from + 5, line.to));

      diagnostics.push({
        from,
        to,
        severity: item.severity === 'error' ? 'error' : item.severity === 'warning' ? 'warning' : 'info',
        message: item.message,
        source: (item as { source?: string }).source || 'latex',
      });
    }

    return diagnostics;
  });
}
