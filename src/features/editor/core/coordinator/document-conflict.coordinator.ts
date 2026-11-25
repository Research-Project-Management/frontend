/**
 * document-conflict.coordinator.ts
 *
 * Pure state and listener registry for remote-vs-local document conflicts.
 * Decoupled from direct storage access so conflict surfacing stays isolated from persistence.
 */

import { logger } from '@/shared/lib/logger';

export interface DocumentConflict {
  fileId: string;
  localContent: string;
  remoteContent: string;
  detectedAt: number;
  currentRev?: number;
  hasAuthoritativeRemote?: boolean;
}

export type ConflictListener = (conflict: DocumentConflict) => void;

export class DocumentConflictCoordinator {
  private readonly conflicts = new Map<string, DocumentConflict>();
  private readonly listeners = new Set<ConflictListener>();

  public onConflict(listener: ConflictListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getConflict(fileId: string): DocumentConflict | undefined {
    return this.conflicts.get(fileId);
  }

  public getConflicts(): DocumentConflict[] {
    return Array.from(this.conflicts.values());
  }

  public clearConflict(fileId: string): void {
    this.conflicts.delete(fileId);
  }

  public takeConflict(fileId: string): DocumentConflict | undefined {
    const conflict = this.conflicts.get(fileId);
    if (conflict) {
      this.conflicts.delete(fileId);
    }
    return conflict;
  }

  public recordConflict(
    fileId: string,
    localContent: string,
    remoteContent: string,
    options?: { currentRev?: number; hasAuthoritativeRemote?: boolean },
  ): DocumentConflict {
    const conflict: DocumentConflict = {
      fileId,
      localContent,
      remoteContent,
      detectedAt: Date.now(),
      ...(typeof options?.currentRev === 'number' ? { currentRev: options.currentRev } : {}),
      hasAuthoritativeRemote: options?.hasAuthoritativeRemote ?? true,
    };
    this.conflicts.set(fileId, conflict);
    if (this.listeners.size === 0) {
      logger.warn(
        `[DocumentConflictCoordinator] Unresolved remote conflict on ${fileId}; local edits kept.`,
      );
    }
    for (const listener of this.listeners) {
      try {
        listener(conflict);
      } catch (err) {
        logger.error('[DocumentConflictCoordinator] Conflict listener error', err);
      }
    }
    return conflict;
  }

  public evictFile(fileId: string): void {
    this.conflicts.delete(fileId);
  }

  public clearAll(): void {
    this.conflicts.clear();
  }
}
