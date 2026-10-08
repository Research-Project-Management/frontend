/**
 * visibility.coordinator.ts
 *
 * Tab Visibility & CRDT/Lifecycle Hibernation Coordinator (Coordinators Layer).
 *
 * Responsibilities:
 * - Monitors Page Visibility API (document.visibilityState) & Window Blur/Focus.
 * - Enforces guaranteed immediate flush of all in-memory dirty buffers to IndexedDB Tier 2
 *   whenever the tab is hidden, guarding against Chrome/Edge aggressive Tab Discarding.
 * - Hibernates expensive background tasks (linter, spellcheck, dirty polling) while hidden.
 * - Manages CRDT Awareness status (online -> away/hibernated -> online) for Figma/Overleaf parity.
 * - Coordinates gentle re-awakening upon tab return (re-sync checks, selective linting).
 */

import { editorCommandBus } from './command-bus';

export type VisibilityLifecycleState = 'active' | 'hibernated';

export interface HibernationOptions {
  autoFlushOnHide?: boolean;
  throttleIntervalMs?: number;
}

export class VisibilityCoordinatorRegistry {
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
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  public dispose(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
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
      this.onTabHibernated();
    } else {
      const duration = this.hiddenTimestamp ? Date.now() - this.hiddenTimestamp : 0;
      this.hiddenTimestamp = null;
      this.onTabAwakened(duration);
    }

    this.notify();
  };

  private handleBeforeUnload = (): void => {
    void this.flushHandler?.();
  };

  private onTabHibernated(): void {
    void this.flushHandler?.();
    this.awarenessCallback?.(false);

    editorCommandBus.dispatch({
      type: 'lifecycle:state-change',
      state: 'hibernated',
    });
  }

  private onTabAwakened(durationMs: number): void {
    this.awarenessCallback?.(true);

    editorCommandBus.dispatch({
      type: 'lifecycle:state-change',
      state: 'active',
      durationMs,
    });
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error('[VisibilityCoordinator] Listener error:', err);
      }
    }
  }
}

export const visibilityCoordinator = new VisibilityCoordinatorRegistry();
// Backward compatibility alias
export const visibilityHibernationCoordinator = visibilityCoordinator;
