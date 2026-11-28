/**
 * src/features/editor/subsystems/diagnostics/index.ts
 *
 * Diagnostics Subsystem Public Seam & Facade Port (Matt Pocock Deep Module).
 *
 * Responsibilities:
 * - Interval-Indexed Diagnostics & Compiler Errors Coordination.
 * - Real-time LaTeX Syntax Linting via Backend FastSyntaxLinter.
 * - CodeMirror 6 Inline Error Lens and Diagnostics Gutter Decorations.
 * - AI 1-Click Error AutoFix Integration.
 */

// 1. Coordinator & Core Services
export {
  diagnosticsCoordinator,
  DiagnosticsCoordinator,
  EMPTY_DIAGNOSTICS_SUMMARY,
  type IndexedDiagnosticItem,
  type FileDiagnosticsSummary,
  type DiagnosticsSnapshot,
  type DiagnosticsTelemetry,
  type DiagnosticsChangeSource,
} from './coordinator/diagnostics.coordinator';

// 2. Syntax Linter & Parser Engines
export {
  runLatexLinter,
  clearLatexLinterCache,
  type LinterDiagnostic,
  type LinterOptions,
  type RetractedItemInfo,
} from './model/latex-linter-core';
export {
  runLocalLatexSyntaxLinter,
  hasHardSyntaxErrors,
} from './model/local-latex-linter';

// 3. Engine Extensions (CodeMirror 6)
export {
  createLatexErrorLensExtension,
  ErrorLensWidget,
  errorLensField,
  setErrorLensDiagnosticsEffect,
  clearErrorLensDiagnosticsEffect,
} from './extensions/latex-error-lens';
export {
  createDiagnosticsGutter,
  compilerDiagnosticsField,
  setCompilerDiagnosticsEffect,
  clearCompilerDiagnosticsEffect,
} from './extensions/diagnostics-gutter';
export {
  createLatexLinterExtension,
} from './extensions/latex-linter';
