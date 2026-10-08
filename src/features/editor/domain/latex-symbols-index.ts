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
  type EnvironmentEntry,
  type OutlineItem,
  type OutlineNode,
  type SectionLevel,
  type SymbolSnapshot,
} from './latex-symbols-core';
import type {
  SymbolsWorkerMessageIn,
  SymbolsWorkerMessageOut,
} from '../engines/workers/latex-symbols.worker';

export type {
  BibEntry,
  LabelEntry,
  CommandEntry,
  EnvironmentEntry,
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
  private libraryCitations: BibEntry[] = [];

  private snapshot: SymbolSnapshot = {
    citations: [],
    labels: [],
    commands: [],
    environments: [],
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
        new URL('../engines/workers/latex-symbols.worker.ts', import.meta.url)
      );

      this.worker.onmessage = (event: MessageEvent<SymbolsWorkerMessageOut>) => {
        const { snapshot } = event.data;
        if (snapshot && snapshot.version >= this.snapshot.version) {
          if (this.libraryCitations.length > 0) {
            const existingKeys = new Set(snapshot.citations.map((c) => c.key.toLowerCase()));
            const additions = this.libraryCitations.filter((b) => !existingKeys.has(b.key.toLowerCase()));
            this.snapshot = {
              ...snapshot,
              citations: [...snapshot.citations, ...additions],
            };
          } else {
            this.snapshot = snapshot;
          }
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

    this.libraryCitations = [];
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
   * Instant 0ms synchronous lookup for BibTeX & Workspace Library citations
   * Includes Vietnamese diacritic-insensitive fuzzy matching
   */
  public getCitations(query = ''): BibEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.snapshot.citations;

    const normQ = LatexSymbolsIndexCore.stripVietnameseDiacritics(q);

    return this.snapshot.citations.filter((entry) => {
      if (entry.key.toLowerCase().includes(q)) return true;
      if (entry.year && entry.year.includes(q)) return true;
      if (entry.author) {
        if (entry.author.toLowerCase().includes(q)) return true;
        if (LatexSymbolsIndexCore.stripVietnameseDiacritics(entry.author).includes(normQ)) return true;
      }
      if (entry.title) {
        if (entry.title.toLowerCase().includes(q)) return true;
        if (LatexSymbolsIndexCore.stripVietnameseDiacritics(entry.title).includes(normQ)) return true;
      }
      if (entry.journal) {
        if (entry.journal.toLowerCase().includes(q)) return true;
        if (LatexSymbolsIndexCore.stripVietnameseDiacritics(entry.journal).includes(normQ)) return true;
      }
      return false;
    });
  }

  /**
   * Instant 0ms synchronous exact lookup for a specific citation key
   */
  public getCitationByKey(key: string): BibEntry | undefined {
    if (!key) return undefined;
    const cleanKey = key.trim().toLowerCase();
    return this.snapshot.citations.find((entry) => entry.key.toLowerCase() === cleanKey);
  }

  /**
   * Seamlessly ingests workspace library items into symbols snapshot so citations
   * are immediately autocomplete-able and hover-able even before any .bib file is exported.
   */
  public setLibraryCitations(items: any[]): void {
    if (!Array.isArray(items) || items.length === 0) return;

    const newBibs: BibEntry[] = items
      .filter((it) => it && (it.citationKey || it.id))
      .map((it) => {
        let authorStr = '';
        if (Array.isArray(it.authors) && it.authors.length > 0) {
          authorStr = it.authors
            .map((a: any) =>
              typeof a === 'string'
                ? a
                : a.fullName || `${a.lastName || ''} ${a.firstName || ''}`.trim()
            )
            .filter(Boolean)
            .join(' and ');
        } else if (Array.isArray(it.creators) && it.creators.length > 0) {
          authorStr = it.creators
            .map((c: any) =>
              c.name || `${c.lastName || ''} ${c.firstName || ''}`.trim()
            )
            .filter(Boolean)
            .join(' and ');
        }

        return {
          key: it.citationKey || it.id,
          type: it.itemType || 'article',
          title: it.title || '',
          author: authorStr,
          year: it.year ? String(it.year) : undefined,
          journal: it.journal || it.publicationTitle || undefined,
          doi: it.doi || undefined,
          sourceFile: 'workspace-library',
        };
      });

    this.libraryCitations = newBibs;
    const existingKeys = new Set(this.snapshot.citations.map((c) => c.key.toLowerCase()));
    const additions = newBibs.filter((b) => !existingKeys.has(b.key.toLowerCase()));

    if (additions.length > 0) {
      this.snapshot = {
        ...this.snapshot,
        citations: [...this.snapshot.citations, ...additions],
        version: this.snapshot.version + 1,
      };
      this.notifyListeners();
    }
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
   * Instant 0ms synchronous lookup for custom project environments (\newenvironment, \newtheorem)
   */
  public getEnvironments(): EnvironmentEntry[] {
    return this.snapshot.environments || [];
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
