import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  streamChatResponse,
  listChatSessions,
  createChatSession,
} from '@/features/workspaces/ai/services/chat.service';

describe('chat.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('streamChatResponse', () => {
    it('parses text stream, [META], and [ACTION] SSE events correctly', async () => {
      const mockSSEChunks = [
        'data: [META]{"agent":"web_search","intent":"academic"}\n\n',
        'data: [ACTION]{"type":"thinking"}\n\n',
        'data: Hello\n\n',
        'data:  world!\n\n',
        'data: [DONE]\n\n',
      ];

      const encoder = new TextEncoder();
      let index = 0;

      const mockStream = new ReadableStream({
        pull(controller) {
          if (index < mockSSEChunks.length) {
            controller.enqueue(encoder.encode(mockSSEChunks[index]));
            index++;
          } else {
            controller.close();
          }
        },
      });

      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        body: mockStream,
      } as Response);

      const metaCallback = vi.fn();
      const actionCallback = vi.fn();
      const collectedChunks: string[] = [];

      for await (const chunk of streamChatResponse(
        [{ role: 'user', content: 'Hi' }],
        {
          onMeta: metaCallback,
          onAction: actionCallback,
        },
      )) {
        collectedChunks.push(chunk);
      }

      expect(metaCallback).toHaveBeenCalledWith({
        agent: 'web_search',
        intent: 'academic',
      });
      expect(actionCallback).toHaveBeenCalledWith({
        type: 'thinking',
      });
      expect(collectedChunks.join('')).toBe('Hello world!');
    });
  });

  describe('listChatSessions', () => {
    it('fetches sessions with workspaceId parameter', async () => {
      const mockChats = [
        {
          id: 'chat-1',
          title: 'Quantum Computing',
          projectId: null,
          messageCount: 2,
          lastMessage: 'Summary of findings',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        },
      ];

      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chats: mockChats }),
      } as Response);

      const result = await listChatSessions('ws-123');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('workspaceId=ws-123'),
        expect.anything(),
      );
      expect(result).toEqual(mockChats);
    });
  });
});
