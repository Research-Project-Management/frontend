/**
 * compiler-execution-port.ts
 *
 * Real Seam (Domain Layer) for LaTeX Compilation Execution.
 * Follows Matt Pocock's Codebase Design principles:
 * - Two adapters means a real seam: Production (LatexCompilerEngine / remote API) vs In-Memory Test Stand-in.
 * - Callers/tests can test the compilation pipeline without launching real LaTeX compilation processes.
 * - Pure Domain contracts without upward dependencies on Coordinators or SDK layers.
 */

import type { SyncTeXMap } from '@/features/editor/subsystems/compiler/synctex/synctex-index';
import type { ParsedCompileError } from '@/features/editor/domain/latex/latex-structure';

export interface DirtyFileItem {
  fileId: string;
  content: string;
}

export interface CompilerDiagnostic {
  file: string;
  line: number | null;
  message: string;
  context: string;
  severity: 'error' | 'warning' | 'info';
  code?: string;
  suggestion?: string;
}

export interface CompileExecutionOptions {
  projectId: string;
  pageId?: string;
  mainFile: string;
  engine: string;
  texLiveVersion?: string;
  draft: boolean;
  useCache: boolean;
  forceClean?: boolean;
  stopOnFirstError?: boolean;
  dirtyFiles: DirtyFileItem[];
  source?: string;
  files?: Record<string, string>;
  onPhaseChange?: (phase: 'flushing' | 'syncing' | 'compiling') => void;
  onThumbnailGenerated?: (base64: string) => void;
}

export type CompileExecutionResult =
  | {
      success: true;
      pdfUrl: string;
      pdfBlob?: Blob;
      synctexMap: SyncTeXMap | null;
      synctexPromise?: Promise<SyncTeXMap | null>;
      rawSynctex?: string | null;
      logs: string;
      compiledAt: Date;
      diagnostics?: CompilerDiagnostic[];
      flushedFileIds?: string[];
      flushErrors?: Array<{ fileId: string; error: unknown }>;
    }
  | {
      success: false;
      error: string;
      logs: string;
      errors: ParsedCompileError[];
      diagnostics?: CompilerDiagnostic[];
      flushedFileIds?: string[];
      flushErrors?: Array<{ fileId: string; error: unknown }>;
    };

export interface ForwardSyncResult {
  page: number;
  x: number;
  y: number;
  h: number;
  w: number;
}

export interface CompilerExecutionPort {
  /**
   * Executes LaTeX compilation for the provided project snapshot.
   */
  compile(options: CompileExecutionOptions): Promise<CompileExecutionResult>;

  /**
   * Cancels any ongoing compilation in-flight.
   */
  cancelInFlightCompile(projectId?: string): void;

  /**
   * Forces cloud project sync if applicable.
   */
  forceSync?(projectId: string): Promise<{ synced: string[] }>;

  /**
   * Server-side forward SyncTeX resolution.
   */
  resolveForwardRemote?(
    projectId: string,
    file: string,
    line: number,
    column?: number
  ): Promise<ForwardSyncResult | null>;

  /**
   * Server-side reverse SyncTeX resolution.
   */
  resolveReverseRemote?(
    projectId: string,
    page: number,
    x: number,
    y: number
  ): Promise<{ sourcePath: string | null; line: number } | null>;
}
