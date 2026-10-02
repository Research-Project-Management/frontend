import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReaderInspector } from '@/features/reader/components/inspector';
import { Panel } from '@/features/reader';

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

vi.mock('@/features/reader/data/reader.queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/reader/data/reader.queries')>();
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

vi.mock('@/features/library', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/library')>();
  return {
    ...actual,
    useLibrarySidebarStore: vi.fn((selector) =>
      selector({
        isInspectorOpen: true,
        toggleInspector: vi.fn(),
        activeInspectorTab: 'info',
        setActiveInspectorTab: vi.fn(),
        setIsInspectorOpen: vi.fn(),
        inspectorWidth: 360,
        setInspectorWidth: vi.fn(),
      })
    ),
    useLibraryViewStore: vi.fn((selector) =>
      selector({
        activeItemId: 'test-paper-1',
        selectOnly: vi.fn(),
      })
    ),
    useLibraryModalStore: vi.fn((selector) =>
      selector({
        openModal: vi.fn(),
      })
    ),
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
    useCollections: vi.fn().mockReturnValue({
      state: { collections: [] },
    }),
    useRelations: vi.fn().mockReturnValue({
      relatedItems: [],
    }),
    useRetraction: vi.fn().mockReturnValue({
      unflagItem: vi.fn(),
      checkItem: vi.fn(),
      isCheckingItem: false,
      isUnflagging: false,
    }),
  };
});

describe('ReaderInspector Cloned Component Parity', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders ReaderInspector with title and inspector tabs', () => {
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
            paper={testItem}
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
  });

  it('renders Panel wrapper delegating to ReaderInspector', () => {
    const testItem = {
      id: 'test-paper-1',
      title: 'Attention Is All You Need',
      itemType: 'journalArticle',
    } as any;

    render(
      <QueryClientProvider client={createTestClient()}>
        <TooltipProvider>
          <Panel
            item={testItem}
            paper={testItem}
            scopeId="user"
          />
        </TooltipProvider>
      </QueryClientProvider>
    );

    const titleInput = screen.getByRole('textbox', { name: /document title/i });
    expect(titleInput).toBeDefined();
    expect((titleInput as HTMLInputElement).value).toBe('Attention Is All You Need');
  });
});
