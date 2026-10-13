import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import {
  VisualSlashCommandMenu,
  SLASH_COMMANDS,
  type SlashCommandItem,
} from '@/features/editor/ui/editor/visual/toolbars/VisualSlashCommandMenu';

describe('VisualSlashCommandMenu Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    query: '',
    position: { top: 100, left: 150 },
    selectedIndex: 0,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onHoverIndex: vi.fn(),
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <VisualSlashCommandMenu {...defaultProps} isOpen={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders full command list when query is empty', () => {
    render(<VisualSlashCommandMenu {...defaultProps} />);

    expect(screen.getByRole('menu', { name: /Slash Commands/i })).toBeInTheDocument();
    expect(screen.getByText('Section')).toBeInTheDocument();
    expect(screen.getByText('Subsection')).toBeInTheDocument();
    expect(screen.getByText('Inline Formula')).toBeInTheDocument();
    expect(screen.getByText('Display Equation')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.getByText('Figure with Caption')).toBeInTheDocument();
    expect(screen.getByText('Citation')).toBeInTheDocument();
  });

  it('filters commands by query string', () => {
    const { rerender } = render(
      <VisualSlashCommandMenu {...defaultProps} query="sec" />
    );

    expect(screen.getByText('Section')).toBeInTheDocument();
    expect(screen.getByText('Subsection')).toBeInTheDocument();
    expect(screen.getByText('Subsubsection')).toBeInTheDocument();
    expect(screen.queryByText('Table')).toBeNull();

    // Change query to table
    rerender(<VisualSlashCommandMenu {...defaultProps} query="table" />);
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.queryByText('Section')).toBeNull();

    // Change query to cite
    rerender(<VisualSlashCommandMenu {...defaultProps} query="cite" />);
    expect(screen.getByText('Citation')).toBeInTheDocument();
    expect(screen.queryByText('Table')).toBeNull();
  });

  it('calls onSelect when an item is clicked', () => {
    const handleSelect = vi.fn();
    const { container } = render(
      <VisualSlashCommandMenu {...defaultProps} onSelect={handleSelect} />
    );

    const tableItem = container.querySelector('button[data-command-id="table"]') as HTMLElement;
    expect(tableItem).toBeInTheDocument();
    fireEvent.click(tableItem);

    expect(handleSelect).toHaveBeenCalledTimes(1);
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'table', title: 'Table' })
    );
  });

  it('calls onHoverIndex when mouse enters a menu item', () => {
    const handleHover = vi.fn();
    render(
      <VisualSlashCommandMenu {...defaultProps} onHoverIndex={handleHover} />
    );

    const items = screen.getAllByRole('menuitem');
    fireEvent.mouseEnter(items[1]);

    expect(handleHover).toHaveBeenCalledWith(1);
  });
});
