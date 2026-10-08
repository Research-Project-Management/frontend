/**
 * connectivity.store.ts
 *
 * Store for Network Connectivity and Cloud Sync Status (State Layer).
 * Tracks online/offline transitions, pending cloud writes, and sync health.
 */

import { create } from 'zustand';

export type CloudSyncStatus = 'synced' | 'saving' | 'offline' | 'error';

export interface ConnectivityState {
  isOnline: boolean;
  syncStatus: CloudSyncStatus;
  lastSavedAt: Date | null;
  pendingSaveCount: number;

  setIsOnline: (isOnline: boolean) => void;
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
  pendingSaveCount: 0,

  setIsOnline: (isOnline) =>
    set({
      isOnline,
      syncStatus: !isOnline ? 'offline' : 'synced',
    }),

  setSyncStatus: (syncStatus) => set({ syncStatus }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt, syncStatus: 'synced' }),

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
        syncStatus: nextCount === 0 && s.isOnline ? 'synced' : s.syncStatus,
      };
    }),

  setPendingSaveCount: (pendingSaveCount) =>
    set((s) => ({
      pendingSaveCount,
      syncStatus: pendingSaveCount === 0 && s.isOnline ? 'synced' : s.isOnline ? 'saving' : 'offline',
    })),
}));
