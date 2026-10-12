import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TableInlineAddRow } from '@/features/projects/project-id/work-items/components/views/TableView';

describe('Work Items Bottom Add Row (Official Plane Parity)', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders TableInlineAddRow pinned at bottom with full width and Plane styling', () => {
    const handleAddCard = vi.fn();
    const { container } = render(
      <TableInlineAddRow
        targetColumnId="backlog"
        titleWidth={360}
        onAddCard={handleAddCard}
      />
    );

    const row = container.querySelector('[role="row"]');
    expect(row).toBeTruthy();
    expect(row?.className).toContain('sticky');
    expect(row?.className).toContain('bottom-0');
    expect(row?.className).toContain('w-full');
    expect(row?.className).toContain('border-t');

    // Contains "New work item"
    expect(screen.getByText('New work item')).toBeTruthy();
  });

  it('clicking anywhere on TableInlineAddRow expands inline input', () => {
    const handleAddCard = vi.fn();
    const { container } = render(
      <TableInlineAddRow
        targetColumnId="backlog"
        titleWidth={360}
        onAddCard={handleAddCard}
      />
    );

    const row = container.querySelector('[role="row"]');
    expect(row).toBeTruthy();
    fireEvent.click(row!);

    // Input is displayed
    const input = screen.getByPlaceholderText(/What needs to be done\?/i);
    expect(input).toBeTruthy();
  });

  it('submitting title in TableInlineAddRow calls onAddCard with trimmed title', () => {
    const handleAddCard = vi.fn();
    render(
      <TableInlineAddRow
        targetColumnId="backlog"
        titleWidth={360}
        onAddCard={handleAddCard}
      />
    );

    // Expand
    fireEvent.click(screen.getByText('New work item'));

    const input = screen.getByPlaceholderText(/What needs to be done\?/i);
    fireEvent.change(input, { target: { value: 'Fix issue with search' } });

    const addButton = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addButton);

    expect(handleAddCard).toHaveBeenCalledWith('backlog', 'Fix issue with search');
  });

  it('pressing Escape cancels inline adding in TableInlineAddRow', () => {
    const handleAddCard = vi.fn();
    render(
      <TableInlineAddRow
        targetColumnId="backlog"
        titleWidth={360}
        onAddCard={handleAddCard}
      />
    );

    // Expand
    fireEvent.click(screen.getByText('New work item'));
    const input = screen.getByPlaceholderText(/What needs to be done\?/i);
    fireEvent.change(input, { target: { value: 'Temporary text' } });

    // Press Escape
    fireEvent.keyDown(input, { key: 'Escape' });

    // Returns to unexpanded button row
    expect(screen.getByText('New work item')).toBeTruthy();
    expect(screen.queryByPlaceholderText(/What needs to be done\?/i)).toBeNull();
  });
});
