'use client';

import { useMemo } from 'react';
import { useProjectsQuery } from '@/features/projects/shell/hooks/use-project';
import { useAuth } from '@/features/auth/hooks/use-auth';

export {
  getSchemaRegistryVersion,
  getLibrarySchemaSnapshot,
  registerSchemaRegistryUpdateListener,
  type LibrarySchemaRegistrySnapshot,
  DEFAULT_READER_TABS,
  MAX_READER_TABS,
  MAX_BOOKMARKED_ITEMS,
  MIN_READER_ZOOM,
  MAX_READER_ZOOM,
  enforceMaxReaderTabs,
  enforceMaxBookmarkedItems,
  normalizeReaderZoom,
  normalizeReaderFitMode,
  normalizeReaderTheme,
  normalizeReaderTab,
  resolveNextActiveTabOnClose,
  type StorageLike,
  setLibraryStorageProvider,
  setLibrarySessionStorageProvider,
  isBrowser,
  SCHEMA_VERSION,
  syncDynamicSchemasToMemory,
  saveSchemaCache,
  loadSchemaCache,
  loadFeedReadEntryIdsFromStorage,
  saveFeedReadEntryIdsToStorage,
  loadReaderStorageState,
  mergeReaderTabsWithStorage,
  saveReaderTabsToStorage,
  saveReaderBookmarksToStorage,
  READER_TABS_STORAGE_KEY,
  READER_ACTIVE_TAB_STORAGE_KEY,
  READER_BOOKMARKS_STORAGE_KEY,
  FEED_READ_IDS_STORAGE_KEY,
} from './library-local-storage.adapter';

interface LibraryProjectScope {
  id: string;
  name: string;
  role?: string;
  permissions?: string[] | Record<string, unknown>;
  effectivePermissions?: string[];
  members?: Array<{ id?: string; userId: string; role: string }>;
  [key: string]: unknown;
}

interface LibraryUserSession {
  id?: string;
  email?: string;
  name?: string;
}

interface UseLibraryProjectContextReturn {
  projects: LibraryProjectScope[];
  isLoadingProjects: boolean;
  currentUser: LibraryUserSession | null;
  currentUserId?: string;
  isAuthenticated: boolean;
}

/**
 * Anti-Corruption Layer (ACL) / Adapter for Library Feature.
 * Decouples library internals from external project and authentication module implementations.
 */
export function useLibraryProjectContext(): UseLibraryProjectContextReturn {
  const { projects = [], isLoading } = useProjectsQuery();
  const { user, isAuthenticated } = useAuth();

  const mappedProjects = useMemo(
    () =>
      projects.map(
        (p): LibraryProjectScope => ({
          ...p,
          id: p.id,
          name: p.name,
          role: typeof p.role === 'string' ? p.role : undefined,
          permissions: p.permissions,
        }),
      ),
    [projects],
  );

  const currentUser = useMemo(
    () => (user ? { id: user.id, email: user.email, name: user.name } : null),
    [user],
  );

  return {
    projects: mappedProjects,
    isLoadingProjects: isLoading,
    currentUser,
    currentUserId: user?.id,
    isAuthenticated,
  };
}
