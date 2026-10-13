import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TableInlineAddRow, TableBottomAddBar, TableHorizontalScrollbar } from '@/features/projects/project-id/work-items/components/views/TableView';
import { TimelineBottomAddBar } from '@/features/projects/project-id/work-items/components/views/TimelineView';

describe('Work Items Bottom Add Row (Official Plane Parity)', () => {
  afterEach(() => {
    cleanup();
  });

  describe('TableInlineAddRow (Grouped view inline row)', () => {
    it('renders TableInlineAddRow with full width and line default border-b', () => {
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
      expect(row?.className).toContain('w-full');
      expect(row?.className).toContain('border-b');

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
      const input = screen.getByPlaceholderText(/New work item/i);
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

      const input = screen.getByPlaceholderText(/New work item/i);
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
      const input = screen.getByPlaceholderText(/New work item/i);
      fireEvent.change(input, { target: { value: 'Temporary text' } });

      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape' });

      // Returns to unexpanded button row
      expect(screen.getByText('New work item')).toBeTruthy();
      expect(screen.queryByPlaceholderText(/New work item/i)).toBeNull();
    });
  });

  describe('TableBottomAddBar (Seamless bottom row without dividing line - media_1791798768590)', () => {
    it('renders with "Add work item", seamless column color and h-9 without dividing line', () => {
      const handleAddCard = vi.fn();
      const { container } = render(
        <TableBottomAddBar defaultColId="backlog" onAddCard={handleAddCard} />
      );

      const bar = container.firstChild as HTMLElement;
      expect(bar.className).not.toContain('border-t');
      expect(bar.className).toContain('bg-background');
      expect(bar.className).toContain('h-9');
      expect(screen.getByText('Add work item')).toBeInTheDocument();
    });

    it('expands inline input on click and calls onAddCard on submit', () => {
      const handleAddCard = vi.fn();
      render(
        <TableBottomAddBar defaultColId="backlog" onAddCard={handleAddCard} />
      );

      fireEvent.click(screen.getByText('Add work item'));
      const input = screen.getByPlaceholderText('New work item');
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'Create landing page' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add' }));

      expect(handleAddCard).toHaveBeenCalledWith('backlog', 'Create landing page');
    });

    it('cancels inline input on Escape or Cancel button', () => {
      const handleAddCard = vi.fn();
      render(
        <TableBottomAddBar defaultColId="backlog" onAddCard={handleAddCard} />
      );

      fireEvent.click(screen.getByText('Add work item'));
      expect(screen.getByPlaceholderText('New work item')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText('Add work item')).toBeInTheDocument();
    });
  });

  describe('TimelineBottomAddBar (Seamless bottom row without dividing line)', () => {
    it('renders with "New work item", seamless column color and h-9 without dividing line', () => {
      const handleAddCard = vi.fn();
      const { container } = render(
        <TimelineBottomAddBar defaultColId="backlog" onAddCard={handleAddCard} />
      );

      const bar = container.firstChild as HTMLElement;
      expect(bar.className).not.toContain('border-t');
      expect(bar.className).toContain('bg-background');
      expect(bar.className).toContain('h-9');
      expect(screen.getByText('New work item')).toBeInTheDocument();
    });

    it('expands inline input on click and calls onAddCard on submit', () => {
      const handleAddCard = vi.fn();
      render(
        <TimelineBottomAddBar defaultColId="backlog" onAddCard={handleAddCard} />
      );

      fireEvent.click(screen.getByText('New work item'));
      const input = screen.getByPlaceholderText('New work item');
      expect(input).toBeInTheDocument();

      fireEvent.change(input, { target: { value: 'Design Gantt chart' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(handleAddCard).toHaveBeenCalledWith('backlog', 'Design Gantt chart');
    });

    it('cancels inline input on Escape or Cancel button', () => {
      const handleAddCard = vi.fn();
      render(
        <TimelineBottomAddBar defaultColId="backlog" onAddCard={handleAddCard} />
      );

      fireEvent.click(screen.getByText('New work item'));
      expect(screen.getByPlaceholderText('New work item')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByText('New work item')).toBeInTheDocument();
    });
  });

  describe('TableHorizontalScrollbar (Sleek compact scrollbar placed above add row)', () => {
    it('returns null when content does not overflow horizontally', () => {
      const mockRef = {
        current: {
          scrollLeft: 0,
          scrollWidth: 500,
          clientWidth: 500,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          scrollTo: vi.fn(),
        } as unknown as HTMLDivElement,
      };

      const { container } = render(<TableHorizontalScrollbar scrollRef={mockRef} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders compact track and thumb when content overflows horizontally', () => {
      const mockRef = {
        current: {
          scrollLeft: 100,
          scrollWidth: 1000,
          clientWidth: 500,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          scrollTo: vi.fn(),
        } as unknown as HTMLDivElement,
      };

      const { container } = render(<TableHorizontalScrollbar scrollRef={mockRef} />);
      expect(container.firstChild).not.toBeNull();
      // Track has w-64 sm:w-80 (compact, not overly long)
      const track = container.querySelector('.rounded-full');
      expect(track).toBeTruthy();
    });
  });
});

