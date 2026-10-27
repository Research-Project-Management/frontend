import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ItemRowActions } from '@/features/library/ui/content/ItemRowActions';
import { ItemTableHeader } from '@/features/library/ui/content/ItemTableHeader';
import { ItemTableRow } from '@/features/library/ui/content/ItemTableRow';
import { BatchBar } from '@/features/library/ui/content/BatchBar';
import { useLibraryUIStore } from '@/features/library/core/store/library-ui.store';
import type { Item, Collection } from '@/features/library/domain/types/library.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  useParams: () => ({}),
}));

vi.mock('@/features/library/sdk/queries/citation.queries', () => ({
  useCitationStyles: () => ({
    data: [],
    styles: [],
    isLoading: false,
  }),
}));

const mockItem: Item = {
  id: 'item-123',
  title: 'Faster R-CNN: Towards Real-Time Object Detection',
  itemType: 'journalArticle',
  citationKey: 'ren2015faster',
  authors: [{ firstName: 'Shaoqing', lastName: 'Ren' }],
  createdAt: '2023-01-01T00:00:00Z',
  updatedAt: '2023-01-01T00:00:00Z',
  version: 1,
};

const mockItem2: Item = {
  id: 'item-456',
  title: 'Attention Is All You Need',
  itemType: 'conferencePaper',
  citationKey: 'vaswani2017attention',
  hasFile: true,
  attachmentCount: 1,
  authors: [{ firstName: 'Ashish', lastName: 'Vaswani' }],
  createdAt: '2023-01-02T00:00:00Z',
  updatedAt: '2023-01-02T00:00:00Z',
  version: 1,
};

const mockCollections: Collection[] = [
  { id: 'col-1', name: 'Deep Learning', itemCount: 5 },
  { id: 'col-2', name: 'Transformers', itemCount: 3 },
];

import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
}

