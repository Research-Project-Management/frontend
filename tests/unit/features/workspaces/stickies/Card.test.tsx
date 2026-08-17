import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Card from '@/features/workspaces/projects/stickies/components/card/Card';
import type { Sticky } from '@/features/workspaces/projects/stickies/types/sticky.types';

describe('Card', () => {
  const mockSticky: Sticky = {
    _id: 's-123',
    id: 's-123',
    title: 'Initial Title',
    content: '<p>Sticky body content</p>',
    color: 'yellow-1',
    createdAt: '2026-08-17T00:00:00.000Z',
    updatedAt: '2026-08-17T00:00:00.000Z',
  };

  it('renders sticky title input and accessible drag handle', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();

    render(
      <Card
        sticky={mockSticky}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    const titleInput = screen.getByLabelText('Sticky title');
    expect(titleInput).toHaveValue('Initial Title');

    const dragHandle = screen.getByLabelText('Drag to move sticky');
    expect(dragHandle).toHaveAttribute('aria-roledescription', 'draggable card handle');
  });

  it('updates title on blur if changed', () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();

    render(
      <Card
        sticky={mockSticky}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    const titleInput = screen.getByLabelText('Sticky title');
    fireEvent.change(titleInput, { target: { value: 'Updated Note Title' } });
    fireEvent.blur(titleInput);

    expect(onUpdate).toHaveBeenCalledWith('s-123', { title: 'Updated Note Title' });
  });
});
