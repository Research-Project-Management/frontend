import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemRowActions } from '@/features/library/ui/content/ItemRowActions';
import { ItemTableHeader } from '@/features/library/ui/content/ItemTableHeader';
import type { Item } from '@/features/library/domain/types/library.types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
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
});
