/**
 * latex-linter.ts
 *
 * Web Worker Orchestrator for Real-Time LaTeX Linting (Block 4: Engines Layer).
 * Location: `features/editor/engines/extensions/latex-linter.ts`
 *
 * Architecture (Overleaf Parity):
 * - Spawns a dedicated Web Worker to run tokenization and AST validation off-main-thread.
 * - Manages concurrent request IDs so outdated lint jobs are superseded immediately.
 * - Automatic graceful fallback to synchronous `runLatexLinter` if Web Worker is unavailable.
 * - Connects project-level `latexSymbolsIndex` for cross-file citation key validation.
 * - Feeds diagnostics into CodeMirror 6 via `@codemirror/lint`.
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { usePageStore } from '@/features/editor/core';
import { runLatexLinter, type LinterDiagnostic, type LinterOptions } from './latex-linter-core';
import type { LinterWorkerMessageIn, LinterWorkerMessageOut } from '@/features/editor/subsystems/diagnostics/linter/latex-linter.worker';

class LatexLinterWorkerClient {
  private worker: Worker | null = null;
  private isWorkerFailed = false;
  private currentRequestId = 0;
  private pendingRequests = new Map<number, (diagnostics: Diagnostic[]) => void>();

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window === 'undefined' || typeof Worker === 'undefined' || process.env.NODE_ENV === 'test') {
      this.isWorkerFailed = true;
      return;
    }

    try {
      this.worker = new Worker(new URL('../linter/latex-linter.worker.ts', import.meta.url));
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

let lastDocText: string | null = null;
let lastDiagnostics: Diagnostic[] = [];

export function resetLatexLinterCache(): void {
  lastDocText = null;
  lastDiagnostics = [];
}

/**
 * Incremental CodeMirror 6 ViewPlugin:
 * - Immediately skips transactions where docChanged is false (cursor / selection only).
 * - On line additions / deletions (Enter / Backspace), immediately calls diagnosticsCoordinator.shiftDiagnostics
 *   to adjust existing error line numbers with zero latency before asynchronous worker re-runs.
 */
export const latexLinterIncrementalPlugin = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.docChanged) {
        return;
      }

      let deltaLines = 0;
      let fromLine = 1;
      update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        fromLine = update.startState.doc.lineAt(fromA).number;
        const linesBefore = update.startState.doc.lineAt(toA).number - fromLine;
        const linesAfter = inserted.lines - 1;
        deltaLines += (linesAfter - linesBefore);
      });

      if (deltaLines !== 0) {
        const activeDoc = usePageStore.getState().getActiveDocument();
        const fileKey = activeDoc?.title || activeDoc?.id;
        if (fileKey) {
          const capturedFromLine = fromLine;
          const capturedDelta = deltaLines;
          queueMicrotask(() => {
            diagnosticsCoordinator.shiftDiagnostics(fileKey, capturedFromLine, capturedDelta);
          });
        }
      }
    }
  }
);

/**
 * Async CodeMirror 6 Lint Source:
 * Checks cached document text first; if content has not changed, returns cached diagnostics
 * without triggering postMessage serialization or worker tokenization.
 */
export async function latexLinterSource(view: EditorView): Promise<Diagnostic[]> {
  const text = view.state.doc.toString();
  if (lastDocText !== null && text === lastDocText) {
    return lastDiagnostics;
  }

  const knownCitations = latexSymbolsIndex.getCitations();
  const knownBibKeys = knownCitations.length > 0 ? knownCitations.map((c: { key: string }) => c.key) : [];
  const knownLabels = latexSymbolsIndex.getLabels().map((l: { name: string }) => l.name);
  const retractedCitationsMap = latexSymbolsIndex.getRetractedCitationsMap();

  const results = await latexLinterWorkerClient.lint(text, {
    knownBibKeys,
    knownLabels,
    retractedCitationsMap,
  });

  lastDocText = text;
  lastDiagnostics = results;

  // Sync linter results into diagnosticsCoordinator so Gutter, Lens, and Panels have unified state
  const activeDoc = usePageStore.getState().getActiveDocument();
  const fileKey = activeDoc?.path || activeDoc?.title || activeDoc?.id;
  if (fileKey) {
    const doc = view.state.doc;
    const normKey = fileKey.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
    diagnosticsCoordinator.ingestLinterDiagnostics(
      fileKey,
      results.map((d, idx) => {
        const line = doc.lineAt(d.from);
        return {
          id: `lint-${idx}-${line.number}`,
          file: fileKey,
          normalizedPath: normKey,
          line: line.number,
          column: d.from - line.from + 1,
          message: d.message,
          severity: d.severity === 'error' ? 'error' : 'warning',
          source: 'LaTeX Linter',
        };
      })
    );
  }

  return results;
}

/**
 * Creates the CodeMirror 6 Linter Extension for LaTeX with incremental delta tracking
 */
export function createLatexLinterExtension(): Extension {
  return [
    latexLinterIncrementalPlugin,
    linter(latexLinterSource, {
      delay: 350, // 350ms debounced execution for smooth typing
    }),
  ];
}

export { runLatexLinter, type LinterDiagnostic, type LinterOptions } from './latex-linter-core';
