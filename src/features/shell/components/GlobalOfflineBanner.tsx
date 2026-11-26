'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, WifiOff } from 'lucide-react';
import {
  subscribeNetworkStatus,
  useOnlineStatus,
} from '@/shared/lib/network';

/**
 * Global network connectivity banner for the authenticated app shell.
 */
export function GlobalOfflineBanner() {
  const isOnline = useOnlineStatus();
  const [justReconnected, setJustReconnected] = useState(false);
  const wasOfflineRef = useRef(!isOnline);

  useEffect(() => {
    let reconnectTimer: number | undefined;

    const unsubscribe = subscribeNetworkStatus((online) => {
      if (!online) {
        wasOfflineRef.current = true;
        setJustReconnected(false);
        if (reconnectTimer !== undefined) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = undefined;
        }
        return;
      }

      if (!wasOfflineRef.current) return;
      wasOfflineRef.current = false;
      setJustReconnected(true);
      reconnectTimer = window.setTimeout(() => {
        setJustReconnected(false);
      }, 2500);
    });

    return () => {
      unsubscribe();
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, []);

  if (isOnline && !justReconnected) {
    return null;
  }

  if (justReconnected && isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-success/15 text-success border-b border-success/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium shrink-0 z-30"
      >
        <CheckCircle2 className="size-3.5 shrink-0" />
        <span>Back online</span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-warning/15 text-warning border-b border-warning/30 px-4 py-1.5 flex items-center justify-center gap-2 text-xs font-medium shrink-0 z-30"
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span className="truncate">
        <span className="font-semibold">Offline:</span> You are currently offline. Reconnecting automatically when network returns.
      </span>
    </div>
  );
}

export default GlobalOfflineBanner;
