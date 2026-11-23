import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import * as sharedApi from '@/shared/lib/api';
import {
  AI_SELECTED_MODEL_KEY,
  fluxTransport,
  setStoredModelId,
} from '@/features/ai/transport/flux';
import { ModelSelector } from '@/features/ai/ui/composer/ModelSelector';

function renderSelector() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ModelSelector />
    </QueryClientProvider>,
  );
}

describe('ModelSelector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    setStoredModelId('auto');
  });

  afterEach(() => {
    cleanup();
  });

  it('loads catalog options, persists chosen model, and attaches context.model_id on stream', async () => {
    const listSpy = vi.spyOn(fluxTransport, 'listModels').mockResolvedValueOnce([
      {
        id: 'auto',
        label: 'Auto (Tối ưu)',
        provider: 'Flux Gateway',
        tier: 'auto',
        description: 'Tự động chọn model tối ưu theo từng bước',
        is_default: true,
      },
      {
        id: 'deepseek-v3.2',
        label: 'DeepSeek V3.2',
        provider: 'DeepSeek',
        tier: 'balanced',
        description: 'Gọi tool chính xác, tiết kiệm chi phí',
        is_default: false,
      },
    ]);

    renderSelector();

    await waitFor(() => {
      expect(listSpy).toHaveBeenCalledTimes(1);
    });

    const trigger = screen.getByRole('button', { name: 'Select AI model' });
    expect(trigger.textContent).toContain('Auto');

    fireEvent.pointerDown(trigger);
    const option = await screen.findByText('DeepSeek V3.2');
    fireEvent.click(option);

    await waitFor(() => {
      expect(trigger.textContent).toContain('DeepSeek V3.2');
      expect(window.localStorage.getItem(AI_SELECTED_MODEL_KEY)).toBe(
        'deepseek-v3.2',
      );
    });

    const fakeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const fetchSpy = vi
      .spyOn(sharedApi, 'apiRawFetch')
      .mockResolvedValue(new Response(fakeStream, { status: 200 }));

    await fluxTransport.stream({
      messages: [{ role: 'user', content: 'Hello' }],
      context: { mode: 'chat', spaceId: 'sp-1' },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ai/chat',
      'POST',
      expect.objectContaining({
        context: { model_id: 'deepseek-v3.2' },
      }),
      expect.any(Object),
    );

    // Switching back to auto omits model_id
    setStoredModelId('auto');
    await fluxTransport.stream({
      messages: [{ role: 'user', content: 'Auto again' }],
      context: { mode: 'chat', spaceId: 'sp-1' },
    });

    expect(fetchSpy).toHaveBeenLastCalledWith(
      '/api/ai/chat',
      'POST',
      expect.objectContaining({
        context: undefined,
      }),
      expect.any(Object),
    );
  });
});
