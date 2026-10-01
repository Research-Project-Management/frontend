import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReaderInspector } from '@/features/reader/components/inspector';
import { Panel } from '@/features/reader';

// Mock tanstack query and next
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    getQueryData: vi.fn(),
    getQueriesData: vi.fn().mockReturnValue([]),
  }),
}));

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
      <ReaderInspector
        item={testItem}
        paper={testItem}
        scopeId="user"
        canEdit={true}
      />
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
      <Panel
        item={testItem}
        paper={testItem}
        scopeId="user"
      />
    );

    const titleInput = screen.getByRole('textbox', { name: /document title/i });
    expect(titleInput).toBeDefined();
    expect((titleInput as HTMLInputElement).value).toBe('Attention Is All You Need');
  });
});
