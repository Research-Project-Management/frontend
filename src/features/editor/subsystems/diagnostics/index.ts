/**
 * src/features/editor/subsystems/diagnostics/index.ts
 *
 * Diagnostics Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Interval-Indexed Diagnostics & Compiler Errors Coordination.
 * - Real-time LaTeX Syntax Linting via Background Web Worker.
 * - CodeMirror 6 Inline Error Lens and Diagnostics Gutter Decorations.
 * - AI 1-Click Error AutoFix Integration.
 */

import type {
  IndexedDiagnosticItem,
  FileDiagnosticsSummary,
} from './coordinator/diagnostics.coordinator';

// 1. Coordinator & Core Services
export {
  diagnosticsCoordinator,
  DiagnosticsCoordinatorRegistry,
  type IndexedDiagnosticItem,
  type FileDiagnosticsSummary,
  type DiagnosticsTelemetry,
  type DiagnosticsSnapshot,
  type IDiagnosticsCoordinator,
} from './coordinator/diagnostics.coordinator';

// 2. Syntax Linter & Parser Engines
export {
  type LatexLinterOptions,
  type LatexLintDiagnostic,
  lintEnvironments,
  lintUnmatchedBraces,
  lintSpecialCharacters,
  lintInlineMath,
  lintLabelsAndReferences,
  lintCommandsAndTypos,
  lintRetractedCitations,
} from './linter/latex-linter';
export {
  runLatexLinter,
  type LinterDiagnostic,
  type LinterOptions,
} from './extensions/latex-linter-core';

// 3. Engine Extensions (CodeMirror 6)
export {
  createLatexErrorLensExtension,
  errorLensField,
  errorLensTheme,
  setErrorLensDiagnosticsEffect,
  clearErrorLensDiagnosticsEffect,
  type ErrorLensPayload,
} from './extensions/latex-error-lens';
export {
  createDiagnosticsGutter,
  type DiagnosticsGutterOptions,
} from './extensions/diagnostics-gutter';
export {
  createLatexLinterExtension,
  latexLinterWorkerClient,
} from './extensions/latex-linter';

// 4. Subsystem Deep Interface Port (The Seam)
export interface DiagnosticsSubsystemPort {
  readonly name: 'diagnostics';
  setFileDiagnostics(fileKey: string, diagnostics: IndexedDiagnosticItem[]): void;
  getDiagnosticsForFile(fileKey: string): IndexedDiagnosticItem[];
  getProjectSummary(includeBadboxes?: boolean): FileDiagnosticsSummary;
  clear(): void;
}
