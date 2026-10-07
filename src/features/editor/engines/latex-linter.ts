/**
 * latex-linter.ts
 *
 * Web Worker Orchestrator for Real-Time LaTeX Linting (Block 4: Engines Layer).
 * Location: `features/editor/engines/latex-linter.ts`
 *
 * Architecture (Overleaf Parity):
 * - Spawns a dedicated Web Worker to run tokenization and AST validation off-main-thread.
 * - Manages concurrent request IDs so outdated lint jobs are superseded immediately.
 * - Automatic graceful fallback to synchronous `runLatexLinter` if Web Worker is unavailable.
 * - Connects project-level `latexSymbolsIndex` for cross-file citation key validation.
 * - Feeds diagnostics into CodeMirror 6 via `@codemirror/lint`.
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { latexSymbolsIndex } from '../domain/latex-symbols-index';
import { runLatexLinter, type LinterDiagnostic, type LinterOptions } from './latex-linter-core';
import type { LinterWorkerMessageIn, LinterWorkerMessageOut } from './latex-linter.worker';

class LatexLinterWorkerClient {
  private worker: Worker | null = null;
  private isWorkerFailed = false;
  private currentRequestId = 0;
  private pendingRequests = new Map<number, (diagnostics: Diagnostic[]) => void>();

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window === 'undefined') return;

    try {
      this.worker = new Worker(new URL('./latex-linter.worker.ts', import.meta.url));
      this.worker.onmessage = (event: MessageEvent<LinterWorkerMessageOut>) => {
        const { id, diagnostics } = event.data;
        const resolver = this.pendingRequests.get(id);
        if (resolver) {
          this.pendingRequests.delete(id);
          // Only resolve if this is still the freshest request or not superseded
          resolver(diagnostics as Diagnostic[]);
        }
      };

      this.worker.onerror = (err) => {
        console.warn('[LatexLinter] Worker encountered an error, falling back to local thread:', err);
        this.isWorkerFailed = true;
        this.worker?.terminate();
        this.worker = null;
      };
    } catch (e) {
      console.warn('[LatexLinter] Worker could not be instantiated, using in-process engine:', e);
      this.isWorkerFailed = true;
      this.worker = null;
    }
  }

  /**
   * Executes linting on text, offloading to Web Worker if available
   */
  public async lint(text: string, options: LinterOptions = {}): Promise<Diagnostic[]> {
    if (!text.trim()) {
      return [];
    }

    // Fallback: Synchronous / in-process execution if worker is unavailable
    if (this.isWorkerFailed || !this.worker) {
      const coreDiagnostics = runLatexLinter(text, options);
      return coreDiagnostics as Diagnostic[];
    }

    const requestId = ++this.currentRequestId;

    return new Promise<Diagnostic[]>((resolve) => {
      // Clean up previous pending requests (superseded by new typing keystroke)
      for (const [oldId, oldResolve] of this.pendingRequests.entries()) {
        oldResolve([]); // Resolve empty for cancelled jobs
        this.pendingRequests.delete(oldId);
      }

      this.pendingRequests.set(requestId, resolve);

      const message: LinterWorkerMessageIn = {
        id: requestId,
        text,
        options,
      };

      this.worker?.postMessage(message);
    });
  }

  public destroy(): void {
    this.worker?.terminate();
    this.worker = null;
    this.pendingRequests.clear();
  }
}

export const latexLinterWorkerClient = new LatexLinterWorkerClient();

/**
 * Async CodeMirror 6 Lint Source
 */
export async function latexLinterSource(view: EditorView): Promise<Diagnostic[]> {
  const text = view.state.doc.toString();
  const knownCitations = latexSymbolsIndex.getCitations();
  const knownBibKeys = knownCitations.length > 0 ? knownCitations.map((c) => c.key) : [];

  return await latexLinterWorkerClient.lint(text, {
    knownBibKeys,
  });
}

/**
 * Creates the CodeMirror 6 Linter Extension for LaTeX
 */
export function createLatexLinterExtension() {
  return linter(latexLinterSource, {
    delay: 350, // 350ms debounced execution for smooth typing
  });
}

export { runLatexLinter, type LinterDiagnostic, type LinterOptions } from './latex-linter-core';
