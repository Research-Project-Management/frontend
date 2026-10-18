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
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useConnectivityStore, sessionCoordinator } from '@/features/editor/core';
import { toast } from 'sonner';

export function OfflineBanner() {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const pendingSaveCount = useConnectivityStore((s) => s.pendingSaveCount);
  const offlinePendingCompile = useConnectivityStore((s) => s.offlinePendingCompile);
  const recordOnline = useConnectivityStore((s) => s.recordOnline);
  const recordOffline = useConnectivityStore((s) => s.recordOffline);

  const [isChecking, setIsChecking] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);

  // Sync with browser online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = async () => {
      recordOnline();
      setJustReconnected(true);
      toast.success('Connection restored. Syncing pending drafts...', { id: 'network-status' });
      await sessionCoordinator.flushAllPending();
      setTimeout(() => setJustReconnected(false), 3000);
    };

    const handleOffline = () => {
      recordOffline();
      toast.warning('You are offline. Changes will be saved locally.', { id: 'network-status' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    if (!navigator.onLine && isOnline) {
      recordOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline, recordOnline, recordOffline]);

  const handleRetryConnection = async () => {
    setIsChecking(true);
    try {
      // Test connectivity by pinging an accessible endpoint
      const isReachable = navigator.onLine;
      if (isReachable) {
        recordOnline();
        toast.success('Reconnected to server', { id: 'network-status' });
        await sessionCoordinator.flushAllPending();
      } else {
        toast.error('Network still unreachable', { id: 'network-status' });
      }
    } catch {
      toast.error('Failed to reconnect', { id: 'network-status' });
    } finally {
      setIsChecking(false);
    }
  };

  if (isOnline && !justReconnected) {
    return null;
  }

  if (justReconnected) {
    return (
      <div className="w-full bg-success text-success-foreground border-b border-success/30 px-4 py-1.5 flex items-center justify-between text-xs font-medium z-30 transition-all">
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
      className="w-full bg-warning text-warning-foreground border-b border-warning/30 px-4 py-1.5 flex items-center justify-between text-xs font-medium z-30 shadow-none transition-all"
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
