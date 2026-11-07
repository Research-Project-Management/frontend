/**
 * latex-symbols-index.ts
 *
 * Project Symbols & Metadata Client (Domain Layer).
 * Location: `features/editor/domain/latex/latex-symbols-index.ts`
 *
 * Architecture:
 * - Hydrates authoritative project symbols (`\label`, BibTeX citations, `\newcommand`,
 *   `\newenvironment`, included files, images, and section outline) from the backend
 *   `/api/v1/manuscripts/projects/:projectId/structure/symbols` endpoint.
 * - Maintains a fast O(K) `LatexSymbolCatalog` PrefixTrie in memory for instant 0ms
 *   CodeMirror 6 autocompletion and hover previews.
 * - Preserves synchronous `indexFile` / `indexFilesBatch` methods via `LatexSymbolsIndexCore`
 *   for local unsaved buffer updates and offline/unit-test compatibility without spawning
 *   a background Web Worker on every keystroke.
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
import { PrefixTrie, LatexSymbolCatalog } from './prefix-trie';
import { manuscriptService } from '@/features/editor/sdk/pages.service';
import type { ProjectSymbolsResponseDto } from '@/features/editor/sdk/pages/types';
import { latexDependencyGraph } from './dependency-graph';
import { isItemRetracted, getRetractionInfo } from '@/features/library/domain/system-views.policy';

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
  private fallbackCore = new LatexSymbolsIndexCore();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private serverRefreshTimer: NodeJS.Timeout | null = null;
  private inFlightServerFetch: Promise<SymbolSnapshot | null> | null = null;
  private changeListeners = new Set<(snapshot: SymbolSnapshot) => void>();
  private libraryCitations: BibEntry[] = [];
  private retractedByDoi = new Map<string, { reason?: string; nature?: string; noticeUrl?: string; title?: string }>();
  private retractedByKey = new Map<string, { reason?: string; nature?: string; noticeUrl?: string; title?: string }>();
  private catalog = new LatexSymbolCatalog<BibEntry, LabelEntry, CommandEntry, EnvironmentEntry>();

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

  /**
   * Hydrates the project symbol index directly from the backend `/structure/symbols` endpoint.
   */
  public async hydrateFromServer(projectId: string): Promise<SymbolSnapshot | null> {
    if (!projectId || projectId === 'default' || projectId === 'workspace-local') {
      return null;
    }
    if (this.inFlightServerFetch) {
      return this.inFlightServerFetch;
    }

    this.inFlightServerFetch = (async () => {
      try {
        const dto = await manuscriptService.structure.getSymbols(projectId);
        if (!dto || typeof dto !== 'object') return null;

        if (dto.rootDocPath) {
          latexDependencyGraph.setServerRootDoc(dto.rootDocPath);
        }

        const nextSnapshot = this.fallbackCore.hydrateFromServerDto(dto);
        this.applySnapshotWithLibrary(nextSnapshot);
        return this.snapshot;
      } catch (err) {
        console.warn('[LatexSymbolsIndex] Failed to hydrate symbols from server, keeping local snapshot:', err);
        return null;
      } finally {
        this.inFlightServerFetch = null;
      }
    })();

    return this.inFlightServerFetch;
  }

  /**
   * Debounced background refresh of project symbols from the backend (e.g., after document save).
   */
  public refreshFromServer(projectId: string, delayMs = 400): void {
    if (!projectId || projectId === 'default' || projectId === 'workspace-local') return;
    if (this.serverRefreshTimer) {
      clearTimeout(this.serverRefreshTimer);
    }
    this.serverRefreshTimer = setTimeout(() => {
      this.serverRefreshTimer = null;
      void this.hydrateFromServer(projectId);
    }, delayMs);
  }

  private applySnapshotWithLibrary(rawSnapshot: SymbolSnapshot): void {
    if (this.libraryCitations.length > 0) {
      const existingKeys = new Set(rawSnapshot.citations.map((c) => c.key.toLowerCase()));
      const additions = this.libraryCitations.filter((b) => !existingKeys.has(b.key.toLowerCase()));
      this.snapshot = {
        ...rawSnapshot,
        citations: [...rawSnapshot.citations, ...additions],
      };
    } else {
      this.snapshot = rawSnapshot;
    }
    this.rebuildCatalog(this.snapshot);
    this.notifyListeners();
  }

  /**
   * Indexes or updates a single file in local memory.
   */
  public indexFile(fileId: string, filePath: string, content: string, immediate = false): void {
    const existingTimer = this.debounceTimers.get(fileId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.debounceTimers.delete(fileId);
    }

    const execute = () => {
      this.fallbackCore.indexFile(fileId, filePath, content);
      this.applySnapshotWithLibrary(this.fallbackCore.exportSnapshot());
    };

    if (immediate || process.env.NODE_ENV === 'test') {
      execute();
    } else {
      const timer = setTimeout(() => {
        this.debounceTimers.delete(fileId);
        execute();
      }, 250);
      this.debounceTimers.set(fileId, timer);
    }
  }

  /**
   * Batch indexes multiple files in a single pass, exporting the snapshot and
   * rebuilding the PrefixTrie catalog only ONCE instead of N times.
   */
  public indexFilesBatch(
    files: Array<{ fileId: string; filePath: string; content: string }>,
  ): void {
    if (!files || files.length === 0) return;

    for (const f of files) {
      const existingTimer = this.debounceTimers.get(f.fileId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        this.debounceTimers.delete(f.fileId);
      }
      this.fallbackCore.indexFile(f.fileId, f.filePath, f.content);
    }
    this.applySnapshotWithLibrary(this.fallbackCore.exportSnapshot());
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

    this.fallbackCore.removeFile(fileId, filePath);
    this.applySnapshotWithLibrary(this.fallbackCore.exportSnapshot());
  }

  /**
   * Clears all symbols across the project
   */
  public clear(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    if (this.serverRefreshTimer) {
      clearTimeout(this.serverRefreshTimer);
      this.serverRefreshTimer = null;
    }
    this.libraryCitations = [];
    this.retractedByDoi.clear();
    this.retractedByKey.clear();
    this.catalog.clear();

    this.fallbackCore.clear();
    this.snapshot = this.fallbackCore.exportSnapshot();
    this.rebuildCatalog(this.snapshot);
    this.notifyListeners();
  }

  /**
   * Rebuilds the high-performance Prefix Trie and Inverted Index from the latest snapshot.
   * Enables O(K) lookup time for citations, labels, commands, and environments.
   */
  private rebuildCatalog(snapshot: SymbolSnapshot): void {
    this.catalog.clear();

    // 1. Index Citations
    const citations = snapshot.citations || [];
    for (const entry of citations) {
      if (!entry.key) continue;

      // Index exact citation key
      this.catalog.citationKeyTrie.insert(entry.key, entry);

      // Index publication year
      if (entry.year) {
        this.catalog.citationTokenTrie.insert(entry.year, entry);
      }

      // Helper to index word suffixes and individual tokens for instant O(K) search
      const indexWordSuffixes = (text: string) => {
        const clean = text.trim();
        if (!clean) return;
        const words = clean.split(/\s+/).filter(Boolean);
        for (let i = 0; i < words.length; i++) {
          const suffix = words.slice(i).join(' ');
          this.catalog.citationTokenTrie.insertNormalized(suffix, entry);

          const singleWord = words[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
          if (singleWord.length > 1 && singleWord !== suffix) {
            this.catalog.citationTokenTrie.insertNormalized(singleWord, entry);
          }
        }
      };

      if (entry.author) {
        indexWordSuffixes(entry.author);
      }
      if (entry.title) {
        indexWordSuffixes(entry.title);
      }
      if (entry.journal) {
        indexWordSuffixes(entry.journal);
      }
    }

    // 2. Index Labels (both full label and suffix after colon)
    const labels = snapshot.labels || [];
    for (const label of labels) {
      if (!label.name) continue;
      this.catalog.labelTrie.insert(label.name, label);
      const colonIdx = label.name.indexOf(':');
      if (colonIdx > 0 && colonIdx < label.name.length - 1) {
        this.catalog.labelTrie.insert(label.name.substring(colonIdx + 1), label);
      }
    }

    // 3. Index Commands
    const commands = snapshot.commands || [];
    for (const cmd of commands) {
      if (!cmd.name) continue;
      this.catalog.commandTrie.insert(cmd.name, cmd);
      if (cmd.name.startsWith('\\')) {
        this.catalog.commandTrie.insert(cmd.name.substring(1), cmd);
      }
    }

    // 4. Index Environments
    const envs = snapshot.environments || [];
    for (const env of envs) {
      if (!env.name) continue;
      this.catalog.environmentTrie.insert(env.name, env);
    }
  }

  private normalizeDoi(doi?: string | null): string {
    return (doi ?? '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  }

  /**
   * Instant 0ms synchronous lookup for BibTeX & Workspace Library citations
   * Accelerated by O(K) Prefix Trie & Token Inverted Index with Vietnamese diacritic-insensitive matching.
   */
  public getCitations(query = '', limit = 50): BibEntry[] {
    const q = query.trim();
    if (!q) return this.snapshot.citations;

    const normQ = PrefixTrie.normalize(q);

    // 1. O(K) lookup in Citation Key Trie
    const keyHits = this.catalog.citationKeyTrie.findPrefix(normQ, { limit });

    // 2. O(K) lookup in Token / Suffix Inverted Index
    const tokenHits = this.catalog.citationTokenTrie.findPrefix(normQ, { limit });

    // Merge and deduplicate results
    const seen = new Set<string>();
    const results: BibEntry[] = [];

    for (const item of keyHits) {
      if (!seen.has(item.key.toLowerCase())) {
        seen.add(item.key.toLowerCase());
        results.push(item);
        if (results.length >= limit) return results;
      }
    }

    for (const item of tokenHits) {
      if (!seen.has(item.key.toLowerCase())) {
        seen.add(item.key.toLowerCase());
        results.push(item);
        if (results.length >= limit) return results;
      }
    }

    if (results.length > 0) {
      return results;
    }

    // Graceful fallback to linear scan in case of complex non-prefix multi-token patterns
    return this.snapshot.citations.filter((entry) => {
      if (entry.key.toLowerCase().includes(normQ)) return true;
      if (entry.year && entry.year.includes(normQ)) return true;
      if (entry.author) {
        if (entry.author.toLowerCase().includes(normQ)) return true;
        if (PrefixTrie.normalize(entry.author).includes(normQ)) return true;
      }
      if (entry.title) {
        if (entry.title.toLowerCase().includes(normQ)) return true;
        if (PrefixTrie.normalize(entry.title).includes(normQ)) return true;
      }
      if (entry.journal) {
        if (entry.journal.toLowerCase().includes(normQ)) return true;
        if (PrefixTrie.normalize(entry.journal).includes(normQ)) return true;
      }
      return false;
    }).slice(0, limit);
  }

  /**
   * Instant 0ms synchronous exact lookup for a specific citation key with dynamic retraction resolution
   */
  public getCitationByKey(key: string): BibEntry | undefined {
    if (!key) return undefined;
    const cleanKey = key.trim().toLowerCase();

    // Fast O(K) Trie exact match with array fallback
    let entry = this.catalog.citationKeyTrie.findExact(cleanKey);
    if (!entry) {
      entry = this.snapshot.citations.find((e) => e.key.toLowerCase() === cleanKey);
    }
    if (!entry) return undefined;

    // Check if retraction info needs to be dynamically merged from DOI or Key match
    if (!entry.isRetracted) {
      const doiKey = entry.doi ? this.normalizeDoi(entry.doi) : '';
      const doiHit = doiKey ? this.retractedByDoi.get(doiKey) : undefined;
      const keyHit = this.retractedByKey.get(cleanKey);
      const hit = doiHit || keyHit;
      if (hit) {
        return {
          ...entry,
          isRetracted: true,
          retractionReason: hit.reason,
          retractionNature: hit.nature,
          retractionNoticeUrl: hit.noticeUrl,
        };
      }
    }

    return entry;
  }

  /**
   * Returns a map of citation key -> retraction info for all known retracted citations
   */
  public getRetractedCitationsMap(): Map<string, { title?: string; reason?: string; nature?: string; noticeUrl?: string }> {
    const map = new Map<string, { title?: string; reason?: string; nature?: string; noticeUrl?: string }>();
    for (const entry of this.snapshot.citations) {
      const resolved = this.getCitationByKey(entry.key);
      if (resolved?.isRetracted) {
        map.set(entry.key, {
          title: resolved.title,
          reason: resolved.retractionReason,
          nature: resolved.retractionNature,
          noticeUrl: resolved.retractionNoticeUrl,
        });
      }
    }
    return map;
  }

  /**
   * Seamlessly ingests workspace library items into symbols snapshot so citations
   * are immediately autocomplete-able and hover-able even before any .bib file is exported.
   */
  public setLibraryCitations(items: unknown[]): void {
    if (!Array.isArray(items) || items.length === 0) return;

    type LibraryCitationInput = Record<string, unknown> & {
      id?: string;
      citationKey?: string;
      title?: string;
      year?: string | number;
      publicationYear?: string | number;
      journal?: string;
      venue?: string;
      publicationTitle?: string;
      doi?: string;
      itemType?: string;
      type?: string;
      isRetracted?: boolean;
      retractionStatus?: string;
      is_retracted?: boolean;
      retractionReason?: string;
      retractionNature?: string;
      retractionNoticeUrl?: string;
      authors?: Array<string | { fullName?: string; lastName?: string; firstName?: string }>;
      creators?: Array<{ name?: string; lastName?: string; firstName?: string }>;
    };

    const typedItems = items as LibraryCitationInput[];
    const newBibs: BibEntry[] = typedItems
      .filter((it) => it && (it.citationKey || it.id))
      .map((it) => {
        let authorStr = '';
        if (Array.isArray(it.authors) && it.authors.length > 0) {
          authorStr = it.authors
            .map((a) =>
              typeof a === 'string'
                ? a
                : a.fullName || `${a.lastName || ''} ${a.firstName || ''}`.trim()
            )
            .filter(Boolean)
            .join(' and ');
        } else if (Array.isArray(it.creators) && it.creators.length > 0) {
          authorStr = it.creators
            .map((c) =>
              c.name || `${c.lastName || ''} ${c.firstName || ''}`.trim()
            )
            .filter(Boolean)
            .join(' and ');
        }

        const isRetracted = isItemRetracted(it) || Boolean(it.isRetracted || it.retractionStatus === 'retracted' || it.is_retracted);
        let retInfo: ReturnType<typeof getRetractionInfo> | undefined = undefined;
        if (isRetracted) {
          retInfo = getRetractionInfo(it);
          if (it.doi) {
            this.retractedByDoi.set(this.normalizeDoi(it.doi), {
              reason: retInfo.reason,
              nature: retInfo.nature,
              noticeUrl: retInfo.noticeUrl,
              title: it.title,
            });
          }
          if (it.citationKey) {
            this.retractedByKey.set(it.citationKey.toLowerCase(), {
              reason: retInfo.reason,
              nature: retInfo.nature,
              noticeUrl: retInfo.noticeUrl,
              title: it.title,
            });
          }
        }

        return {
          key: String(it.citationKey || it.id || ''),
          type: it.itemType || 'article',
          title: it.title || '',
          author: authorStr,
          year: it.year ? String(it.year) : undefined,
          journal: it.journal || it.publicationTitle || undefined,
          doi: it.doi || undefined,
          sourceFile: 'workspace-library',
          isRetracted,
          retractionReason: retInfo?.reason,
          retractionNature: retInfo?.nature,
          retractionNoticeUrl: retInfo?.noticeUrl,
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
      this.rebuildCatalog(this.snapshot);
      this.notifyListeners();
    }
  }

  /**
   * Instant 0ms synchronous lookup for LaTeX labels
   */
  public getLabels(query = '', limit = 50): LabelEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.snapshot.labels;

    const hits = this.catalog.labelTrie.findPrefix(q, { limit });
    if (hits.length > 0) return hits;

    return this.snapshot.labels.filter((entry) => entry.name.toLowerCase().includes(q)).slice(0, limit);
  }

  /**
   * Instant 0ms synchronous lookup for custom project commands
   */
  public getCommands(query = '', limit = 50): CommandEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.snapshot.commands;

    const hits = this.catalog.commandTrie.findPrefix(q, { limit });
    if (hits.length > 0) return hits;

    return this.snapshot.commands.filter((cmd) => cmd.name.toLowerCase().includes(q)).slice(0, limit);
  }

  /**
   * Instant 0ms synchronous lookup for custom project environments (\newenvironment, \newtheorem)
   */
  public getEnvironments(query = '', limit = 50): EnvironmentEntry[] {
    const envs = this.snapshot.environments || [];
    const q = query.trim().toLowerCase();
    if (!q) return envs;

    const hits = this.catalog.environmentTrie.findPrefix(q, { limit });
    if (hits.length > 0) return hits;

    return envs.filter((env) => env.name.toLowerCase().includes(q)).slice(0, limit);
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
   * Instant 0ms synchronous lookup for project image files (\includegraphics autocompletion)
   */
  public getImageFiles(query = ''): string[] {
    const q = query.toLowerCase();
    const images = this.snapshot.imageFiles || [];
    if (!q) return images;

    return images.filter((path) => path.toLowerCase().includes(q));
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
   * Returns project-wide hierarchical outline tree (aggregating included subfiles)
   */
  public getProjectOutline(): OutlineNode[] {
    return this.snapshot.projectOutline || [];
  }

  /**
   * Returns project-wide flat list of outline sections
   */
  public getProjectFlatOutline(): OutlineItem[] {
    return this.snapshot.projectFlatOutline || [];
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
   * Teardown pending debounce timers and listeners
   */
  public dispose(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    if (this.serverRefreshTimer) {
      clearTimeout(this.serverRefreshTimer);
      this.serverRefreshTimer = null;
    }
    this.changeListeners.clear();
  }
}

export const latexSymbolsIndex = new LatexSymbolsIndex();
