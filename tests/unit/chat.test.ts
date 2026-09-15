import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamChatResponse } from '@/features/ai/services/chat.service';

describe('Chat Service & Streaming Response Parser', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createMockSseResponse(chunks: string[], status = 200) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    return {
      ok: status >= 200 && status < 300,
      status,
      body: stream,
    };
  }

  it('should stream chunks, extract metadata, and handle [DONE] signal cleanly', async () => {
    const ssePayload = [
      'data: [META]{"chatId":"chat-uuid-123","title":"Quantum Computing"}\n\n',
      'data: Quantum computing uses qubits.\n\n',
      'data: [ACTION]{"action":"suggest_citations","count":2}\n\n',
      'data: Superposition enables parallelism.\n\n',
      'data: [DONE]\n\n',
    ];

    global.fetch = vi.fn().mockResolvedValue(createMockSseResponse(ssePayload));

    const onMeta = vi.fn();
    const onAction = vi.fn();
    const yieldedChunks: string[] = [];

    const generator = streamChatResponse(
      [{ role: 'user', content: 'What is quantum computing?' }],
      { onMeta, onAction },
    );

    for await (const chunk of generator) {
      yieldedChunks.push(chunk);
    }

    expect(onMeta).toHaveBeenCalledWith(
      expect.objectContaining({
        chatId: 'chat-uuid-123',
        title: 'Quantum Computing',
      }),
    );
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'suggest_citations',
        count: 2,
      }),
    );

    expect(yieldedChunks).toEqual([
      'Quantum computing uses qubits.',
      'Superposition enables parallelism.',
    ]);
    expect(yieldedChunks).not.toContain('[DONE]');
  });

  it('should throw an error when API returns non-200 status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
    });

    const generator = streamChatResponse([
      { role: 'user', content: '   ' },
    ]);

    await expect(async () => {
      for await (const _ of generator) {
        // Should throw
      }
    }).rejects.toThrow('AI request failed: 422');
  });

  it('should throw an error if response body is null', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    });

    const generator = streamChatResponse([
      { role: 'user', content: 'Hello' },
    ]);

    await expect(async () => {
      for await (const _ of generator) {
        // Should throw
      }
    }).rejects.toThrow('No response body');
  });
});
