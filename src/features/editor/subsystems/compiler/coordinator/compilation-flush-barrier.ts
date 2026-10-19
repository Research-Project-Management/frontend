/**
 * compilation-flush-barrier.ts
 *
 * Pre-Compilation Atomic Consistency & Persistence Flush Barrier (Deep Module Pattern).
 * Follows Matt Pocock's Codebase Design principles:
 * - Solves compilation-time inconsistency between dirty editor memory buffers and persistent storage.
 * - Synchronously commits debounced drafts into local storage (IndexedDB) to guard against crashes.
 * - Synchronizes active editor in-memory content to LRU model and dirty registry.
 * - Triggers non-blocking remote autosave in background without delaying compilation pipeline.
 */

import { sessionCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { useCompileStore } from './compiler.store';
import type { DirtyFileItem } from './compilation-pipeline';

export interface FlushBarrierDeps {
  dirtyFiles: DirtyFileItem[];
  projectId?: string;
  pageId?: string;
  timeoutMs?: number;
}

export interface FlushBarrierResult {
  dirtyFileCount: number;
  activeFlushed: boolean;
  timedOut?: boolean;
}

export const DEFAULT_BARRIER_TIMEOUT_MS = 1500;

export class CompilationFlushBarrier {
  /**
   * Pre-compilation flush barrier:
   * 1. Commits pending draft timers synchronously so local state is resilient.
   * 2. Synchronizes active editor in-memory text with LRU cache and dirty store.
   * 3. Awaits remote autosave flush (up to DEFAULT_BARRIER_TIMEOUT_MS = 1500ms) so normal
   *    network flushes complete before compileLatex starts without hanging indefinitely.
   */
  public static async execute(
    activeFileId?: string,
    activeContent?: string,
    timeoutMs: number = DEFAULT_BARRIER_TIMEOUT_MS,
  ): Promise<FlushBarrierResult> {
    // 1. Synchronously commit pending in-memory drafts to local persistent storage
    sessionCoordinator.flushPendingDrafts();

    // 2. Synchronize active document content if provided
    let activeFlushed = false;
    if (activeFileId && activeContent !== undefined) {
      const model = lruDocumentCache.getModel(activeFileId);
      if (model && model.content !== activeContent) {
        lruDocumentCache.updateContent(activeFileId, activeContent, true);
        useCompileStore.getState().markDirty(activeFileId, activeContent);
        activeFlushed = true;
      }
    }

    // 3. Await remote autosave with bounded barrier timeout so normal network flushes finish before compileLatex
    let timedOut = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const flushPromise = sessionCoordinator.flushAllPending().catch(() => null);
      const timeoutPromise = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), timeoutMs);
      });
      const winner = await Promise.race([flushPromise, timeoutPromise]);
      if (winner === 'timeout') {
        timedOut = true;
      }
    } finally {
      if (timer) clearTimeout(timer);
    }

    const dirtyFileCount = useCompileStore.getState().getDirtyFiles().length;
    return { dirtyFileCount, activeFlushed, timedOut };
  }
}
