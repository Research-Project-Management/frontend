import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReaderInspector } from '@/features/library/ui/inspector/LibraryInspector';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

const createTestClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/features/library/sdk/queries/reader.queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/library/sdk/queries/reader.queries')>();
  return {
    ...actual,
    useReaderItem: vi.fn().mockReturnValue({
      data: {
        id: 'test-paper-1',
        title: 'Attention Is All You Need',
        itemType: 'journalArticle',
      },
      isLoading: false,
    }),
    useReaderFulltext: vi.fn().mockReturnValue({
      data: null,
      isLoading: false,
    }),
  };
});

vi.mock('@/features/library/core/store/library-ui.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/library/core/store/library-ui.store')>();
  return {
    ...actual,
    useLibraryUIStore: vi.fn((selector) =>
      selector({
        isInspectorOpen: true,
        toggleInspector: vi.fn(),
        activeInspectorTab: 'info',
        setActiveInspectorTab: vi.fn(),
        setIsInspectorOpen: vi.fn(),
        inspectorWidth: 360,
        setInspectorWidth: vi.fn(),
        activeItemId: 'test-paper-1',
        selectOnly: vi.fn(),
        openModal: vi.fn(),
      })
    ),
  };
});

vi.mock('@/features/library/sdk/queries/catalog.queries', () => ({
  useLibraryCacheSynchronizer: vi.fn().mockReturnValue({
    resolveCachedItem: vi.fn().mockReturnValue(null),
    patchItemInAllQueries: vi.fn(),
  }),
  useLibraryItemDetailQuery: vi.fn().mockReturnValue({
    data: {
      id: 'test-paper-1',
      title: 'Attention Is All You Need',
      itemType: 'journalArticle',
      creators: [{ firstName: 'Ashish', lastName: 'Vaswani', creatorType: 'author' }],
    },
    isLoading: false,
  }),
  useUpdateLibraryItemMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useBatchRestoreItemsMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
  useDeleteLibraryItemsMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/features/library/sdk/queries/collections.queries', () => ({
  useCollections: vi.fn().mockReturnValue({
    collections: [],
    isLoading: false,
  }),
}));

vi.mock('@/features/library/sdk/queries/relations.queries', () => ({
  useRelations: vi.fn().mockReturnValue({
    relatedItems: [],
  }),
}));

vi.mock('@/features/library/sdk/queries/ingestion.queries', () => ({
  useRetraction: vi.fn().mockReturnValue({
    unflagItem: vi.fn(),
    checkItem: vi.fn(),
    isCheckingItem: false,
    isUnflagging: false,
  }),
}));

describe('ReaderInspector Shared LibraryInspector Parity', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders ReaderInspector with title and standard inspector tabs without AI copilot', () => {
    const testItem = {
      id: 'test-paper-1',
      title: 'Attention Is All You Need',
      itemType: 'journalArticle',
      creators: [{ firstName: 'Ashish', lastName: 'Vaswani', creatorType: 'author' }],
    } as any;

    render(
      <QueryClientProvider client={createTestClient()}>
        <TooltipProvider>
          <ReaderInspector
            item={testItem}
            scopeId="user"
            canEdit={true}
          />
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Document Title in InspectorHeader
    const titleInput = screen.getByRole('textbox', { name: /document title/i });
    expect(titleInput).toBeDefined();
    expect((titleInput as HTMLInputElement).value).toBe('Attention Is All You Need');

    // Inspector Tabs panel bar exists
    const panelBar = screen.getByRole('complementary', { name: /inspector panel bar/i });
    expect(panelBar).toBeDefined();

    // Paper AI Copilot has been removed from Reader inspector
    const aiCopilotButtons = screen.queryAllByRole('button', { name: /paper ai copilot/i });
    expect(aiCopilotButtons.length).toBe(0);
  });

  it('progressively discloses sections based on activeInspectorTab level', async () => {
    const testItem = {
      id: 'test-paper-1',
      title: 'Attention Is All You Need',
      itemType: 'journalArticle',
    } as any;

    const { useLibraryUIStore } = await import('@/features/library/core/store/library-ui.store');
    const mockedStore = vi.mocked(useLibraryUIStore);

    // Level 1: 'cite' -> only Citation section visible (1 bar)
    mockedStore.mockImplementation((selector: any) =>
      selector({
        isInspectorOpen: true,
        toggleInspector: vi.fn(),
        activeInspectorTab: 'cite',
        setActiveInspectorTab: vi.fn(),
        setIsInspectorOpen: vi.fn(),
        inspectorWidth: 360,
        setInspectorWidth: vi.fn(),
        activeItemId: 'test-paper-1',
        selectOnly: vi.fn(),
        openModal: vi.fn(),
      })
    );

    render(
      <QueryClientProvider client={createTestClient()}>
        <TooltipProvider>
          <ReaderInspector
            item={testItem}
            scopeId="user"
            canEdit={true}
          />
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Only citation section exists
    expect(document.getElementById('inspector-section-cite')).not.toBeNull();
    expect(document.getElementById('inspector-section-relations')).toBeNull();
    expect(document.getElementById('inspector-section-tags')).toBeNull();
    expect(document.getElementById('inspector-section-info')).toBeNull();

    cleanup();

    // Level 2: 'relations' -> 2 bars (relations + cite)
    mockedStore.mockImplementation((selector: any) =>
      selector({
        isInspectorOpen: true,
        toggleInspector: vi.fn(),
        activeInspectorTab: 'relations',
        setActiveInspectorTab: vi.fn(),
        setIsInspectorOpen: vi.fn(),
        inspectorWidth: 360,
        setInspectorWidth: vi.fn(),
        activeItemId: 'test-paper-1',
        selectOnly: vi.fn(),
        openModal: vi.fn(),
      })
    );

    render(
      <QueryClientProvider client={createTestClient()}>
        <TooltipProvider>
          <ReaderInspector
            item={testItem}
            scopeId="user"
            canEdit={true}
          />
        </TooltipProvider>
      </QueryClientProvider>
    );

    expect(document.getElementById('inspector-section-cite')).not.toBeNull();
    expect(document.getElementById('inspector-section-relations')).not.toBeNull();
    expect(document.getElementById('inspector-section-tags')).toBeNull();
    expect(document.getElementById('inspector-section-info')).toBeNull();
  });
});

