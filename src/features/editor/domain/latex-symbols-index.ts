/**
 * latex-symbols-index.ts
 *
 * Web Worker Orchestrator & Client for Project Symbols & Metadata (Domain Layer).
 * Location: `features/editor/domain/latex-symbols-index.ts`
 *
 * Architecture (Overleaf Parity):
 * - Spawns a dedicated Web Worker (`latex-symbols.worker.ts`) to offload 100% of
 *   BibTeX extraction, TeX regex token parsing, and line splitting off the main UI thread.
 * - Debounces file parsing (200ms) during active typing to prevent event loop saturation.
 * - Caches the latest immutable `SymbolSnapshot` in UI memory for instant 0ms O(1)
 *   synchronous CodeMirror 6 autocompletion popup response.
 * - Automatic graceful fallback to in-process `LatexSymbolsIndexCore` if Web Workers
 *   are unavailable (SSR, Node, or constrained environments).
 */

import {
  LatexSymbolsIndexCore,
  type BibEntry,
  type LabelEntry,
  type CommandEntry,
  type OutlineItem,
  type OutlineNode,
  type SectionLevel,
  type SymbolSnapshot,
} from './latex-symbols-core';
import type {
  SymbolsWorkerMessageIn,
  SymbolsWorkerMessageOut,
} from '../engines/latex-symbols.worker';

export type {
  BibEntry,
  LabelEntry,
  CommandEntry,
  OutlineItem,
  OutlineNode,
  SectionLevel,
  SymbolSnapshot,
};

export class LatexSymbolsIndex {
  private worker: Worker | null = null;
  private isWorkerFailed = false;
  private fallbackCore = new LatexSymbolsIndexCore();
  private requestIdCounter = 0;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private changeListeners = new Set<(snapshot: SymbolSnapshot) => void>();

  private snapshot: SymbolSnapshot = {
    citations: [],
    labels: [],
    commands: [],
    includeFiles: [],
    outlineByFile: {},
    flatOutlineByFile: {},
    version: 0,
  };

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof window === 'undefined') return;

    try {
      this.worker = new Worker(
        new URL('../engines/latex-symbols.worker.ts', import.meta.url)
      );

      this.worker.onmessage = (event: MessageEvent<SymbolsWorkerMessageOut>) => {
        const { snapshot } = event.data;
        if (snapshot && snapshot.version >= this.snapshot.version) {
          this.snapshot = snapshot;
          this.notifyListeners();
        }
      };

      this.worker.onerror = (err) => {
        console.warn('[LatexSymbolsIndex] Worker error, falling back to local thread:', err);
        this.isWorkerFailed = true;
        this.worker?.terminate();
        this.worker = null;
      };
    } catch (e) {
      console.warn('[LatexSymbolsIndex] Web Worker unavailable, running in-process:', e);
      this.isWorkerFailed = true;
      this.worker = null;
    }
  }

  /**
   * Indexes or updates a file based on its extension.
   * Debounced by default (200ms) to ensure smooth 120 FPS typing during active keystrokes.
   */
  public indexFile(fileId: string, filePath: string, content: string, immediate = false): void {
    if (this.worker && !this.isWorkerFailed) {
      const existingTimer = this.debounceTimers.get(fileId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.debounceTimers.delete(fileId);
      }

      if (immediate) {
        this.worker.postMessage({
          type: 'indexFile',
          fileId,
          filePath,
          content,
          id: ++this.requestIdCounter,
        } as SymbolsWorkerMessageIn);
      } else {
        const timer = setTimeout(() => {
          this.debounceTimers.delete(fileId);
          this.worker?.postMessage({
            type: 'indexFile',
            fileId,
            filePath,
            content,
            id: ++this.requestIdCounter,
          } as SymbolsWorkerMessageIn);
        }, 200);
        this.debounceTimers.set(fileId, timer);
      }
    } else {
      // In-process fallback
      this.fallbackCore.indexFile(fileId, filePath, content);
      this.snapshot = this.fallbackCore.exportSnapshot();
      this.notifyListeners();
    }
  }

  /**
   * Removes all indexed symbols for a deleted file
   */
  public removeFile(fileId: string, filePath?: string): void {
    const timer = this.debounceTimers.get(fileId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(fileId);
    }

    if (this.worker && !this.isWorkerFailed) {
      this.worker.postMessage({
        type: 'removeFile',
        fileId,
        filePath,
        id: ++this.requestIdCounter,
      } as SymbolsWorkerMessageIn);
    } else {
      this.fallbackCore.removeFile(fileId, filePath);
      this.snapshot = this.fallbackCore.exportSnapshot();
      this.notifyListeners();
    }
  }

  /**
   * Clears all symbols across the project
   */
  public clear(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.worker && !this.isWorkerFailed) {
      this.worker.postMessage({
        type: 'clear',
        id: ++this.requestIdCounter,
      } as SymbolsWorkerMessageIn);
    } else {
      this.fallbackCore.clear();
      this.snapshot = this.fallbackCore.exportSnapshot();
      this.notifyListeners();
    }
  }

  /**
   * Instant 0ms synchronous lookup for BibTeX citations
   */
  public getCitations(query = ''): BibEntry[] {
    const q = query.toLowerCase();
    if (!q) return this.snapshot.citations;

    return this.snapshot.citations.filter((entry) =>
      entry.key.toLowerCase().includes(q) ||
      (entry.author && entry.author.toLowerCase().includes(q)) ||
      (entry.title && entry.title.toLowerCase().includes(q))
    );
  }

  /**
   * Instant 0ms synchronous lookup for LaTeX labels
   */
  public getLabels(query = ''): LabelEntry[] {
    const q = query.toLowerCase();
    if (!q) return this.snapshot.labels;

    return this.snapshot.labels.filter((entry) => entry.name.toLowerCase().includes(q));
  }

  /**
   * Instant 0ms synchronous lookup for custom project commands
   */
  public getCommands(): CommandEntry[] {
    return this.snapshot.commands;
  }

  /**
   * Instant 0ms synchronous lookup for project TeX include files
   */
  public getIncludeFiles(query = ''): string[] {
    const q = query.toLowerCase();
    if (!q) return this.snapshot.includeFiles;

    return this.snapshot.includeFiles.filter((path) => path.toLowerCase().includes(q));
  }

  /**
   * Returns hierarchical outline tree for a given file
   */
  public getOutline(fileIdOrPath: string): OutlineNode[] {
    const norm = fileIdOrPath.replace(/\\/g, '/');
    return this.snapshot.outlineByFile[norm] || this.snapshot.outlineByFile[fileIdOrPath] || [];
  }

  /**
   * Returns flat list of outline sections for a given file
   */
  public getFlatOutline(fileIdOrPath: string): OutlineItem[] {
    const norm = fileIdOrPath.replace(/\\/g, '/');
    return this.snapshot.flatOutlineByFile[norm] || this.snapshot.flatOutlineByFile[fileIdOrPath] || [];
  }

  /**
   * Retrieves the current immutable snapshot
   */
  public getSnapshot(): SymbolSnapshot {
    return this.snapshot;
  }

  /**
   * Subscribes to symbol graph updates
   */
  public subscribe(listener: (snapshot: SymbolSnapshot) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.changeListeners) {
      try {
        listener(this.snapshot);
      } catch (err) {
        console.error('[LatexSymbolsIndex] Listener error:', err);
      }
    }
  }

  /**
   * Teardown worker and pending debounce timers
   */
  public dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.changeListeners.clear();
    this.worker?.terminate();
    this.worker = null;
  }
}

export const latexSymbolsIndex = new LatexSymbolsIndex();
