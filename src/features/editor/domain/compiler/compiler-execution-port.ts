/**
 * compiler-execution-port.ts
 *
 * Real Seam (Domain Layer) for LaTeX Compilation Execution.
 * Follows Matt Pocock's Codebase Design principles:
 * - Two adapters means a real seam: Production (LatexCompilerEngine / remote API) vs In-Memory Test Stand-in.
 * - Callers/tests can test the compilation pipeline without launching real LaTeX compilation processes.
 */

import type {
  CompileExecutionOptions,
  CompileExecutionResult,
} from '../../coordinators/compilation-pipeline';
import type { ForwardSyncResult } from '../../sdk/manuscript.service';

export interface CompilerExecutionPort {
  /**
   * Executes LaTeX compilation for the provided project snapshot.
   */
  compile(options: CompileExecutionOptions): Promise<CompileExecutionResult>;

  /**
   * Cancels any ongoing compilation in-flight.
   */
  cancelInFlightCompile(): void;

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
