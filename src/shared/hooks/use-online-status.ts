'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { logger } from '@/shared/lib/logger';

export interface OnlineStatusResult {
  isOnline: boolean;
  isOffline: boolean;
}

let currentOnlineState = typeof navigator !== 'undefined' ? navigator.onLine : true;

/**
 * Universal online/offline network connectivity hook.
 * Provides reactive network status with SSR safety.
 */
export function useOnlineStatus(): OnlineStatusResult {
  const subscribe = useCallback((callback: () => void) => {
    if (typeof window === 'undefined') return () => {};

    const handleOnline = () => {
      currentOnlineState = true;
      logger.info('Network connectivity restored');
      callback();
    };

    const handleOffline = () => {
      currentOnlineState = false;
      logger.warn('Network connectivity lost — running offline');
      callback();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return currentOnlineState;
  }, []);

  const getServerSnapshot = useCallback(() => true, []);

  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return {
    isOnline,
    isOffline: !isOnline,
  };
}


