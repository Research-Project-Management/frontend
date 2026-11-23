import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { fluxTransport } from '@/features/ai/transport/flux';
import type { RevertibleTurnWidget } from '@/features/ai/types/message';
import { WidgetsPart } from '@/features/ai/ui/parts/WidgetsPart';

function buildWidget(): RevertibleTurnWidget {
  return {
    type: 'revertible_turn',
    title: 'Undo AI changes',
    data: {
      traceId: 'tr-1',
      spaceId: 'sp-1',
      count: 2,
      items: [
        { tool: 'create_work_item', entity_id: 'wi-1', label: 'Task 1' },
        { tool: 'create_page', entity_id: 'pg-1', label: 'Draft Page' },
      ],
    },
  };
}

describe('RevertControl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('previews items, supports selective undo, and completes full revert', async () => {
    const revertSpy = vi
      .spyOn(fluxTransport, 'revertTurn')
      .mockResolvedValueOnce({
        trace_id: 'tr-1',
        space_id: 'sp-1',
        reverted_count: 1,
        results: [
          {
            tool: 'create_page',
            entity_id: 'pg-1',
            label: 'Draft Page',
            status: 'reverted',
          },
        ],
      })
      .mockResolvedValueOnce({
        trace_id: 'tr-1',
        space_id: 'sp-1',
        reverted_count: 1,
        results: [
          {
            tool: 'create_work_item',
            entity_id: 'wi-1',
            label: 'Task 1',
            status: 'reverted',
          },
        ],
      });

    render(<WidgetsPart widgets={[buildWidget()]} />);

    expect(screen.getByRole('button', { name: 'Undo (2)' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Preview changes' }));
    expect(screen.getByText('Task 1')).toBeTruthy();
    expect(screen.getByText('Draft Page')).toBeTruthy();

    // Uncheck Task 1 and revert only Draft Page
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    fireEvent.click(
      screen.getByRole('button', { name: 'Undo selected (1)' }),
    );

    await waitFor(() => {
      expect(revertSpy).toHaveBeenCalledWith('tr-1', 'sp-1', ['pg-1']);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Undo (1)' })).toBeTruthy();
      expect(screen.getByText('(1 reverted)')).toBeTruthy();
    });

    // Revert the remaining item
    fireEvent.click(screen.getByRole('button', { name: 'Undo (1)' }));

    await waitFor(() => {
      expect(revertSpy).toHaveBeenCalledWith('tr-1', 'sp-1', ['wi-1']);
    });

    await waitFor(() => {
      expect(screen.getByText('Reverted 2')).toBeTruthy();
    });
  });

  it('runs one-click full turn undo without passing selective subset', async () => {
    const revertSpy = vi
      .spyOn(fluxTransport, 'revertTurn')
      .mockResolvedValueOnce({
        trace_id: 'tr-1',
        space_id: 'sp-1',
        reverted_count: 2,
        results: [
          {
            tool: 'create_page',
            entity_id: 'pg-1',
            label: 'Draft Page',
            status: 'reverted',
          },
          {
            tool: 'create_work_item',
            entity_id: 'wi-1',
            label: 'Task 1',
            status: 'reverted',
          },
        ],
      });

    render(<WidgetsPart widgets={[buildWidget()]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Undo (2)' }));

    await waitFor(() => {
      expect(revertSpy).toHaveBeenCalledWith('tr-1', 'sp-1', undefined);
    });

    await waitFor(() => {
      expect(screen.getByText('Reverted 2')).toBeTruthy();
    });
  });
});
