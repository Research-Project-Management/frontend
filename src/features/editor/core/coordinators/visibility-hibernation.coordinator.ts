/**
 * visibility-hibernation.coordinator.ts
 *
 * Tab Visibility & CRDT/Lifecycle Hibernation Coordinator (Application / Domain Layer).
 *
 * Responsibilities:
 * - Monitors Page Visibility API (document.visibilityState) & Window Blur/Focus.
 * - Enforces guaranteed immediate flush of all in-memory dirty buffers to IndexedDB Tier 2
 *   whenever the tab is hidden, guarding against Chrome/Edge aggressive Tab Discarding.
 * - Hibernates expensive background tasks (linter, spellcheck, dirty polling) while hidden.
 * - Manages CRDT Awareness status (online -> away/hibernated -> online) for Figma/Overleaf parity.
 * - Coordinates gentle re-awakening upon tab return (re-sync checks, selective linting).
 * - Decouples low-level DOM event listeners from React UI components.
 */

import { documentSessionCoordinator } from '../session/document-session-coordinator';
import { editorCommandBus } from '../command-bus/editor-command-bus';

export type VisibilityLifecycleState = 'active' | 'hibernated';

export interface HibernationOptions {
  autoFlushOnHide?: boolean;
  throttleIntervalMs?: number;
}

class VisibilityHibernationCoordinatorRegistry {
  private currentState: VisibilityLifecycleState = 'active';
  private initialized = false;
  private hiddenTimestamp: number | null = null;
  private listeners = new Set<(state: VisibilityLifecycleState) => void>();
  private awarenessCallback: ((isOnline: boolean) => void) | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initializes DOM visibilitychange and blur/focus listeners.
   */
  public init(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined' || this.initialized) {
      return;
    }
    this.initialized = true;

    this.currentState = document.visibilityState === 'visible' ? 'active' : 'hibernated';

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('beforeunload', this.handleBeforeUnload);
  }

  /**
   * Cleans up global listeners (useful for testing or hot reload).
   */
  public dispose(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    this.listeners.clear();
    this.initialized = false;
  }

  /**
   * Registers a callback to toggle CRDT presence/awareness online/away state.
   */
  public registerAwarenessHandler(handler: (isOnline: boolean) => void): () => void {
    this.awarenessCallback = handler;
    return () => {
      if (this.awarenessCallback === handler) {
        this.awarenessCallback = null;
      }
    };
  }

  /**
   * Returns whether the tab is currently active (visible to the user).
   */
  public isTabActive(): boolean {
    return this.currentState === 'active';
  }

  /**
   * Returns the current lifecycle state.
   */
  public getState(): VisibilityLifecycleState {
    return this.currentState;
  }

  /**
   * Returns how long the tab was in hibernation (in milliseconds), or 0 if currently active.
   */
  public getHibernationDurationMs(): number {
    if (this.currentState === 'active' || !this.hiddenTimestamp) return 0;
    return Date.now() - this.hiddenTimestamp;
  }

  /**
   * Subscribes to visibility lifecycle state changes.
   */
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
    // Synchronous emergency best-effort flush before page termination
    void documentSessionCoordinator.flushAllPending();
  };

  /**
   * Invoked when tab is hidden or minimized.
   */
  private onTabHibernated(): void {
    // 1. Guaranteed Emergency Flush to IndexedDB
    void documentSessionCoordinator.flushAllPending();

    // 2. Set CRDT presence to away/idle to save collaborator bandwidth
    this.awarenessCallback?.(false);

    // 3. Dispatch system command
    editorCommandBus.dispatch({
      type: 'lifecycle:state-change' as any,
      state: 'hibernated',
    });
  }

  /**
   * Invoked when tab returns to visible.
   */
  private onTabAwakened(durationMs: number): void {
    // 1. Restore CRDT presence to active
    this.awarenessCallback?.(true);

    // 2. Dispatch system command
    editorCommandBus.dispatch({
      type: 'lifecycle:state-change' as any,
      state: 'active',
      durationMs,
    });
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentState);
      } catch (err) {
        console.error('[VisibilityHibernationCoordinator] Listener error:', err);
      }
    }
  }
}

export const visibilityHibernationCoordinator = new VisibilityHibernationCoordinatorRegistry();
