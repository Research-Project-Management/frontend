/**
 * connectivity.store.ts
 *
 * Store for Network Connectivity and Cloud Sync Status (State Layer).
 * Tracks online/offline transitions, pending cloud writes, offline queues, and sync health.
 */

import { create } from 'zustand';

export type CloudSyncStatus = 'synced' | 'saving' | 'offline' | 'error';

export interface ConnectivityState {
  isOnline: boolean;
  syncStatus: CloudSyncStatus;
  lastSavedAt: Date | null;
  offlineSince: Date | null;
  pendingSaveCount: number;
  offlinePendingCompile: boolean;

  setIsOnline: (isOnline: boolean) => void;
  recordOffline: (since?: Date) => void;
  recordOnline: () => void;
  setOfflinePendingCompile: (pending: boolean) => void;
  setSyncStatus: (status: CloudSyncStatus) => void;
  setLastSavedAt: (date: Date) => void;
  incrementPending: () => void;
  decrementPending: () => void;
  setPendingSaveCount: (count: number) => void;
}

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncStatus: 'synced',
  lastSavedAt: null,
  offlineSince: null,
  pendingSaveCount: 0,
  offlinePendingCompile: false,

  setIsOnline: (isOnline) =>
    set((s) => ({
      isOnline,
      offlineSince: !isOnline ? (s.offlineSince ?? new Date()) : null,
      syncStatus: !isOnline ? 'offline' : s.pendingSaveCount > 0 ? 'saving' : 'synced',
    })),

  recordOffline: (since) =>
    set((s) => ({
      isOnline: false,
      offlineSince: since ?? s.offlineSince ?? new Date(),
      syncStatus: 'offline',
    })),

  recordOnline: () =>
    set((s) => ({
      isOnline: true,
      offlineSince: null,
      syncStatus: s.pendingSaveCount > 0 ? 'saving' : 'synced',
    })),

  setOfflinePendingCompile: (offlinePendingCompile) =>
    set({ offlinePendingCompile }),

  setSyncStatus: (syncStatus) =>
    set((s) => ({
      syncStatus: !s.isOnline && syncStatus !== 'offline' ? 'offline' : syncStatus,
    })),

  setLastSavedAt: (lastSavedAt) =>
    set((s) => ({
      lastSavedAt,
      syncStatus: s.isOnline ? 'synced' : 'offline',
    })),

  incrementPending: () =>
    set((s) => ({
      pendingSaveCount: s.pendingSaveCount + 1,
      syncStatus: s.isOnline ? 'saving' : 'offline',
    })),

  decrementPending: () =>
    set((s) => {
      const nextCount = Math.max(0, s.pendingSaveCount - 1);
      return {
        pendingSaveCount: nextCount,
        syncStatus: !s.isOnline
          ? 'offline'
          : nextCount === 0
          ? 'synced'
          : s.syncStatus,
      };
    }),

  setPendingSaveCount: (pendingSaveCount) =>
    set((s) => ({
      pendingSaveCount,
      syncStatus: !s.isOnline
        ? 'offline'
        : pendingSaveCount === 0
        ? 'synced'
        : 'saving',
    })),
}));
