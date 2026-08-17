import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityFeedItem } from '@/features/workspaces/projects/your-work/components/shared/ActivityFeedItem';

describe('ActivityFeedItem', () => {
  it('renders activity event information and resolves project from map', () => {
    const onTaskClick = vi.fn();
    const activity = {
      id: 'act-1',
      type: 'task_created',
      actorName: 'Bob',
      actionVerb: 'created task',
      targetIdentifier: 'TSK-99',
      targetTitle: 'Setup CI/CD Pipeline',
      time: new Date().toISOString(),
      itemId: 'task-99',
      project: { id: 'p-1', name: 'DevOps' },
    };

    render(
      <ActivityFeedItem
        activity={activity}
        onTaskClick={onTaskClick}
      />,
    );

    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('created task')).toBeInTheDocument();
    expect(screen.getByText('TSK-99')).toBeInTheDocument();
    expect(screen.getByText('Setup CI/CD Pipeline')).toBeInTheDocument();
    expect(screen.getByText('DevOps')).toBeInTheDocument();

    // Click item
    fireEvent.click(screen.getByText('Setup CI/CD Pipeline'));
    expect(onTaskClick).toHaveBeenCalledWith('task-99');
  });

  it('handles keyboard navigation (Enter key)', () => {
    const onTaskClick = vi.fn();
    const activity = {
      type: 'task_updated',
      itemId: 'task-100',
      targetTitle: 'Accessible Task',
    };

    render(
      <ActivityFeedItem
        activity={activity}
        onTaskClick={onTaskClick}
      />,
    );

    const item = screen.getByRole('button');
    fireEvent.keyDown(item, { key: 'Enter', code: 'Enter' });
    expect(onTaskClick).toHaveBeenCalledWith('task-100');
  });
});
