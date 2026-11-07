/**
 * Browser Multi-Tab Coordination Infrastructure (`@/shared/lib/multi-tab`)
 *
 * Implements W3C-standard cross-tab communication and synchronization primitives:
 * 1. Unique per-tab identity (`getTabId()`)
 * 2. Typed Cross-Tab Pub/Sub Event Bus via `BroadcastChannel` (`multiTabBus`)
 *    with automatic self-message filtering and SSR/older-browser safety.
 * 3. Cross-Tab Distributed Mutex Lock via W3C Web Locks API (`withWebLock`)
 *    with deterministic in-process fallback when `navigator.locks` is unavailable.
 */

export const MULTI_TAB_CHANNEL_NAME = 'flux:multi-tab:v1';

export type MultiTabEventPayload =
  | {
      type: 'AUTH_TOKEN_UPDATED';
      accessToken: string;
    }
  | {
      type: 'AUTH_LOGOUT';
      reason?: 'user_logout' | 'session_expired';
    }
  | {
      type: 'LIBRARY_ITEMS_DELETED';
      scopeId: string;
      itemIds: string[];
      permanent?: boolean;
    }
  | {
      type: 'LIBRARY_ITEM_PATCHED';
      scopeId: string;
      itemId: string;
      patch: Record<string, unknown>;
    }
  | {
      type: 'LIBRARY_SCOPE_INVALIDATED';
      scopeId: string;
      itemId?: string;
      collections?: boolean;
      smartCollections?: boolean;
      tags?: boolean;
      counts?: boolean;
      itemsList?: boolean;
    }
  | {
      type: 'READER_ANNOTATIONS_CHANGED';
      scopeId: string;
      attachmentId: string;
    }
  | {
      type: 'READER_TABS_SYNC';
    }
  | {
      type: 'READER_BOOKMARKS_SYNC';
    }
  | {
      type: 'FEEDS_READ_IDS_SYNC';
    };

export type MultiTabMessage<T extends MultiTabEventPayload = MultiTabEventPayload> = T & {
  readonly senderTabId: string;
  readonly timestamp: number;
};

export type MultiTabListener = (event: MultiTabMessage) => void;

let cachedTabId: string | null = null;

/**
 * Returns a stable, unique identifier for the current browser tab / JS execution context.
 */
export function getTabId(): string {
  if (cachedTabId) return cachedTabId;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    cachedTabId = crypto.randomUUID();
  } else {
    cachedTabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return cachedTabId;
}

class MultiTabBus {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<MultiTabListener>();

  private ensureChannel(): BroadcastChannel | null {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return null;
    }
    if (!this.channel) {
      try {
        this.channel = new BroadcastChannel(MULTI_TAB_CHANNEL_NAME);
        this.channel.onmessage = (ev: MessageEvent<MultiTabMessage>) => {
          const data = ev?.data;
          if (!data || typeof data !== 'object' || typeof data.type !== 'string') {
            return;
          }
          // Ignore messages originating from this same tab
          if (data.senderTabId === getTabId()) {
            return;
          }
          this.notifyListeners(data);
        };
      } catch {
        this.channel = null;
      }
    }
    return this.channel;
  }

  private notifyListeners(message: MultiTabMessage): void {
    this.listeners.forEach((listener) => {
      try {
        listener(message);
      } catch {
        // Swallow individual listener errors so one faulty subscriber cannot break the bus
      }
    });
  }

  /**
   * Publishes a typed event to all other open browser tabs of the same origin.
   */
  publish(payload: MultiTabEventPayload): void {
    const ch = this.ensureChannel();
    if (!ch) return;

    const message: MultiTabMessage = {
      ...payload,
      senderTabId: getTabId(),
      timestamp: Date.now(),
    };

    try {
      ch.postMessage(message);
    } catch {
      // Ignore structured clone or closed channel errors
    }
  }

  /**
   * Subscribes to cross-tab events from other browser tabs.
   * Returns an unsubscribe cleanup function.
   */
  subscribe(listener: MultiTabListener): () => void {
    this.ensureChannel();
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Dispatches a synthetic incoming message (useful for unit testing cross-tab reception).
   */
  dispatchSyntheticMessageForTesting(message: MultiTabMessage): void {
    if (message.senderTabId === getTabId()) return;
    this.notifyListeners(message);
  }

  /**
   * Resets the underlying BroadcastChannel (for test isolation).
   */
  resetForTesting(): void {
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // ignore
      }
      this.channel = null;
    }
    this.listeners.clear();
  }
}

export const multiTabBus = new MultiTabBus();

// ─── Distributed Mutex via W3C Web Locks API (`navigator.locks`) ─────────────

export interface WebLockOptions {
  /**
   * Lock mode: `'exclusive'` (default) or `'shared'`.
   */
  mode?: 'exclusive' | 'shared';
  /**
   * If true, only acquires the lock if immediately available; otherwise resolves `null`.
   */
  ifAvailable?: boolean;
  /**
   * Maximum time in ms to wait for acquiring the lock before falling back or aborting.
   */
  timeoutMs?: number;
}

const inProcessFallbackLocks = new Map<string, Promise<unknown>>();

async function runWithInProcessLock<T>(
  lockName: string,
  callback: () => Promise<T>,
): Promise<T> {
  const previous = inProcessFallbackLocks.get(lockName) ?? Promise.resolve();
  let release!: () => void;
  const currentGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chained = previous.then(() => currentGate);
  inProcessFallbackLocks.set(lockName, chained);

  try {
    await previous;
    return await callback();
  } finally {
    release();
    if (inProcessFallbackLocks.get(lockName) === chained) {
      inProcessFallbackLocks.delete(lockName);
    }
  }
}

/**
 * Executes an async callback inside a cross-tab W3C Web Lock (`navigator.locks.request`).
 * Automatically releases the lock even if the tab crashes, closes, or throws.
 * Falls back to an in-process sequential promise queue when `navigator.locks` is unavailable (SSR / JSDOM).
 */
export async function withWebLock<T>(
  lockName: string,
  callback: () => Promise<T>,
  options: WebLockOptions = {},
): Promise<T | null> {
  const { mode = 'exclusive', ifAvailable = false, timeoutMs = 15_000 } = options;

  const navLocks =
    typeof navigator !== 'undefined' &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
      ? navigator.locks
      : null;

  if (!navLocks) {
    return runWithInProcessLock(lockName, callback);
  }

  if (ifAvailable) {
    try {
      return await navLocks.request(
        lockName,
        { mode, ifAvailable: true },
        async (lock) => {
          if (!lock) return null;
          return callback();
        },
      );
    } catch {
      return runWithInProcessLock(lockName, callback);
    }
  }

  if (timeoutMs > 0 && typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      return await navLocks.request(
        lockName,
        { mode, signal: controller.signal },
        async () => {
          clearTimeout(timer);
          return callback();
        },
      );
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message?.toLowerCase().includes('aborted'));
      if (isAbort) {
        // Lock wait timed out; execute callback directly so caller is never deadlocked
        return callback();
      }
      throw err;
    }
  }

  return navLocks.request(lockName, { mode }, async () => callback());
}
