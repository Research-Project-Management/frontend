import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { YourWorkTaskList } from '@/features/workspaces/projects/your-work/components/shared/YourWorkTaskList';

describe('YourWorkTaskList', () => {
  it('renders empty message when no tasks are provided', () => {
    render(
      <YourWorkTaskList
        title="Assigned Tasks"
        tasks={[]}
        emptyMessage="No tasks assigned."
        onTaskClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Assigned Tasks')).toBeInTheDocument();
    expect(screen.getByText('No tasks assigned.')).toBeInTheDocument();
  });

  it('renders categorized task groups and items with project badges', () => {
    const onTaskClick = vi.fn();
    const tasks = [
      {
        id: 'task-1',
        identifier: 'TSK-1',
        title: 'Fix Navigation Bar Bug',
        columnId: 'todo',
        priority: 'high' as const,
        projectId: 'proj-1',
        commentCount: 2,
        subtaskCount: 3,
        subtaskCompletedCount: 1,
      },
      {
        id: 'task-2',
        identifier: 'TSK-2',
        title: 'Complete Documentation',
        columnId: 'done',
        priority: 'low' as const,
        projectId: 'proj-2',
      },
    ];

    const projectMap = {
      'proj-1': { id: 'proj-1', name: 'Frontend Project' },
      'proj-2': { id: 'proj-2', name: 'Backend Docs' },
    };

    render(
      <YourWorkTaskList
        title="My Tasks"
        tasks={tasks}
        taskProjectMap={projectMap}
        onTaskClick={onTaskClick}
      />,
    );

    // Group headers
    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();

    // Task content
    expect(screen.getByText('TSK-1')).toBeInTheDocument();
    expect(screen.getByText('Fix Navigation Bar Bug')).toBeInTheDocument();
    expect(screen.getByText('Frontend Project')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('1/3')).toBeInTheDocument();

    // Click task
    fireEvent.click(screen.getByText('Fix Navigation Bar Bug'));
    expect(onTaskClick).toHaveBeenCalledWith('task-1');
  });

  it('toggles group collapse on click and keyboard Enter', () => {
    const tasks = [
      {
        id: 'task-1',
        title: 'First Task',
        columnId: 'doing',
      },
    ];

    render(
      <YourWorkTaskList
        title="Doing Tasks"
        tasks={tasks}
        onTaskClick={vi.fn()}
      />,
    );

    const groupHeader = screen.getByRole('button', { name: /Doing/i });
    expect(groupHeader).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('First Task')).toBeVisible();

    // Toggle collapse
    fireEvent.click(groupHeader);
    expect(groupHeader).toHaveAttribute('aria-expanded', 'false');

    // Toggle back with keyboard Enter
    fireEvent.keyDown(groupHeader, { key: 'Enter', code: 'Enter' });
    expect(groupHeader).toHaveAttribute('aria-expanded', 'true');
  });
});
