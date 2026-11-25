'use client';

import { useSyncExternalStore } from 'react';
import type { ConnectionStatus, Namespace } from './config';
import { socketPool } from './socket-pool';

/**
 * React 18+ tear-free subscription to a realtime namespace's connection status.
 */
export function useRealtimeStatus(namespace: Namespace): ConnectionStatus {
  return useSyncExternalStore(
    (onStoreChange) =>
      socketPool.onStatus((ns) => {
        if (ns === namespace) onStoreChange();
      }),
    () => socketPool.getStatus(namespace),
    () => 'idle',
  );
}
