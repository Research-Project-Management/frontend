import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import {
  VisualSlashCommandMenu,
  SLASH_COMMANDS,
  type SlashCommandItem,
} from '@/features/editor/ui/features/editor/VisualSlashCommandMenu';
import { VisualEditorView } from '@/features/editor/ui/features/editor/VisualEditorView';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

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
    render(
      <VisualSlashCommandMenu {...defaultProps} onSelect={handleSelect} />
    );

    const tableItem = screen.getByRole('menuitem', { name: /Table/i });
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

describe('VisualEditorView Slash Command Integration', () => {
  beforeEach(() => {
    document.execCommand = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('opens slash command menu when typing "/" in the document surface', async () => {
    const { container } = render(
      <VisualEditorView
        filePath="main.tex"
        value="\section{Introduction}\nText here."
        onChange={vi.fn()}
      />
    );

    const surface = container.querySelector('.visual-editor-surface') as HTMLElement;
    expect(surface).toBeInTheDocument();

    // Trigger slash key
    fireEvent.keyDown(surface, { key: '/' });

    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /Slash Commands/i })).toBeInTheDocument();
    });
  });

  it('navigates with ArrowDown / ArrowUp and selects item with Enter', async () => {
    const handleChange = vi.fn();
    const { container } = render(
      <VisualEditorView
        filePath="main.tex"
        value="\section{Introduction}\n"
        onChange={handleChange}
      />
    );

    const surface = container.querySelector('.visual-editor-surface') as HTMLElement;

    // Open slash menu
    fireEvent.keyDown(surface, { key: '/' });
    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /Slash Commands/i })).toBeInTheDocument();
    });

    // Arrow down to second command (Subsection)
    fireEvent.keyDown(surface, { key: 'ArrowDown' });

    // Press Enter to execute Subsection command
    fireEvent.keyDown(surface, { key: 'Enter' });

    // formatBlock to h2 should be called
    expect(document.execCommand).toHaveBeenCalledWith('formatBlock', false, 'h2');

    // Menu should close
    expect(screen.queryByRole('menu', { name: /Slash Commands/i })).toBeNull();
  });

  it('closes slash menu on Escape key', async () => {
    const { container } = render(
      <VisualEditorView
        filePath="main.tex"
        value="\section{Introduction}\n"
        onChange={vi.fn()}
      />
    );

    const surface = container.querySelector('.visual-editor-surface') as HTMLElement;

    fireEvent.keyDown(surface, { key: '/' });
    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /Slash Commands/i })).toBeInTheDocument();
    });

    fireEvent.keyDown(surface, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: /Slash Commands/i })).toBeNull();
  });

  it('inserts 3x3 table when selecting Table from slash menu', async () => {
    const { container } = render(
      <VisualEditorView
        filePath="main.tex"
        value="\section{Introduction}\n"
        onChange={vi.fn()}
      />
    );

    const surface = container.querySelector('.visual-editor-surface') as HTMLElement;

    fireEvent.keyDown(surface, { key: '/' });
    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /Slash Commands/i })).toBeInTheDocument();
    });

    // Click Table menuitem
    const tableItem = screen.getByRole('menuitem', { name: /Table/i });
    fireEvent.click(tableItem);

    // insertHTML called with <table> HTML
    expect(document.execCommand).toHaveBeenCalledWith(
      'insertHTML',
      false,
      expect.stringContaining('<table')
    );
  });

  it('dispatches citation-picker dialog when selecting Citation from slash menu', async () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    const { container } = render(
      <VisualEditorView
        filePath="main.tex"
        value="\section{Introduction}\n"
        onChange={vi.fn()}
      />
    );

    const surface = container.querySelector('.visual-editor-surface') as HTMLElement;

    fireEvent.keyDown(surface, { key: '/' });
    await waitFor(() => {
      expect(screen.getByRole('menu', { name: /Slash Commands/i })).toBeInTheDocument();
    });

    const citeItem = document.querySelector('[data-command-id="citation"]') as HTMLElement;
    expect(citeItem).toBeTruthy();
    fireEvent.click(citeItem);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'dialog:open',
      dialog: 'citation-picker',
    });
  });
});
