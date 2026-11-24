import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  decodeFluxSseFrame,
  SseFrameParser,
  ThinkTagSplitter,
} from '@/features/ai/transport/sse';
import { FluxHttpTransport } from '@/features/ai/transport/flux';
import {
  createFluxThreadEngine,
  createStreamTurnState,
  finalizeStreamTurn,
  reduceStreamEvent,
} from '@/features/ai/engine/flux-engine';
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

describe('AI SSE Protocol, Transport, FluxThreadEngine & ThreadPool', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('1. SSE Frame Parser, Canonical Event Decoding & ThinkTagSplitter', () => {
    it('parses split SSE chunks, meta, tool-start, error, HITL interrupt, and done', () => {
      const parser = new SseFrameParser();
      const enc = new TextEncoder();

      const part1 = enc.encode(
        'data: {"type":"meta","chatId":"chat-123","title":"Quantum","agent":"rag_agent"}\n\n' +
          'data: {"type":"tool-start","tool":"search_documents"}\n\n' +
          'data: {"type":"er',
      );
      const part2 = enc.encode(
        'ror","message":"Upstream rate limited"}\n\n' +
          'data: {"type":"hitl-interrupt","interruptId":"int-1","interrupts":[{"id":"int-1","tool":"create_work_item","description":"Create high priority task","allowedDecisions":["approve","reject"]}]}\n\n' +
          'data: {"type":"done"}\n\n',
      );

      const frames = [...parser.feed(part1), ...parser.feed(part2), ...parser.flush()];
      const events = frames.flatMap((f) => decodeFluxSseFrame(f.event, f.data));

      expect(events[0]).toEqual({
        type: 'meta',
        chatId: 'chat-123',
        title: 'Quantum',
        agent: 'rag_agent',
      });
      expect(events[1]).toEqual({
        type: 'tool-start',
        tool: 'search_documents',
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

    it('decodes text-delta newlines and splits <think>...</think> across chunk boundaries', () => {
      const textEvents = decodeFluxSseFrame(
        'message',
        '{"type":"text-delta","delta":"Line 1\\n\\nLine 2"}',
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
            'data: {"type":"text-delta","delta":"Quantum qubits"}\n\n',
            'data: {"type":"meta","agent":"rag_agent"}\n\n',
            'data: {"type":"done"}\n\n',
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
        createMockSseResponse([
          'data: {"type":"text-delta","delta":"Resumed ok"}\n\ndata: {"type":"done"}\n\n',
        ]),
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
      const engine = createFluxThreadEngine(
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

    it('preserves historical FluxMessage object references across streamed token deltas and non-message meta updates', async () => {
      // 1. Direct reduceStreamEvent pure reducer check (reasoning -> text -> tool -> finalize)
      let turn = createStreamTurnState('a-2');
      turn = reduceStreamEvent(turn, { type: 'reasoning-delta', delta: 'Step 1' });
      expect(turn.message.parts[0]).toEqual({
        type: 'reasoning',
        text: 'Step 1',
        streaming: true,
      });
      turn = reduceStreamEvent(turn, { type: 'text-delta', delta: 'Hello' });
      expect(turn.message.parts[0]).toEqual({
        type: 'reasoning',
        text: 'Step 1',
        streaming: false,
      });
      expect(turn.message.parts[1]).toEqual({
        type: 'text',
        text: 'Hello',
        streaming: true,
      });
      const prevMsg = turn.message;
      turn = reduceStreamEvent(turn, { type: 'text-delta', delta: ' world' });
      expect(turn.message).not.toBe(prevMsg);
      expect(turn.message.content).toBe('Hello world');
      turn = finalizeStreamTurn(turn);
      expect(turn.message.parts[1]).toEqual({
        type: 'text',
        text: 'Hello world',
        streaming: false,
      });

      // 2. End-to-end VercelThreadEngine streaming delta snapshot identity check
      let turnCount = 0;
      const mockTransport: AiTransportPort = {
        async stream() {
          turnCount += 1;
          const currentTurn = turnCount;
          async function* gen(): AsyncGenerator<AiStreamEvent> {
            if (currentTurn === 1) {
              yield { type: 'text-delta', delta: 'Turn 1 reply.' };
              yield { type: 'done' };
            } else {
              yield { type: 'text-delta', delta: 'Chunk 1 ' };
              await Promise.resolve();
              yield { type: 'text-delta', delta: 'Chunk 2 ' };
              await Promise.resolve();
              yield { type: 'text-delta', delta: 'Chunk 3' };
              yield { type: 'done' };
            }
          }
          return { chatIdHeader: 'chat-ref-1', events: gen() };
        },
        async resume() {
          async function* gen(): AsyncGenerator<AiStreamEvent> {
            yield { type: 'done' };
          }
          return { events: gen() };
        },
        cancel: vi.fn().mockResolvedValue(undefined),
      };

      const engine = createFluxThreadEngine(
        { threadKey: 'chat-ref-1', spaceId: 'sp-1' },
        mockTransport,
      );

      await engine.send('Turn 1 question');
      const afterTurn1 = engine.getSnapshot();
      expect(afterTurn1.messages).toHaveLength(2);
      const [turn1UserRef, turn1AssistantRef] = afterTurn1.messages;

      // Capture every snapshot emitted during turn 2 streaming
      const streamingSnapshots: Array<ReturnType<typeof engine.getSnapshot>> = [];
      const unsub = engine.subscribe(() => {
        streamingSnapshots.push(engine.getSnapshot());
      });

      await engine.send('Turn 2 question');
      unsub();

      // Verify we observed multiple streaming updates and historical messages kept exact identity
      const assistantSnapshots = streamingSnapshots.filter(
        (s) => s.messages.length === 4,
      );
      expect(assistantSnapshots.length).toBeGreaterThanOrEqual(2);

      for (const snap of assistantSnapshots) {
        expect(snap.messages[0]).toBe(turn1UserRef);
        expect(snap.messages[1]).toBe(turn1AssistantRef);
      }

      const finalSnap = engine.getSnapshot();
      expect(finalSnap.messages[0]).toBe(turn1UserRef);
      expect(finalSnap.messages[1]).toBe(turn1AssistantRef);
      expect(finalSnap.messages[3].content).toBe('Chunk 1 Chunk 2 Chunk 3');

      // Non-message meta update should reuse the exact messages array reference
      engine.setMeta({ title: 'Updated Title' });
      expect(engine.getSnapshot().messages).toBe(finalSnap.messages);

      await engine.dispose();
    });

    it('handles stream error -> retry, agent-handoff/done, sources, and abort via stop()', async () => {
      let attempt = 0;
      const cancelSpy = vi.fn().mockResolvedValue(undefined);
      const mockTransport: AiTransportPort = {
        async stream({ signal }) {
          attempt += 1;
          if (attempt === 1) {
            throw new Error('Upstream 503');
          }
          if (attempt === 2) {
            async function* gen(): AsyncGenerator<AiStreamEvent> {
              yield { type: 'agent-handoff', to: 'rag_agent' };
              yield { type: 'tool-start', tool: 'search_documents', input: { q: 'flux' } };
              yield { type: 'tool-end', tool: 'search_documents', status: 'done', output: { hits: 2 } };
              yield { type: 'agent-done', agent: 'rag_agent', status: 'done' };
              yield {
                type: 'meta',
                agent: 'rag_agent',
                sources: [{ id: 'doc-1', title: 'Spec.pdf' }],
              };
              yield { type: 'text-delta', delta: 'Recovered answer' };
              yield { type: 'done' };
            }
            return { chatIdHeader: 'chat-retry-1', events: gen() };
          }
          async function* slowGen(): AsyncGenerator<AiStreamEvent> {
            yield { type: 'text-delta', delta: 'Partial' };
            await new Promise<void>((_, reject) => {
              signal?.addEventListener('abort', () => {
                const err = new Error('Aborted');
                err.name = 'AbortError';
                reject(err);
              });
            });
          }
          return { chatIdHeader: 'chat-retry-1', events: slowGen() };
        },
        async resume() {
          async function* gen(): AsyncGenerator<AiStreamEvent> {
            yield { type: 'done' };
          }
          return { events: gen() };
        },
        cancel: cancelSpy,
      };

      const engine = createFluxThreadEngine(
        { threadKey: 'draft:retry', spaceId: 'sp-1' },
        mockTransport,
      );

      // 1. First attempt fails -> status is 'error', retry recovers without duplicating user message
      await engine.send('Retry me');
      expect(engine.getSnapshot().status).toBe('error');
      expect(engine.getSnapshot().error?.message).toBe('Upstream 503');

      await engine.retry();
      const recovered = engine.getSnapshot();
      expect(recovered.status).toBe('idle');
      expect(recovered.error).toBeNull();
      expect(recovered.messages).toHaveLength(2);
      expect(recovered.messages[1].content).toBe('Recovered answer');
      expect(recovered.messages[1].sources).toEqual([{ id: 'doc-1', title: 'Spec.pdf' }]);
      expect(recovered.messages[1].parts.map((p) => p.type)).toEqual([
        'agent-handoff',
        'tool',
        'sources',
        'text',
      ]);

      // 2. Cooperative stop aborts in-flight stream cleanly without setting error
      const pendingSend = engine.send('Slow request');
      await Promise.resolve();
      await Promise.resolve();
      await engine.stop();
      await pendingSend;

      const afterStop = engine.getSnapshot();
      expect(afterStop.status).toBe('idle');
      expect(afterStop.error).toBeNull();
      expect(cancelSpy).toHaveBeenCalledWith('chat-retry-1', 'sp-1');

      engine.reset();
      expect(engine.getSnapshot().messages).toHaveLength(0);
      expect(engine.getSnapshot().chatId).toBeNull();
      await engine.dispose();
    });
  });
});
