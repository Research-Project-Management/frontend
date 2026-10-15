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
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import { useCompileStore } from './compiler.store';

export interface FlushBarrierResult {
  dirtyFileCount: number;
  activeFlushed: boolean;
}

export class CompilationFlushBarrier {
  /**
   * Pre-compilation flush barrier:
   * 1. Commits pending draft timers synchronously so local state is resilient.
   * 2. Synchronizes active editor in-memory text with LRU cache and dirty store.
   * 3. Triggers asynchronous background persistence flush without adding blocking latency.
   */
  public static async execute(activeFileId?: string, activeContent?: string): Promise<FlushBarrierResult> {
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

    // 3. Trigger non-blocking remote autosave in background (fire-and-forget)
    void sessionCoordinator.flushAllPending().catch(() => {});

    const dirtyFileCount = useCompileStore.getState().getDirtyFiles().length;
    return { dirtyFileCount, activeFlushed };
  }
}
