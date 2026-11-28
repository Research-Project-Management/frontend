/**
 * visibility.coordinator.ts
 *
 * Tab Visibility & CRDT/Lifecycle Hibernation Coordinator (Coordinators Layer).
 *
 * Responsibilities:
 * - Monitors Page Visibility API (document.visibilityState).
 * - Triggers the registered flush handler whenever the tab is hidden to push dirty buffers to the server.
 * - Hibernates expensive background tasks (linter, spellcheck, dirty polling) while hidden.
 * - Manages CRDT Awareness status (online -> away/hibernated -> online).
 * - Coordinates gentle re-awakening upon tab return.
 */

import { logger } from '@/shared/lib/logger';

type VisibilityLifecycleState = 'active' | 'hibernated';

class VisibilityCoordinator {
  private currentState: VisibilityLifecycleState = 'active';
  private initialized = false;
  private hiddenTimestamp: number | null = null;
  private listeners = new Set<(state: VisibilityLifecycleState) => void>();
  private awarenessCallback: ((isOnline: boolean) => void) | null = null;
  private flushHandler: (() => Promise<void>) | null = null;

  constructor() {
    this.init();
  }

  public init(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined' || this.initialized) {
      return;
    }
    this.initialized = true;

    this.currentState = document.visibilityState === 'visible' ? 'active' : 'hibernated';

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public dispose(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.listeners.clear();
    this.initialized = false;
  }

  public registerAwarenessHandler(handler: (isOnline: boolean) => void): () => void {
    this.awarenessCallback = handler;
    return () => {
      if (this.awarenessCallback === handler) {
        this.awarenessCallback = null;
      }
    };
  }

  public registerFlushHandler(handler: () => Promise<void>): () => void {
    this.flushHandler = handler;
    return () => {
      if (this.flushHandler === handler) {
        this.flushHandler = null;
      }
    };
  }

  public isTabActive(): boolean {
    return this.currentState === 'active';
  }

  public getState(): VisibilityLifecycleState {
    return this.currentState;
  }

  public getHibernationDurationMs(): number {
    if (this.currentState === 'active' || !this.hiddenTimestamp) return 0;
    return Date.now() - this.hiddenTimestamp;
  }

  public subscribe(callback: (state: VisibilityLifecycleState) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private handleVisibilityChange = (): void => {
    const isVisible = document.visibilityState === 'visible';
    const nextState: VisibilityLifecycleState = isVisible ? 'active' : 'hibernated';

    if (this.currentState === nextState) return;
    this.currentState = nextState;

    if (nextState === 'hibernated') {
      this.hiddenTimestamp = Date.now();
      void this.flushHandler?.();
      this.awarenessCallback?.(false);
    } else {
      this.hiddenTimestamp = null;
      this.awarenessCallback?.(true);
    }

    this.notify();
  };

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        logger.error('[VisibilityCoordinator] Listener error', err);
      }
    }
  }
}

export const visibilityCoordinator = new VisibilityCoordinator();
