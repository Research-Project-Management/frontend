'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useToggleProjectFavorite } from './use-project';

const FAVORITES_EVENT = 'flux:favorites-changed';

export interface UseFavoritesState {
  readonly favoriteIds: Set<string>;
  readonly isPending: boolean;
  readonly count: number;
}

export interface UseFavoritesActions {
  toggleFavorite: (id: string, e?: React.MouseEvent) => void;
  isFavorite: (id: string) => boolean;
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  clearFavorites: () => void;
}

export interface UseFavoritesReturn {
  state: UseFavoritesState;
  actions: UseFavoritesActions;
  // Backwards compatibility aliases
  favoriteIds: Set<string>;
  toggleFavorite: (id: string, e?: React.MouseEvent) => void;
  isFavorite: (id: string) => boolean;
  isPending: boolean;
}

export function useFavorites(workspaceId?: string): UseFavoritesReturn {
  const toggleFavoriteMutation = useToggleProjectFavorite();

  const getStorageKey = useCallback(() => {
    return workspaceId
      ? `sidebar_favorites_${workspaceId}`
      : 'sidebar_favorites';
  }, [workspaceId]);

  const readFavorites = useCallback((): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const key = getStorageKey();
      const saved =
        localStorage.getItem(key) ||
        localStorage.getItem(`sidebar_favorite_projects_${workspaceId}`) ||
        localStorage.getItem('sidebar_favorites') ||
        localStorage.getItem('sidebar_favorite_projects');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // Fallback
    }
    return new Set();
  }, [getStorageKey, workspaceId]);

  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(readFavorites);

  useEffect(() => {
    setFavoriteIds(readFavorites());

    const handleSync = () => {
      setFavoriteIds(readFavorites());
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener(FAVORITES_EVENT, handleSync);
    window.addEventListener('flux:project-favorites-changed', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener(FAVORITES_EVENT, handleSync);
      window.removeEventListener('flux:project-favorites-changed', handleSync);
    };
  }, [readFavorites]);

  const saveFavorites = useCallback(
    (next: Set<string>) => {
      try {
        const key = getStorageKey();
        const serialized = JSON.stringify(Array.from(next));
        localStorage.setItem(key, serialized);
        localStorage.setItem('sidebar_favorites', serialized);
        window.dispatchEvent(new CustomEvent(FAVORITES_EVENT));
        window.dispatchEvent(new CustomEvent('flux:project-favorites-changed'));
      } catch {
        // Handle storage error
      }
    },
    [getStorageKey]
  );

  const toggleFavorite = useCallback(
    (id: string, e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const willBeFavorite = !favoriteIds.has(id);

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        saveFavorites(next);
        return next;
      });

      // Synchronize with server API
      if (id) {
        toggleFavoriteMutation.mutate(
          { projectId: id, isFavorite: willBeFavorite },
          { onError: () => {} }
        );
      }
    },
    [favoriteIds, saveFavorites, toggleFavoriteMutation]
  );

  const addFavorite = useCallback(
    (id: string) => {
      if (!favoriteIds.has(id)) {
        toggleFavorite(id);
      }
    },
    [favoriteIds, toggleFavorite]
  );

  const removeFavorite = useCallback(
    (id: string) => {
      if (favoriteIds.has(id)) {
        toggleFavorite(id);
      }
    },
    [favoriteIds, toggleFavorite]
  );

  const clearFavorites = useCallback(() => {
    const empty = new Set<string>();
    setFavoriteIds(empty);
    saveFavorites(empty);
  }, [saveFavorites]);

  const isFavorite = useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds]
  );

  const state: UseFavoritesState = useMemo(
    () => ({
      favoriteIds,
      isPending: toggleFavoriteMutation.isPending,
      count: favoriteIds.size,
    }),
    [favoriteIds, toggleFavoriteMutation.isPending]
  );

  const actions: UseFavoritesActions = useMemo(
    () => ({
      toggleFavorite,
      isFavorite,
      addFavorite,
      removeFavorite,
      clearFavorites,
    }),
    [toggleFavorite, isFavorite, addFavorite, removeFavorite, clearFavorites]
  );

  return {
    state,
    actions,
    // Direct getters for backward compatibility
    favoriteIds,
    toggleFavorite,
    isFavorite,
    isPending: toggleFavoriteMutation.isPending,
  };
}

export const useProjectFavorites = useFavorites;