describe('ItemRowActions & Actions Column Parity', () => {
  beforeEach(() => {
    useLibraryUIStore.getState().clearSelection();
    useLibraryUIStore.getState().setActiveItem(null);
  });

  it('renders 3-dots actions trigger for active library items', () => {
    renderWithProviders(
      <ItemRowActions
        item={mockItem}
        isTrash={false}
        onDelete={vi.fn()}
        onToggleStar={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /more actions/i });
    expect(trigger).toBeDefined();
  });

  it('renders 3-dots actions trigger for trash items', () => {
    renderWithProviders(
      <ItemRowActions
        item={{ ...mockItem, deletedAt: '2023-05-01T00:00:00Z' }}
        isTrash={true}
        onRestore={vi.fn()}
        onPurge={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: /more actions/i });
    expect(trigger).toBeDefined();
  });

  it('ItemTableHeader includes actions column header', () => {
    const { container } = render(
      <TooltipProvider>
        <table>
          <ItemTableHeader
            columns={{ authors: true, year: true, publication: true }}
            isAllSelected={false}
            onSelectAll={vi.fn()}
            sortColumn="title"
            sortDirection="asc"
            onSort={vi.fn()}
          />
        </table>
      </TooltipProvider>
    );

    const actionHeaders = container.querySelectorAll('th[aria-label="Actions"]');
    expect(actionHeaders.length).toBe(1);
  });

  it('ItemTableRow does NOT apply ring-inset wrapping border on selected rows', () => {
    useLibraryUIStore.getState().selectAll(['item-123']);

    const { container } = renderWithProviders(
      <table>
        <tbody>
          <ItemTableRow
            item={mockItem}
            index={0}
            isLast={false}
            columns={{ authors: true, year: true, publication: true }}
            isTrash={false}
            collections={mockCollections}
            canEdit={true}
            onRowClick={vi.fn()}
            onToggleSelect={vi.fn()}
            onOpenItem={vi.fn()}
          />
        </tbody>
      </table>
    );

    const tr = container.querySelector('tr');
    expect(tr).not.toBeNull();
    expect(tr?.className).toContain('bg-primary/10');
    expect(tr?.className).not.toContain('ring-inset');
    expect(tr?.className).not.toContain('ring-1');
  });

  it('BatchBar hides Merge on normal library pages and only shows Merge on duplicates page', () => {
    useLibraryUIStore.getState().selectAll(['item-123', 'item-456']);

    const { unmount } = renderWithProviders(
      <BatchBar
        items={[mockItem, mockItem2]}
        collections={mockCollections}
        view={undefined}
        isTrash={false}
        canEdit={true}
      />
    );

    expect(screen.queryByText(/Merge 2 items/i)).toBeNull();
    expect(screen.getByText(/^Move to$/i)).toBeDefined();
    expect(screen.getByText(/Rename PDFs/i)).toBeDefined();
    unmount();

    renderWithProviders(
      <BatchBar
        items={[mockItem, mockItem2]}
        collections={mockCollections}
        view="duplicates"
        isTrash={false}
        canEdit={true}
      />
    );

    expect(screen.getByText(/Merge 2 items/i)).toBeDefined();
    expect(screen.queryByText(/^Move to$/i)).toBeNull();
  });

  it('BatchBar hides Rename PDFs when selected items have no PDF attachments', () => {
    useLibraryUIStore.getState().selectAll(['item-123']);

    renderWithProviders(
      <BatchBar
        items={[mockItem]}
        collections={mockCollections}
        view={undefined}
        isTrash={false}
        canEdit={true}
      />
    );

    expect(screen.queryByText(/Rename PDFs/i)).toBeNull();
  });

  it('BatchBar shows page-specific actions for Trash, Starred, My Publications, Retracted, and Unfiled views', () => {
    useLibraryUIStore.getState().selectAll(['item-123', 'item-456']);

    // Trash view: only Restore & Delete permanently, no Copy citation or Export
    const { unmount: unmountTrash } = renderWithProviders(
      <BatchBar
        items={[mockItem, mockItem2]}
        collections={mockCollections}
        view="trash"
        isTrash={true}
        canEdit={true}
      />
    );
    expect(screen.getByText(/^Restore$/i)).toBeDefined();
    expect(screen.getByText(/Delete permanently/i)).toBeDefined();
    expect(screen.queryByText(/Copy citation/i)).toBeNull();
    expect(screen.queryByText(/Export/i)).toBeNull();
    unmountTrash();

    // Starred view: shows Unstar
    const { unmount: unmountStarred } = renderWithProviders(
      <BatchBar
        items={[mockItem, mockItem2]}
        collections={mockCollections}
        view="starred"
        isTrash={false}
        canEdit={true}
      />
    );
    expect(screen.getByText(/^Unstar$/i)).toBeDefined();
    unmountStarred();

    // My Publications view: shows Remove from Publications
    const { unmount: unmountPubs } = renderWithProviders(
      <BatchBar
        items={[mockItem, mockItem2]}
        collections={mockCollections}
        view="my-publications"
        isTrash={false}
        canEdit={true}
      />
    );
    expect(screen.getByText(/Remove from Publications/i)).toBeDefined();
    unmountPubs();

    // Retracted view: shows Re-check retraction & Clear flag
    const { unmount: unmountRetracted } = renderWithProviders(
      <BatchBar
        items={[mockItem, mockItem2]}
        collections={mockCollections}
        view="retracted"
        isTrash={false}
        canEdit={true}
      />
    );
    expect(screen.getByText(/Re-check retraction/i)).toBeDefined();
    expect(screen.getByText(/Clear flag/i)).toBeDefined();
    unmountRetracted();

    // Unfiled view: shows Assign to instead of Move to
    const { unmount: unmountUnfiled } = renderWithProviders(
      <BatchBar
        items={[mockItem, mockItem2]}
        collections={mockCollections}
        view="unfiled"
        isTrash={false}
        canEdit={true}
      />
    );
    expect(screen.getByText(/^Assign to$/i)).toBeDefined();
    unmountUnfiled();
  });
});
