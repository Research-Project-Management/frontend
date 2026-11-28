/**
 * latex-linter.ts
 *
 * Local-First Real-Time LaTeX Linter Extension for CodeMirror 6 (Block 4: Engines Layer).
 * Location: `features/editor/subsystems/diagnostics/extensions/latex-linter.ts`
 *
 * Architecture:
 * - Runs `runLocalLatexSyntaxLinter(...)` synchronously in the browser while typing (0 network calls).
 * - Preserves `LatexLinterClient` for explicit backend linting when invoked directly.
 * - Debounced via CodeMirror 6 `linter(..., { delay: 300 })` with per-view input-hash caching.
 * - Remaps existing diagnostics smoothly via `ChangeSet.mapPos` and marks edited lines `stale: true`.
 */

import { linter, type Diagnostic } from '@codemirror/lint';
import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { diagnosticsCoordinator } from '@/features/editor/subsystems/diagnostics/coordinator/diagnostics.coordinator';
import { usePageStore } from '@/features/editor/core';
import { pagesService } from '@/features/editor/sdk/pages.service';
import {
  mapBackendDiagnosticsToOffsets,
  scanRetractedCitations,
  registerLatexLinterCacheReset,
  clearLatexLinterCache,
  type LinterDiagnostic,
  type LinterOptions,
} from '../model/latex-linter-core';
import { runLocalLatexSyntaxLinter } from '../model/local-latex-linter';

function hashLinterInput(text: string, options: LinterOptions = {}): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bibSig = options.knownBibKeys?.length
    ? `${options.knownBibKeys.length}:${options.knownBibKeys.join(',')}`
    : '0';
  const labelSig = options.knownLabels?.length
    ? `${options.knownLabels.length}:${options.knownLabels.join(',')}`
    : '0';
  const retractedSize =
    options.retractedCitationsMap instanceof Map
      ? options.retractedCitationsMap.size
      : options.retractedCitationsMap
        ? Object.keys(options.retractedCitationsMap).length
        : 0;
  return `${cacheEpoch}|${options.projectId ?? ''}|${options.docId ?? ''}|${options.filePath ?? 'main.tex'}|${text.length}:${h >>> 0}|${bibSig}|${labelSig}|${retractedSize}`;
}

class LatexLinterClient {
  private currentRequestId = 0;
  private lastLintedHash: string | null = null;
  private lastDiagnostics: Diagnostic[] = [];
  private resultCache = new Map<string, Diagnostic[]>();
  private inFlightByHash = new Map<string, Promise<Diagnostic[]>>();

  /**
   * Executes linting on text via backend `pagesService.diagnostics.lint`
   * with content-hash deduplication so unchanged text + options incur 0 network requests.
   */
  public async lint(text: string, options: LinterOptions = {}): Promise<Diagnostic[]> {
    if (!text.trim()) {
      return [];
    }

    const inputHash = hashLinterInput(text, options);
    if (this.lastLintedHash === inputHash) {
      return this.lastDiagnostics;
    }
    const cached = this.resultCache.get(inputHash);
    if (cached) {
      this.lastLintedHash = inputHash;
      this.lastDiagnostics = cached;
      return cached;
    }
    const existingInFlight = this.inFlightByHash.get(inputHash);
    if (existingInFlight) {
      return existingInFlight;
    }

    const requestId = ++this.currentRequestId;
    const retractedDiagnostics = scanRetractedCitations(text, options.retractedCitationsMap);

    const requestPromise = (async (): Promise<Diagnostic[]> => {
      try {
        void requestId;
        const combined = [...retractedDiagnostics] as Diagnostic[];
        this.lastLintedHash = inputHash;
        this.lastDiagnostics = combined;
        if (this.resultCache.size >= 32) {
          const oldestKey = this.resultCache.keys().next().value;
          if (oldestKey !== undefined) {
            this.resultCache.delete(oldestKey);
          }
        }
        this.resultCache.set(inputHash, combined);
        return combined;
      } finally {
        this.inFlightByHash.delete(inputHash);
      }
    })();

    this.inFlightByHash.set(inputHash, requestPromise);
    return requestPromise;
  }

  public clearCache(): void {
    this.lastLintedHash = null;
    this.lastDiagnostics = [];
    this.resultCache.clear();
    this.inFlightByHash.clear();
  }

  public destroy(): void {
    this.currentRequestId++;
    this.clearCache();
  }
}

const latexLinterClient = new LatexLinterClient();

interface ViewLinterCacheEntry {
  inputHash: string;
  diagnostics: Diagnostic[];
  epoch: number;
}

let cacheEpoch = 0;
const viewLinterCache = new WeakMap<EditorView, ViewLinterCacheEntry>();

