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
  type IndexedDiagnosticItem,
  type FileDiagnosticsSummary,
  type DiagnosticsTelemetry,
  type DiagnosticsSnapshot,
} from './coordinator/diagnostics.coordinator';

// 2. Syntax Linter & Parser Engines
export {
  runLatexLinter,
  lintLatexDocument,
  clearLatexLinterCache,
  type LinterDiagnostic,
  type LatexLintDiagnostic,
  type LinterOptions,
  type LatexLinterOptions,
  type RetractedItemInfo,
} from './model/latex-linter-core';

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
  LatexLinterClient,
  latexLinterClient,
  createLatexLinterPlugin,
  latexLinterPlugin,
} from './extensions/latex-linter';

// 4. Presentation Hooks
export {
  useFileDiagnosticsSummary,
  useFolderDiagnosticsSummary,
  useProjectDiagnosticsSummary,
} from './ui/hooks/useDiagnosticsSummary';
