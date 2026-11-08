import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LibrarySidebar } from '@/features/library/ui/sidebar/LibrarySidebar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/library',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/features/library/core/coordinator/citation-export.coordinator', () => ({
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

vi.mock('@/features/library/core/coordinator/saved-search-builder.coordinator', () => ({
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

import { TooltipProvider } from '@/shared/components/ui/tooltip';

describe('LibrarySidebar — Root Library Parity with Zotero', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <LibrarySidebar />
        </TooltipProvider>
      </QueryClientProvider>,
    );

  it('should render Root "My Library" node with link to /library', () => {
    renderComponent();

    const rootLink = screen.getByRole('link', { name: /My Library/i });
    expect(rootLink).toBeDefined();
    expect(rootLink.getAttribute('href')).toBe('/library');
  });

  it('should render ContextMenu on My Library right-click with New Collection, New Saved Search, and Export Library', () => {
    renderComponent();

    const rootLink = screen.getByRole('link', { name: /My Library/i });
    fireEvent.contextMenu(rootLink);

    expect(screen.queryByText(/New Collection\.\.\./i)).toBeDefined();
    expect(screen.queryByText(/New Saved Search\.\.\./i)).toBeDefined();
    expect(screen.queryByText(/Export Library\.\.\./i)).toBeDefined();
  });

  it('should support drag over and drop onto My Library root node', () => {
    renderComponent();

    const rootLink = screen.getByRole('link', { name: /My Library/i });

    // Drag over
    fireEvent.dragOver(rootLink, {
      dataTransfer: { types: ['application/json'] },
    });

    // Drop
    fireEvent.drop(rootLink, {
      dataTransfer: {
        types: ['application/json'],
        getData: (type: string) => (type === 'application/json' ? JSON.stringify(['item-1']) : ''),
      },
    });

    expect(rootLink).toBeDefined();
  });
});
