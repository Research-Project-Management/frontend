/**
 * OfflineBanner.tsx
 *
 * Global Offline & Connectivity Status Banner (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/OfflineBanner.tsx`
 *
 * Informs the user when network connectivity is lost (Overleaf Parity):
 * - Displays warning banner with pending changes counter.
 * - Shows that local drafts are safely stored in IndexedDB.
 * - Provides a "Retry Connection" button to immediately test connectivity.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useConnectivityStore } from '../store/connectivity.store';
import { sessionCoordinator } from '../coordinator/session.coordinator';
import { toast } from 'sonner';

export function OfflineBanner() {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const pendingSaveCount = useConnectivityStore((s) => s.pendingSaveCount);
  const pendingMutationsCount = useConnectivityStore((s) => s.pendingMutationsCount);
  const isSyncingOfflineQueue = useConnectivityStore((s) => s.isSyncingOfflineQueue);
  const offlinePendingCompile = useConnectivityStore((s) => s.offlinePendingCompile);
  const recordOnline = useConnectivityStore((s) => s.recordOnline);
  const recordOffline = useConnectivityStore((s) => s.recordOffline);

  const [isChecking, setIsChecking] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  // Sync UI state with browser online/offline events (sessionCoordinator handles flushing)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const handleOnline = async () => {
      recordOnline();
      toast.info('Connection restored. Syncing pending drafts...', { id: 'network-status' });
      try {
        await sessionCoordinator.handleOnline();
      } catch {
        // Ignore; connectivity store tracks sync errors
      }
      if (cancelled) return;
      const state = useConnectivityStore.getState();
      if (state.isOnline && !state.isSyncingOfflineQueue && state.pendingMutationsCount === 0 && state.pendingSaveCount === 0) {
        setJustReconnected(true);
        toast.success('Connection restored! All pending changes have been synchronized.', { id: 'network-status' });
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => setJustReconnected(false), 3000);
      }
    };

    const handleOffline = () => {
      setJustReconnected(false);
      recordOffline();
      toast.warning('You are offline. Changes will be saved locally.', { id: 'network-status' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!useConnectivityStore.getState().checkIsOnline() && isOnline) {
      recordOffline();
    }

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [isOnline, recordOnline, recordOffline]);

  const handleRetryConnection = async () => {
    setIsChecking(true);
    try {
      // Test connectivity by checking online state
      const isReachable = typeof navigator === 'undefined' || navigator.onLine;
      if (isReachable) {
        await sessionCoordinator.handleOnline();
        const state = useConnectivityStore.getState();
        if (state.isOnline && !state.isSyncingOfflineQueue && state.pendingMutationsCount === 0 && state.pendingSaveCount === 0) {
          setJustReconnected(true);
          toast.success('Reconnected to server', { id: 'network-status' });
          setTimeout(() => setJustReconnected(false), 3000);
        }
      } else {
        toast.error('Network still unreachable', { id: 'network-status' });
      }
    } catch {
      toast.error('Failed to reconnect', { id: 'network-status' });
    } finally {
      setIsChecking(false);
    }
  };

  if (isOnline && !justReconnected && !isSyncingOfflineQueue) {
    return null;
  }

  if (isOnline && isSyncingOfflineQueue) {
    return (
      <div className="w-full bg-info text-info-foreground border-b border-info/30 px-4 py-1.5 flex items-center justify-between text-xs font-medium z-30 transition-colors">
        <div className="flex items-center gap-2">
          <RefreshCw className="size-4 shrink-0 animate-spin" />
          <span>
            Connection restored. Synchronizing pending offline changes
            {pendingMutationsCount + pendingSaveCount > 0 ? ` (${pendingMutationsCount + pendingSaveCount} remaining)...` : '...'}
          </span>
        </div>
      </div>
    );
  }

  if (justReconnected) {
    return (
      <div className="w-full bg-success text-success-foreground border-b border-success/30 px-4 py-1.5 flex items-center justify-between text-xs font-medium z-30 transition-colors">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Connection restored! All pending changes have been synchronized.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="w-full bg-warning text-warning-foreground border-b border-warning/30 px-4 py-1.5 flex items-center justify-between text-xs font-medium z-30 shadow-none transition-colors"
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <WifiOff className="size-4 shrink-0" />
        <span className="truncate">
          <span className="font-semibold">Offline Mode:</span> Editing is saved locally to your device (IndexedDB) and will sync once reconnected.
          {offlinePendingCompile && ' Compilation queued for when connection is restored.'}
          {pendingSaveCount > 0 && ` (${pendingSaveCount} pending changes)`}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-6 px-2.5 text-xs bg-warning-foreground/15 hover:bg-warning-foreground/25 text-warning-foreground border border-warning-foreground/20 cursor-pointer shadow-none"
          disabled={isChecking}
          onClick={handleRetryConnection}
        >
          <RefreshCw className={`size-3 mr-1.5 ${isChecking ? 'animate-spin' : ''}`} />
          {isChecking ? 'Checking...' : 'Retry Connection'}
        </Button>
      </div>
    </div>
  );
}

export default OfflineBanner;
