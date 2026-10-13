import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BoardView } from '@/features/projects/project-id/work-items/components/views/BoardView';
import { ListView } from '@/features/projects/project-id/work-items/components/views/ListView';
import { TableView } from '@/features/projects/project-id/work-items/components/views/TableView';
import type { Item, Column } from '@/features/projects/project-id/work-items/types/work-item.types';

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'proj-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/projects/proj-1',
}));

vi.mock('@/features/projects/project-id/work-items/hooks/use-label', () => ({
  useLabelsQuery: () => ({ data: [], isLoading: false }),
  useCreateLabel: () => ({ mutateAsync: vi.fn() }),
}));

describe('Work Items DOM Virtualization (@tanstack/react-virtual)', () => {
  afterEach(() => {
    cleanup();
  });

  const mockColumns: Column[] = [
    {
      id: 'backlog',
      name: 'Backlog',
      title: 'Backlog',
      group: 'backlog',
      color: '#6B7280',
    },
    {
      id: 'todo',
      name: 'Todo',
      title: 'Todo',
      group: 'unstarted',
      color: '#94A3B8',
    },
  ];

  function createMockItems(count: number, columnId = 'backlog'): Item[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${columnId}-${i + 1}`,
      title: `Research Task ${i + 1}`,
      identifier: `FLUX-${i + 1}`,
      columnId,
      state: {
        id: columnId,
        name: columnId === 'backlog' ? 'Backlog' : 'Todo',
        group: columnId === 'backlog' ? 'backlog' : 'unstarted',
        color: '#6B7280',
      },
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  function renderWithProviders(ui: React.ReactElement) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        {ui}
      </QueryClientProvider>
    );
  }

  describe('BoardView Kanban Column Virtualization', () => {
    it('renders normal card DOM tree when card count is small (<= 25 items)', () => {
      const items = createMockItems(5, 'backlog');
      const itemsByColumnId = new Map([['backlog', items], ['todo', []]]);

      renderWithProviders(
        <BoardView
          columns={mockColumns}
          itemsByColumnId={itemsByColumnId}
          onAddCard={vi.fn()}
          onEditCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onDuplicateCard={vi.fn()}
          onJoinCard={vi.fn()}
          onLeaveCard={vi.fn()}
          onMoveCard={vi.fn()}
          projectId="proj-1"
        />
      );

      // Verify all 5 cards are rendered
      expect(screen.getByText('Research Task 1')).toBeInTheDocument();
      expect(screen.getByText('Research Task 5')).toBeInTheDocument();
    });

    it('mounts without errors and retains sortable container when card count is large (> 25 items)', () => {
      const items = createMockItems(40, 'backlog');
      const itemsByColumnId = new Map([['backlog', items], ['todo', []]]);

      const { container } = renderWithProviders(
        <BoardView
          columns={mockColumns}
          itemsByColumnId={itemsByColumnId}
          onAddCard={vi.fn()}
          onEditCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onDuplicateCard={vi.fn()}
          onJoinCard={vi.fn()}
          onLeaveCard={vi.fn()}
          onMoveCard={vi.fn()}
          projectId="proj-1"
        />
      );

      // Column renders with correct card count badge (40)
      expect(screen.getByText('40')).toBeInTheDocument();
      // Container element is present
      const kanbanContainer = container.querySelector('.kanban-scrollbar');
      expect(kanbanContainer).toBeTruthy();
    });
  });

  describe('ListView Virtualization (Flat list mode)', () => {
    it('renders flat list without errors when item count is large (> 30 items)', () => {
      const items = createMockItems(50, 'backlog');
      const itemsByColumnId = new Map([['backlog', items]]);

      const { container } = renderWithProviders(
        <ListView
          columns={mockColumns}
          itemsByColumnId={itemsByColumnId}
          onAddCard={vi.fn()}
          onEditCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onDuplicateCard={vi.fn()}
          onJoinCard={vi.fn()}
          onLeaveCard={vi.fn()}
          onMoveCard={vi.fn()}
          projectId="proj-1"
          displayOptions={{
            groupBy: 'none',
          }}
        />
      );

      const scrollContainer = container.querySelector('.overflow-y-auto');
      expect(scrollContainer).toBeTruthy();
    });
  });

  describe('TableView Virtualization', () => {
    it('renders normal table rows when row count is small (<= 25 items)', () => {
      const items = createMockItems(5, 'backlog');
      const itemsByColumnId = new Map([['backlog', items]]);

      renderWithProviders(
        <TableView
          items={items}
          columns={mockColumns}
          itemsByColumnId={itemsByColumnId}
          onAddCard={vi.fn()}
          onEditCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onDuplicateCard={vi.fn()}
          onJoinCard={vi.fn()}
          onLeaveCard={vi.fn()}
          onMoveCard={vi.fn()}
          onUpdateCard={vi.fn()}
          projectId="proj-1"
          displayOptions={{
            groupBy: 'none',
          }}
        />
      );

      // Verify table is rendered
      expect(screen.getByRole('table', { name: 'Work items table' })).toBeInTheDocument();
      // All 5 items rendered in non-virtualized standard container
      expect(screen.getByText('Research Task 1')).toBeInTheDocument();
      expect(screen.getByText('Research Task 5')).toBeInTheDocument();
    });

    it('mounts virtualized table without errors when item count is large (> 25 items) in flat mode', () => {
      const items = createMockItems(60, 'backlog');
      const itemsByColumnId = new Map([['backlog', items]]);

      const { container } = renderWithProviders(
        <TableView
          items={items}
          columns={mockColumns}
          itemsByColumnId={itemsByColumnId}
          onAddCard={vi.fn()}
          onEditCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onDuplicateCard={vi.fn()}
          onJoinCard={vi.fn()}
          onLeaveCard={vi.fn()}
          onMoveCard={vi.fn()}
          onUpdateCard={vi.fn()}
          projectId="proj-1"
          displayOptions={{
            groupBy: 'none',
          }}
        />
      );

      expect(screen.getByRole('table', { name: 'Work items table' })).toBeInTheDocument();
      // Verify table scroll container and custom scrollbar exist
      const tableWrapper = container.querySelector('[role="table"]');
      expect(tableWrapper).toBeTruthy();
    });

    it('mounts virtualized grouped table without errors when items are grouped by state', () => {
      const backlogItems = createMockItems(35, 'backlog');
      const todoItems = createMockItems(30, 'todo');
      const allItems = [...backlogItems, ...todoItems];
      const itemsByColumnId = new Map([
        ['backlog', backlogItems],
        ['todo', todoItems],
      ]);

      renderWithProviders(
        <TableView
          items={allItems}
          columns={mockColumns}
          itemsByColumnId={itemsByColumnId}
          onAddCard={vi.fn()}
          onEditCard={vi.fn()}
          onDeleteCard={vi.fn()}
          onDuplicateCard={vi.fn()}
          onJoinCard={vi.fn()}
          onLeaveCard={vi.fn()}
          onMoveCard={vi.fn()}
          onUpdateCard={vi.fn()}
          projectId="proj-1"
          displayOptions={{
            groupBy: 'state',
          }}
        />
      );

      // Verify headers for both groups are rendered
      expect(screen.getAllByText('Backlog')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Todo')[0]).toBeInTheDocument();
      // Verify row items are actually rendered in both groups
      expect(screen.getAllByText('Research Task 1').length).toBeGreaterThanOrEqual(1);
    });
  });
});
