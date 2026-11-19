import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  decodeFluxSseFrame,
  SseFrameParser,
  ThinkTagSplitter,
} from '@/features/ai/transport/sse';
import { FluxHttpTransport } from '@/features/ai/transport/flux';
import { createVercelThreadEngine } from '@/features/ai/engine/vercel';
import { ThreadPool } from '@/features/ai/engine/pool';
import { mapStoredMessagesToFlux } from '@/features/ai/engine/history';
import type { AiTransportPort } from '@/features/ai/transport/transport.port';
import type { AiStreamEvent } from '@/features/ai/types/event';

function createMockSseResponse(
  chunks: string[],
  status = 200,
  headers?: Record<string, string>,
) {
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
    headers: new Headers(headers),
    body: stream,
  };
}

describe('AI SSE Protocol, Transport, VercelThreadEngine & ThreadPool', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('1. SSE Frame Parser, Action Decoding & ThinkTagSplitter', () => {
    it('parses split SSE chunks, [META], [ACTION], HITL interrupt, error events, and [DONE]', () => {
      const parser = new SseFrameParser();
      const enc = new TextEncoder();

      const part1 = enc.encode(
        'data: [META]{"chatId":"chat-123","title":"Quantum","agent":"rag_agent"}\n\n' +
          'data: [ACTION]{"type":"tool_start","tool":"search_documents"}\n\n' +
          'event: er',
      );
      const part2 = enc.encode(
        'ror\ndata: {"error":"Upstream rate limited"}\n\n' +
          'data: [ACTION]{"type":"tool_call","needs_confirm":true,"input":{"interrupts":[{"id":"int-1","tool":"create_work_item","description":"Create high priority task"}]}}\n\n' +
          'data: [DONE]\n\n',
      );

      const frames = [...parser.feed(part1), ...parser.feed(part2), ...parser.flush()];
      const events = frames.flatMap((f) => decodeFluxSseFrame(f.event, f.data));

      expect(events[0]).toEqual({
        type: 'meta',
        chatId: 'chat-123',
        title: 'Quantum',
        agent: 'rag_agent',
        intent: undefined,
        sources: undefined,
      });
      expect(events[1]).toEqual({
        type: 'tool-start',
        tool: 'search_documents',
        agent: undefined,
        input: undefined,
      });
      expect(events[2]).toEqual({
        type: 'error',
        message: 'Upstream rate limited',
      });
      expect(events[3]).toMatchObject({
        type: 'hitl-interrupt',
        interruptId: 'int-1',
        interrupts: [
          {
            id: 'int-1',
            tool: 'create_work_item',
            description: 'Create high priority task',
          },
        ],
      });
      expect(events[4]).toEqual({ type: 'done' });
    });

    it('unescapes literal newlines and splits <think>...</think> across chunk boundaries', () => {
      const textEvents = decodeFluxSseFrame(
        'message',
        '{"delta":"Line 1\\n\\nLine 2"}',
      );
      expect(textEvents).toEqual([
        { type: 'text-delta', delta: 'Line 1\n\nLine 2' },
      ]);

      const splitter = new ThinkTagSplitter();
      const out = [
        ...splitter.feed('Intro <th'),
        ...splitter.feed('ink>Step 1'),
        ...splitter.feed(' Step 2</thi'),
        ...splitter.feed('nk>\nFinal answer'),
        ...splitter.flush(),
      ];

      const reasoning = out
        .filter((e) => e.type === 'reasoning-delta')
        .map((e) => e.delta)
        .join('');
      const answer = out
        .filter((e) => e.type === 'text-delta')
        .map((e) => e.delta)
        .join('');

      expect(reasoning).toBe('Step 1 Step 2');
      expect(answer).toBe('Intro Final answer');
    });
  });

  describe('2. FluxHttpTransport Routing, Headers, Resume & Cancel', () => {
    it('routes chat/editor/paper modes, captures X-Chat-Id header, and streams events', async () => {
      const transport = new FluxHttpTransport();
      const fetchMock = vi.fn().mockResolvedValue(
        createMockSseResponse(
          [
            'data: {"delta":"Quantum qubits"}\n\n',
            'data: [META]{"agent":"rag_agent"}\n\n',
            'data: [DONE]\n\n',
          ],
          200,
          { 'x-chat-id': 'hdr-chat-9' },
        ),
      );
      global.fetch = fetchMock;

      const result = await transport.stream({
        messages: [{ role: 'user', content: 'Explain qubits' }],
        context: {
          mode: 'paper',
          spaceId: 'sp-1',
          paper: { paperId: 'paper-7' },
        },
      });

      expect(result.chatIdHeader).toBe('hdr-chat-9');
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/papers/paper-7/chat'),
        expect.objectContaining({ method: 'POST' }),
      );

      const events: AiStreamEvent[] = [];
      for await (const ev of result.events) {
        events.push(ev);
      }
      expect(events.map((e) => e.type)).toEqual(['text-delta', 'meta', 'done']);
    });

    it('sends POST /api/ai/chat/resume and POST /api/ai/chat/:id/cancel and throws on non-200 or null body', async () => {
      const transport = new FluxHttpTransport();

      const resumeMock = vi.fn().mockResolvedValue(
        createMockSseResponse(['data: {"delta":"Resumed ok"}\n\ndata: [DONE]\n\n']),
      );
      global.fetch = resumeMock;
      const resumed = await transport.resume({
        chatId: 'c-1',
        spaceId: 'sp-1',
        decision: { decisions: [{ type: 'approve' }] },
      });
      const resumedEvents: AiStreamEvent[] = [];
      for await (const ev of resumed.events) resumedEvents.push(ev);
      expect(resumedEvents[0]).toEqual({ type: 'text-delta', delta: 'Resumed ok' });
      expect(resumeMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/chat/resume'),
        expect.objectContaining({ method: 'POST' }),
      );

      const cancelMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ status: 'cancelling' }),
      });
      global.fetch = cancelMock;
      await transport.cancel('c-1', 'sp-1');
      expect(cancelMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/ai/chat/c-1/cancel?spaceId=sp-1'),
        expect.objectContaining({ method: 'POST' }),
      );

      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 422 });
      await expect(
        transport.stream({
          messages: [{ role: 'user', content: ' ' }],
          context: { mode: 'chat' },
        }),
      ).rejects.toThrow('AI request failed: 422');

      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, body: null });
      await expect(
        transport.stream({
          messages: [{ role: 'user', content: 'Hello' }],
          context: { mode: 'chat' },
        }),
      ).rejects.toThrow('No response body');
    });
  });

  describe('3. VercelThreadEngine, HITL, Cooperative Stop & ThreadPool LRU', () => {
    it('tracks streaming parts, handles HITL approve -> resume, and rebinds draft key atomically', async () => {
      const cancelSpy = vi.fn().mockResolvedValue(undefined);
      const mockTransport: AiTransportPort = {
        async stream() {
          async function* gen(): AsyncGenerator<AiStreamEvent> {
            yield { type: 'meta', chatId: 'srv-chat-1', title: 'HITL Test', agent: 'rag_agent' };
            yield { type: 'reasoning-delta', delta: 'Checking workspace...' };
            yield { type: 'tool-start', tool: 'create_work_item' };
            yield {
              type: 'hitl-interrupt',
              interruptId: 'int-1',
              interrupts: [{ id: 'int-1', tool: 'create_work_item', allowedDecisions: ['approve', 'reject'] }],
            };
            yield { type: 'done' };
          }
          return { chatIdHeader: 'srv-chat-1', events: gen() };
        },
        async resume() {
          async function* gen(): AsyncGenerator<AiStreamEvent> {
            yield { type: 'tool-end', tool: 'create_work_item', status: 'done', output: { ok: true } };
            yield { type: 'text-delta', delta: 'Work item created.' };
            yield { type: 'done' };
          }
          return { chatIdHeader: 'srv-chat-1', events: gen() };
        },
        cancel: cancelSpy,
      };

      const onChatCreated = vi.fn();
      const pool = new ThreadPool(2);
      const engine = createVercelThreadEngine(
        {
          threadKey: 'draft:test',
          spaceId: 'sp-1',
          callbacks: {
            onChatCreated: (id, title) => {
              onChatCreated(id, title);
              pool.rebind('draft:test', id);
            },
          },
        },
        mockTransport,
      );

      await engine.send('Create task');
      let snap = engine.getSnapshot();
      expect(onChatCreated).toHaveBeenCalledWith('srv-chat-1', undefined);
      expect(snap.title).toBe('HITL Test');
      expect(snap.chatId).toBe('srv-chat-1');
      expect(snap.status).toBe('waiting_approval');
      expect(snap.pendingInterrupts).toHaveLength(1);

      await engine.resume([{ decision: 'approve', interruptId: 'int-1' }], 'sp-1');
      snap = engine.getSnapshot();
      expect(snap.status).toBe('idle');
      expect(snap.pendingInterrupts).toHaveLength(0);
      expect(snap.messages.some((m) => m.content.includes('Work item created.'))).toBe(true);

      await engine.stop();
      expect(cancelSpy).toHaveBeenCalledWith('srv-chat-1', 'sp-1');
    });

    it('never evicts active streaming threads from ThreadPool LRU and maps legacy stored messages', () => {
      const pool = new ThreadPool(1);
      pool.getOrCreate('t1', {});
      pool.getOrCreate('t2', {});
      expect(pool.size()).toBe(1);
      expect(pool.get('t2')).toBeDefined();

      const migrated = mapStoredMessagesToFlux([
        { role: 'user', content: 'Hi', sources: [{ id: 'doc-1', title: 'paper.pdf' }] },
        { role: 'assistant', content: '<think>deep thought</think>\nFinal reply', agent: 'direct' },
      ]);
      expect(migrated[0].attachments?.[0].id).toBe('doc-1');
      expect(migrated[1].parts.map((p) => p.type)).toEqual(['reasoning', 'text']);
      pool.clearAll();
    });

    it('does not notify subscribed listeners synchronously when getOrCreate hits an existing thread, and avoids redundant setMeta notifications', () => {
      const pool = new ThreadPool(2);
      const engine = pool.getOrCreate('chat-1', {
        chatId: 'chat-1',
        spaceId: 'sp-1',
        documentIds: ['doc-a'],
      });

      const listener = vi.fn();
      const unsubscribe = engine.subscribe(listener);

      const sameEngine = pool.getOrCreate('chat-1', {
        chatId: 'chat-1',
        spaceId: 'sp-2',
        documentIds: ['doc-b'],
      });
      expect(sameEngine).toBe(engine);
      expect(listener).not.toHaveBeenCalled();
      expect(engine.getSnapshot().spaceId).toBe('sp-1');

      // Calling setMeta with identical documentIds should not trigger a notification
      engine.setMeta({ spaceId: 'sp-1', documentIds: ['doc-a'] });
      expect(listener).not.toHaveBeenCalled();

      // Explicit post-commit setMeta with changed fields should notify listeners
      engine.setMeta({ spaceId: 'sp-2', documentIds: ['doc-a', 'doc-b'] });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(engine.getSnapshot().spaceId).toBe('sp-2');
      expect(engine.getSnapshot().documentIds).toEqual(['doc-a', 'doc-b']);

      unsubscribe();
      pool.clearAll();
    });
  });
});
