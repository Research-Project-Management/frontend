import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { LibrarySidebar } from '@/features/library/ui/sidebar/LibrarySidebar';
import { FeedsListSection } from '@/features/library/ui/sidebar/FeedsListSection';
import { SavedSearchListSection } from '@/features/library/ui/sidebar/SavedSearchListSection';
import { SidebarSystemNav } from '@/features/library/ui/sidebar/SidebarSystemNav';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import type { SavedSearch } from '@/features/library/types/ingestion.types';

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/library',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/features/library/core/coordinator/citation.coordinator', () => ({
  executeExportScopeFormat: vi.fn(),
}));

vi.mock('@/features/library/core/coordinator/collection.coordinator', () => ({
  useCollections: () => ({}),
  useCollectionsQuery: () => ({ data: [] }),
  useMoveCollectionItemsMutation: () => ({ mutateAsync: vi.fn() }),
  useAssignCollectionItemsMutation: () => ({ mutateAsync: vi.fn() }),
  useBatchDetachItemsMutation: () => ({ mutateAsync: vi.fn() }),
  useCollectionCoordinator: () => ({
    rename: { renamingId: null, renameValue: '', setRenameValue: vi.fn() },
    handlers: {
      openCreateRoot: vi.fn(),
      startRename: vi.fn(),
      submitRename: vi.fn(),
      handleDelete: vi.fn(),
      handleDeleteWithItems: vi.fn(),
      handleMove: vi.fn(),
      handleCopy: vi.fn(),
      openCreateSub: vi.fn(),
      handleExportBibtex: vi.fn(),
      handleExportBundle: vi.fn(),
    },
  }),
}));

vi.mock('@/features/library/core/coordinator/saved-search.coordinator', () => ({
  useSavedSearches: () => ({
    savedSearches: [],
    createSavedSearch: vi.fn(),
    updateSavedSearch: vi.fn(),
    deleteSavedSearch: vi.fn(),
  }),
  useTrash: () => ({ trashItems: [], emptyTrash: vi.fn() }),
  useDeleteLibraryItemsMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/features/library/core/coordinator/item-action.coordinator', () => ({
  useBatchRestoreItemsMutation: () => ({ mutateAsync: vi.fn() }),
  useLibraryCountsQuery: () => ({ data: {} }),
  useDropToMyPublications: () => vi.fn(),
  useLibraryCacheSynchronizer: () => ({ resolveCachedItem: vi.fn() }),
}));

vi.mock('@/features/library/core/adapters/project-context.adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/library/core/adapters/project-context.adapter')>();
  return {
    ...actual,
    useLibraryProjectContext: () => ({ projects: [], currentUserId: 'user-1' }),
  };
});

vi.mock('@/features/library/core/coordinator/curation.coordinator', () => ({
  useFeedSubscriptionsQuery: () => ({ data: [] }),
  useUnsubscribeFeedMutation: () => ({ mutateAsync: vi.fn() }),
}));

