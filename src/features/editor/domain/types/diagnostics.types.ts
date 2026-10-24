/**
 * diagnostics.types.ts
 *
 * Canonical Domain Diagnostic Contract (Layer 1: Pure Domain Model).
 * Location: `features/editor/domain/types/diagnostics.types.ts`
 * Shared across the Editor Command Bus, Diagnostics Coordinator, CodeMirror Gutter,
 * Inline Error Lens, and AI AutoFix assistants.
 */

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface EditorDiagnosticItem {
  id: string;
  file?: string;
  fileKey?: string;
  rawFile?: string;
  normalizedPath?: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity?: DiagnosticSeverity;
  message: string;
  source?: 'compiler' | 'static' | 'chktex' | 'bibtex' | 'linter' | string;
  code?: string;
  context?: string;
  suggestion?: string;
  fixedSnippet?: string;
  originalSnippet?: string;
  confidence?: 'high' | 'medium' | 'low' | number;
}