registerLatexLinterCacheReset(() => {
  cacheEpoch++;
  latexLinterClient.clearCache();
});

export function resetLatexLinterCache(): void {
  clearLatexLinterCache();
}

function createLatexLinterPlugin(boundFilePath?: string) {
  return ViewPlugin.fromClass(
    class {
      update(update: ViewUpdate) {
        if (!update.docChanged) {
          return;
        }

        const activeDoc = boundFilePath ? null : usePageStore.getState().getActiveDocument();
        const fileKey = boundFilePath || activeDoc?.path || activeDoc?.title || activeDoc?.id;
        if (!fileKey) {
          return;
        }

        const startDoc = update.startState.doc;
        const changes = update.changes;
        const endDoc = update.state.doc;

        queueMicrotask(() => {
          diagnosticsCoordinator.remapDiagnosticsWithChangeSet(
            fileKey,
            startDoc,
            changes,
            endDoc,
          );
        });
      }
    },
  );
}

/**
 * Incremental CodeMirror 6 ViewPlugin:
 * - Immediately skips transactions where docChanged is false (cursor / selection only).
 * - On edits, remaps existing diagnostic lines via ChangeSet.mapPos and marks modified erroneous
 *   lines as `stale: true` with zero latency.
 */
export const latexLinterPlugin = createLatexLinterPlugin();

function createLatexLinterSource(
  boundFilePath?: string,
): (view: EditorView) => LinterDiagnostic[] {
  let instanceLastInputHash: string | null = null;
  let instanceLastDiagnostics: LinterDiagnostic[] = [];
  let instanceEpoch = cacheEpoch;

  return (view: EditorView): LinterDiagnostic[] => {
    const text = view.state.doc.toString();
    const pageState = usePageStore.getState();
    const activeDoc = pageState.getActiveDocument();
    const fileKey = boundFilePath || activeDoc?.path || activeDoc?.title || activeDoc?.id || 'main.tex';

    const knownCitations = latexSymbolsIndex.getCitations();
    const knownBibKeys = knownCitations.length > 0 ? knownCitations.map((c: { key: string }) => c.key) : [];
    const knownLabels = latexSymbolsIndex.getLabels().map((l: { name: string }) => l.name);
    const retractedCitationsMap = latexSymbolsIndex.getRetractedCitationsMap();

    const inputHash = hashLinterInput(text, {
      filePath: fileKey,
      knownBibKeys,
      knownLabels,
      retractedCitationsMap,
    });

    const cachedForView = viewLinterCache.get(view);
    if (cachedForView && cachedForView.epoch === cacheEpoch && cachedForView.inputHash === inputHash) {
      return cachedForView.diagnostics as LinterDiagnostic[];
    }
    if (
      !cachedForView &&
      instanceEpoch === cacheEpoch &&
      instanceLastInputHash !== null &&
      inputHash === instanceLastInputHash
    ) {
      return instanceLastDiagnostics;
    }

    const results = runLocalLatexSyntaxLinter(text, {
      filePath: fileKey,
      knownBibKeys,
      knownLabels,
      retractedCitationsMap,
    });

    instanceLastInputHash = inputHash;
    instanceLastDiagnostics = results;
    instanceEpoch = cacheEpoch;
    viewLinterCache.set(view, {
      inputHash,
      diagnostics: results,
      epoch: cacheEpoch,
    });

    // Sync linter results into diagnosticsCoordinator so Gutter, Lens, and Coordinator Guards have unified state
    if (fileKey) {
      const doc = view.state.doc;
      const normalizedPath = fileKey.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
      diagnosticsCoordinator.ingestLinterDiagnostics(
        fileKey,
        results.map((item, idx) => {
          const line = doc.lineAt(Math.max(0, Math.min(item.from, doc.length)));
          return {
            id: `lint-${idx}-${line.number}`,
            file: fileKey,
            normalizedPath,
            line: line.number,
            column: item.from - line.from + 1,
            message: item.message,
            code: item.code,
            severity: item.severity === 'error' ? 'error' : 'warning',
            source: 'LaTeX Linter',
          };
        }),
      );
    }

    return results;
  };
}

/**
 * Synchronous CodeMirror 6 Lint Source:
 * Runs browser-local LaTeX syntax linting with per-view input hash caching.
 */
export const latexLinterSource = createLatexLinterSource();

/**
 * Creates the CodeMirror 6 Linter Extension for LaTeX with ChangeSet remapping
 */
export function createLatexLinterExtension(filePath?: string): Extension {
  return [
    createLatexLinterPlugin(filePath),
    linter(createLatexLinterSource(filePath), {
      delay: 300,
      tooltipFilter: () => [],
    }),
  ];
}

export { runLatexLinter, type LinterDiagnostic, type LinterOptions } from '../model/latex-linter-core';
