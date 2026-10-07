/**
 * DiagnosticsGutter.ts
 *
 * CodeMirror 6 Linter Bridge (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/DiagnosticsGutter.ts`
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import { type Extension } from '@codemirror/state';
import { diagnosticsCoordinator } from '../../../coordinators/diagnostics.coordinator';

export interface DiagnosticsGutterOptions {
  filePath?: string;
  enabled?: boolean;
}

export function createDiagnosticsGutter(options: DiagnosticsGutterOptions = {}): Extension {
  const { filePath, enabled = true } = options;

  if (!enabled || !filePath) {
    return [];
  }

  return linter((view) => {
    const doc = view.state.doc;
    const fileDiagnostics = diagnosticsCoordinator.getFileDiagnostics(filePath);

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
        source: item.source,
      });
    }

    return diagnostics;
  });
}
