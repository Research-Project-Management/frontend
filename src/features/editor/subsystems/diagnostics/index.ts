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

// 1. Coordinator & Core Services
export {
  diagnosticsCoordinator,
  DiagnosticsCoordinatorRegistry,
  type IndexedDiagnosticItem,
  type FileDiagnosticsSummary,
  type DiagnosticsTelemetry,
  type DiagnosticsSnapshot,
} from './coordinator/diagnostics.coordinator';

// 2. Syntax Linter & Parser Engines
export {
  runLatexLinter,
  runLatexLinter as lintLatexRules,
  lintLatexDocument,
  clearLatexLinterCache,
  type LinterDiagnostic,
  type LatexLintDiagnostic,
  type LinterOptions,
  type LatexLinterOptions,
  type RetractedItemInfo,
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

