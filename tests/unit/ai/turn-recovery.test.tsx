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
import { RewindMenu } from '@/features/ai/ui/parts/RewindMenu';

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

describe('AI Turn Recovery (RevertControl & RewindMenu)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('RevertControl', () => {
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

  describe('RewindMenu', () => {
    it('loads checkpoints, deduplicates by turn message count, and rewinds to selected checkpoint', async () => {
      const listSpy = vi
        .spyOn(fluxTransport, 'listCheckpoints')
        .mockResolvedValueOnce({
          chat_id: 'chat-1',
          space_id: 'sp-1',
          checkpoints: [
            {
              checkpoint_id: 'ckpt-4b',
              message_count: 4,
              route: 'project_agent',
              preview: 'Create 5 tasks',
            },
            {
              checkpoint_id: 'ckpt-4a',
              message_count: 4,
              route: 'supervisor',
              preview: 'Create 5 tasks',
            },
            {
              checkpoint_id: 'ckpt-2',
              message_count: 2,
              route: 'direct',
              preview: 'Summarize this paper',
            },
          ],
        });

      const rewindSpy = vi
        .spyOn(fluxTransport, 'rewindThread')
        .mockResolvedValueOnce({
          chat_id: 'chat-1',
          space_id: 'sp-1',
          target_checkpoint_id: 'ckpt-2',
          new_checkpoint_id: 'ckpt-new',
          message_count: 2,
          reverted_count: 0,
          revert_results: [],
        });

      const onRewound = vi.fn();

      render(
        <RewindMenu
          chatId="chat-1"
          spaceId="sp-1"
          onRewound={onRewound}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'Rewind conversation' }),
      );

      await waitFor(() => {
        expect(listSpy).toHaveBeenCalledWith('chat-1', 'sp-1', 20);
      });

      expect(screen.getAllByText('Create 5 tasks')).toHaveLength(1);
      expect(screen.getByText('Summarize this paper')).toBeTruthy();

      fireEvent.click(screen.getByText('Summarize this paper'));

      await waitFor(() => {
        expect(rewindSpy).toHaveBeenCalledWith('chat-1', 'ckpt-2', 'sp-1');
        expect(onRewound).toHaveBeenCalledWith(2);
      });
    });
  });
});
