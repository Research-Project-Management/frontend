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
import { RewindMenu } from '@/features/ai/ui/parts/RewindMenu';

describe('RewindMenu', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

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

    // Duplicate message_count=4 entries are collapsed to one item
    expect(screen.getAllByText('Create 5 tasks')).toHaveLength(1);
    expect(screen.getByText('Summarize this paper')).toBeTruthy();

    fireEvent.click(screen.getByText('Summarize this paper'));

    await waitFor(() => {
      expect(rewindSpy).toHaveBeenCalledWith('chat-1', 'ckpt-2', 'sp-1');
      expect(onRewound).toHaveBeenCalledWith(2);
    });
  });
});
