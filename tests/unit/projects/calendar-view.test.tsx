import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CalendarView } from '@/features/projects/project-id/work-items/components/views/CalendarView';
import type { Column, Item } from '@/features/projects/project-id/work-items/types/work-item.types';

const mockColumns: Column[] = [
  { id: 'todo', name: 'To Do', color: '#6B7280', sequence: 0 },
  { id: 'in_progress', name: 'In Progress', color: '#3B82F6', sequence: 1 },
  { id: 'done', name: 'Done', color: '#10B981', sequence: 2 },
];

const mockItems: Item[] = [
  {
    id: 'item-1',
    sequenceNumber: 19,
    identifier: 'FLUX-19',
    title: 'Implement Adam optimizer',
    columnId: 'in_progress',
    startDate: '2026-09-28T00:00:00.000Z',
    dueDate: '2026-10-08T00:00:00.000Z',
    labels: [],
  },
  {
    id: 'item-2',
    sequenceNumber: 23,
    identifier: 'FLUX-23',
    title: 'Draft Section 2',
    columnId: 'in_progress',
    startDate: '2026-09-29T00:00:00.000Z',
    dueDate: '2026-10-10T00:00:00.000Z',
    labels: [],
  },
];

describe('CalendarView Component', () => {
  it('renders sticky week day labels', () => {
    render(
      <CalendarView
        items={mockItems}
        columns={mockColumns}
        projectId="proj-1"
        onAddCard={vi.fn()}
        onOpenCardDetail={vi.fn()}
      />
    );

    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
  });

  it('renders items with correct titles and date range badge', () => {
    render(
      <CalendarView
        items={mockItems}
        columns={mockColumns}
        projectId="proj-1"
        onAddCard={vi.fn()}
        onOpenCardDetail={vi.fn()}
      />
    );

    // Items should be rendered in the calendar
    const flux19s = screen.getAllByText('Implement Adam optimizer');
    expect(flux19s.length).toBeGreaterThan(0);
    const flux23s = screen.getAllByText('Draft Section 2');
    expect(flux23s.length).toBeGreaterThan(0);

    // Date range badge with arrow should be visible for multi-day tasks
    const dateBadges = screen.getAllByText('28/09 → 08/10');
    expect(dateBadges.length).toBeGreaterThan(0);
    expect(dateBadges[0]).toBeInTheDocument();
  });
});