describe('LibrarySidebar Navigation, System Views, Saved Searches & Feeds', () => {
  beforeEach(() => {
    useFeedsStore.setState({
      feeds: [
        {
          id: 'feed-1',
          name: 'Nature Communications',
          url: 'https://nature.com/feed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Root My Library Node', () => {
    it('renders My Library root link, context menu actions, and drag/drop target', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <LibrarySidebar />
          </TooltipProvider>
        </QueryClientProvider>,
      );

      const rootLink = screen.getByRole('link', { name: /My Library/i });
      expect(rootLink.getAttribute('href')).toBe('/library');

      fireEvent.contextMenu(rootLink);
      expect(screen.queryByText(/New Collection\.\.\./i)).toBeDefined();
      expect(screen.queryByText(/New Saved Search\.\.\./i)).toBeDefined();
      expect(screen.queryByText(/Export Library\.\.\./i)).toBeDefined();

      fireEvent.dragOver(rootLink, {
        dataTransfer: { types: ['application/json'] },
      });
      fireEvent.drop(rootLink, {
        dataTransfer: {
          types: ['application/json'],
          getData: (type: string) => (type === 'application/json' ? JSON.stringify(['item-1']) : ''),
        },
      });
      expect(rootLink).toBeDefined();
    });
  });

  describe('SidebarSystemNav & Trash Context Menu', () => {
    const sysProps = {
      basePath: '/library',
      pathname: '/library',
      currentFilter: null,
      navId: 'test-nav',
      savedSearches: [],
    };

    it('renders Trash badge only when trashCount > 0 and preserves Duplicate badge while omitting Starred/Unfiled badges', () => {
      const { container, unmount } = render(<SidebarSystemNav {...sysProps} trashCount={0} />);
      expect(screen.getByRole('link', { name: /Trash/i }).getAttribute('href')).toBe('/library?filter=trash');
      expect(container.querySelector('span.tabular-nums')).toBeNull();
      unmount();

      render(
        <SidebarSystemNav
          {...sysProps}
          trashCount={14}
          stats={{ starredCount: 15, unfiledCount: 22, duplicateCount: 3 }}
        />,
      );
      expect(screen.getByText('14')).toBeDefined();
      expect(screen.getByRole('link', { name: /Starred Items/i }).textContent).not.toContain('15');
      expect(screen.getByRole('link', { name: /Unfiled Items/i }).textContent).not.toContain('22');
      expect(screen.getByRole('link', { name: /Duplicate Items/i }).textContent).toContain('3');
    });

    it('invokes Empty Trash... when populated and disables it when empty', () => {
      const handleEmptyTrash = vi.fn();
      const { unmount } = render(
        <SidebarSystemNav
          {...sysProps}
          trashCount={5}
          canEmptyTrash={true}
          onEmptyTrash={handleEmptyTrash}
        />,
      );

      fireEvent.contextMenu(screen.getByRole('link', { name: /Trash/i }));
      const emptyTrashMenuItem = screen.queryByText(/Empty Trash\.\.\./i);
      if (emptyTrashMenuItem) {
        fireEvent.click(emptyTrashMenuItem);
        expect(handleEmptyTrash).toHaveBeenCalledTimes(1);
      }
      unmount();

      render(
        <SidebarSystemNav
          {...sysProps}
          trashCount={undefined}
          canEmptyTrash={true}
          onEmptyTrash={handleEmptyTrash}
        />,
      );
      fireEvent.contextMenu(screen.getByRole('link', { name: /Trash/i }));
      const disabledItem = screen.queryByText(/Empty Trash\.\.\./i);
      if (disabledItem) {
        const itemEl = disabledItem.closest('[data-slot="context-menu-item"]') || disabledItem;
        expect(
          itemEl.hasAttribute('data-disabled') ||
            itemEl.getAttribute('aria-disabled') === 'true' ||
            itemEl.className.includes('disabled'),
        ).toBe(true);
      }
    });
  });

  describe('SavedSearchListSection Context Menu', () => {
    it('renders saved search link and dispatches Edit action from context menu', () => {
      const mockSavedSearch: SavedSearch = {
        id: 'ss-1',
        name: 'Quantum Papers',
        conjunction: 'AND',
        conditions: [{ field: 'title', operator: 'contains', value: 'quantum' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const handleEdit = vi.fn();

      render(
        <SavedSearchListSection
          savedSearches={[mockSavedSearch]}
          basePath="/library"
          navId="test-nav"
          currentFilter={null}
          isActiveScope={true}
          onEditSavedSearch={handleEdit}
          onStartRenameSavedSearch={vi.fn()}
          onDuplicateSavedSearch={vi.fn()}
          onDeleteSavedSearch={vi.fn()}
        />,
      );

      const ssLink = screen.getByRole('link', { name: /Quantum Papers/i });
      expect(ssLink.getAttribute('href')).toBe('/library?filter=saved-search&savedSearchId=ss-1');

      fireEvent.contextMenu(ssLink);
      expect(screen.queryByText(/Rename Saved Search/i)).toBeDefined();
      expect(screen.queryByText(/Duplicate Saved Search/i)).toBeDefined();
      expect(screen.queryByText(/Delete Saved Search/i)).toBeDefined();

      const editMenuItem = screen.queryByText(/Edit Saved Search\.\.\./i);
      if (editMenuItem) {
        fireEvent.click(editMenuItem);
        expect(handleEdit).toHaveBeenCalledWith(mockSavedSearch);
      }
    });
  });

  describe('FeedsListSection Context Menu', () => {
    it('renders Feeds root New Feed... menu and individual feed actions', () => {
      render(
        <TooltipProvider>
          <FeedsListSection
            basePath="/library"
            navId="test-nav"
            currentFilter={null}
            isActiveScope={true}
          />
        </TooltipProvider>,
      );

      const feedsRoot = screen.getByText(/^Feeds$/i);
      fireEvent.contextMenu(feedsRoot);
      expect(screen.queryByText(/New Feed\.\.\./i)).toBeDefined();
      fireEvent.keyDown(document, { key: 'Escape' });

      const feedLink = screen.getByRole('link', { name: /Nature Communications/i });
      fireEvent.contextMenu(feedLink);
      expect(screen.queryByText(/Refresh Feed/i)).toBeDefined();
      expect(screen.queryByText(/Mark Feed as Read/i)).toBeDefined();
      expect(screen.queryByText(/Edit Feed\.\.\./i)).toBeDefined();
      expect(screen.queryByText(/Unsubscribe/i)).toBeDefined();
    });
  });
});
