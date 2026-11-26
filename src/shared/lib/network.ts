import { useSyncExternalStore } from 'react';

type NetworkListener = (isOnline: boolean) => void;

const listeners = new Set<NetworkListener>();
let attached = false;

const handleOnline = () => {
  for (const listener of Array.from(listeners)) {
    try {
      listener(true);
    } catch {
      // Isolate listener errors
    }
  }
};

const handleOffline = () => {
  for (const listener of Array.from(listeners)) {
    try {
      listener(false);
    } catch {
      // Isolate listener errors
    }
  }
};

function attachWindowListeners(): void {
  if (attached || typeof window === 'undefined') return;
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  attached = true;
}

function detachWindowListeners(): void {
  if (!attached || typeof window === 'undefined') return;
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  attached = false;
}

/**
 * Returns the browser's current online status (defaults to true during SSR).
 */
export function getIsOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine !== false;
}

/**
 * Subscribes to global browser online/offline transitions using a single shared window listener pair.
 */
export function subscribeNetworkStatus(listener: NetworkListener): () => void {
  listeners.add(listener);
  attachWindowListeners();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      detachWindowListeners();
    }
  };
}

function subscribeReactStore(callback: () => void): () => void {
  return subscribeNetworkStatus(() => {
    callback();
  });
}

function getServerSnapshot(): boolean {
  return true;
}

/**
 * React hook returning live browser connectivity status backed by the global network observer.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeReactStore,
    getIsOnline,
    getServerSnapshot,
  );
}
