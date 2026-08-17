import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TopBar from '@/features/workspaces/projects/stickies/components/layout/TopBar';

vi.mock('next/navigation', () => ({
  useParams: () => ({ workspaceId: 'ws-123' }),
}));

vi.mock('@/features/workspaces/projects/shell/hooks/use-project', () => ({
  useWorkspaceProjects: () => ({
    projects: [
      { _id: 'proj-1', name: 'Project Alpha' },
      { _id: 'proj-2', name: 'Project Beta' },
    ],
  }),
}));

describe('TopBar', () => {
  it('renders topbar title and action buttons', () => {
    const onAddSticky = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <TopBar
        searchQuery=""
        onSearchChange={onSearchChange}
        onAddSticky={onAddSticky}
        isAddingSticky={false}
        addLabel="Add Note"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Stickies' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Note/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Add Note/i }));
    expect(onAddSticky).toHaveBeenCalledTimes(1);
  });

  it('handles search input and clear button with accessible labels', () => {
    const onSearchChange = vi.fn();

    render(
      <TopBar
        searchQuery="Research"
        onSearchChange={onSearchChange}
        onAddSticky={vi.fn()}
        isAddingSticky={false}
      />,
    );

    const input = screen.getByPlaceholderText(/Search by title/i);
    expect(input).toHaveValue('Research');

    const clearButton = screen.getByRole('button', { name: 'Clear search' });
    expect(clearButton).toBeInTheDocument();

    fireEvent.click(clearButton);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
});
