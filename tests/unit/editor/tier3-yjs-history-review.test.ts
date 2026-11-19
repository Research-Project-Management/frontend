import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/core/coordinator/session.coordinator';
import {
  acquireYjsProvider,
  evictYjsProviderByDocId,
  evictYjsProvidersByProject,
  clearYjsProviderPool,
  getActiveYjsProvider,
} from '@/features/editor/sdk/realtime/yjs-provider-pool';
import { YjsSocketIOProvider } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import {
  createTrackChangesExtension,
  trackChangesStateField,
} from '@/features/editor/subsystems/review/extensions/track-changes.extension';
import { ReviewCoordinator } from '@/features/editor/subsystems/review/coordinator/review.coordinator';
import { history, review } from '@/features/editor/sdk/pages.service';
import { useConnectivityStore } from '@/features/editor/core';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';

let idSeq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${idSeq++}`;

function createFakeSocket() {
  const handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const emit = vi.fn();
  return {
    connected: true,
    emit,
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      const list = handlers.get(event) ?? [];
      list.push(cb);
      handlers.set(event, list);
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    removeAllListeners: vi.fn(),
    trigger(event: string, ...args: unknown[]) {
      for (const cb of handlers.get(event) ?? []) {
        cb(...args);
      }
    },
  };
}

describe('Khối 2 / Tầng 3 — Live Yjs Sync, History & Track Changes / Review (Frontend)', () => {
  let container: HTMLDivElement | null = null;
  let editorView: EditorView | null = null;

  beforeEach(() => {
    useConnectivityStore.getState().recordOnline?.();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
    delete (globalThis as Record<string, unknown>).__fluxFakeSocket;
    clearYjsProviderPool({ skipFlush: true });
    vi.restoreAllMocks();
  });

  describe('1. LRU Cache & Session Coordinator Revision Guards', () => {
    it('clearServerRev clears stale serverRev while preserving isDirty and monotonic registerModel refuses downgrade', () => {
      const fileId = nextId('lru');
      lruDocumentCache.registerModel(fileId, { content: 'v5 text', serverRev: 5 });
      lruDocumentCache.registerModel(fileId, { content: 'v3 text', serverRev: 3 });
      expect(lruDocumentCache.getModel(fileId)?.serverRev).toBe(5);

      lruDocumentCache.updateContent(fileId, 'unsaved edit', true);
      lruDocumentCache.clearServerRev(fileId);
      const model = lruDocumentCache.getModel(fileId);
      expect(model?.serverRev).toBeUndefined();
      expect(model?.isDirty).toBe(true);

      lruDocumentCache.evictModel(fileId);
    });

    it('notifyContentChange clears serverRev in realtime mode while markRealtimeSynced clears isDirty only on matching text', () => {
      const fileId = nextId('sess');
      lruDocumentCache.registerModel(fileId, { content: 'base', serverRev: 4 });
      sessionCoordinator.setRealtimeConnected(fileId, true);

      sessionCoordinator.notifyContentChange(fileId, 'live edit', {
        isRealtimeActive: true,
        skipAutoCompile: true,
      });

      const afterEdit = lruDocumentCache.getModel(fileId);
      expect(afterEdit?.serverRev).toBeUndefined();
      expect(afterEdit?.isDirty).toBe(true);

      sessionCoordinator.markRealtimeSynced(fileId, 'stale text');
      expect(lruDocumentCache.getModel(fileId)?.isDirty).toBe(true);

      sessionCoordinator.markRealtimeSynced(fileId, 'live edit');
      expect(lruDocumentCache.getModel(fileId)?.isDirty).toBe(false);

      sessionCoordinator.clearRealtimeStatus(fileId);
      lruDocumentCache.evictModel(fileId);
    });
  });

  describe('2. Yjs Provider Pool Eviction & Chat-Only Room Isolation', () => {
    it('evictYjsProviderByDocId and evictYjsProvidersByProject destroy providers without flushing', () => {
      const fakeSocket = createFakeSocket();
      (globalThis as Record<string, unknown>).__fluxFakeSocket = fakeSocket;

      const { provider: p1 } = acquireYjsProvider('space-a', 'doc-a1', {});
      const { provider: p2 } = acquireYjsProvider('space-a', 'doc-a2', {});
      const { provider: p3 } = acquireYjsProvider('space-b', 'doc-b1', {});

      const flushSpy1 = vi.spyOn(p1, 'flushPendingUpdates');
      const evictedDoc = evictYjsProviderByDocId('doc-a1', { skipFlush: true });
      expect(evictedDoc).toBe(1);
      expect(p1.isDestroyed).toBe(true);
      expect(flushSpy1).not.toHaveBeenCalled();
      expect(getActiveYjsProvider('doc-a1')).toBeNull();

      const evictedProject = evictYjsProvidersByProject('space-a', { skipFlush: true });
      expect(evictedProject).toBe(1);
      expect(p2.isDestroyed).toBe(true);
      expect(p3.isDestroyed).toBe(false);
    });

    it('chat-only room skips doc:join and doc:leave while marking synced', () => {
      const fakeSocket = createFakeSocket();
      (globalThis as Record<string, unknown>).__fluxFakeSocket = fakeSocket;

      const chatProvider = new YjsSocketIOProvider('space-chat', 'chat:space-chat', undefined, {});
      fakeSocket.trigger('connect');

      expect(chatProvider.isSynced).toBe(true);
      const emittedEvents = fakeSocket.emit.mock.calls.map((c) => c[0]);
      expect(emittedEvents).toContain('project:join');
      expect(emittedEvents).not.toContain('doc:join');

      chatProvider.destroy({ skipFlush: true });
      const postDestroyEvents = fakeSocket.emit.mock.calls.map((c) => c[0]);
      expect(postDestroyEvents).not.toContain('doc:leave');
    });
  });

  describe('3. Track Changes Case 3 Selection Replacement Decomposition', () => {
    it('decomposes typing over a selection into delete + insert suggestions without swallowing replacement text', () => {
      container = document.createElement('div');
      document.body.appendChild(container);

      const state = EditorState.create({
        doc: 'Hello world!',
        extensions: [
          createTrackChangesExtension({
            pageId: 'doc-tc-3',
            initialViewMode: 'changes',
            initialReviewMode: true,
          }),
        ],
      });
      editorView = new EditorView({ state, parent: container });

      editorView.dispatch({
        changes: { from: 6, to: 11, insert: 'earth' },
        selection: { anchor: 11 },
        userEvent: 'input.type',
      });

      expect(editorView.state.doc.toString()).toBe('Hello worldearth!');
      const fieldState = editorView.state.field(trackChangesStateField);
      expect(fieldState.suggestions).toHaveLength(2);
      expect(fieldState.suggestions[0]).toMatchObject({
        type: 'delete',
        originalText: 'world',
        suggestedText: '',
        status: 'pending',
      });
      expect(fieldState.suggestions[1]).toMatchObject({
        type: 'insert',
        originalText: '',
        suggestedText: 'earth',
        status: 'pending',
      });
    });
  });

  describe('4. ReviewCoordinator In-Flight Dedupe, Yjs Double-Splice Guard & reset()', () => {
    it('blocks duplicate concurrent acceptSuggestion clicks with inFlightResolutions', async () => {
      let resolveRpc!: (val: unknown) => void;
      const acceptMock = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRpc = resolve;
          }),
      );
      const coordinator = new ReviewCoordinator({
        service: {
          acceptSuggestion: acceptMock,
          rejectSuggestion: vi.fn(),
          acceptAllSuggestions: vi.fn(),
          rejectAllSuggestions: vi.fn(),
          acceptSelectedSuggestions: vi.fn(),
          rejectSelectedSuggestions: vi.fn(),
        },
        notification: { notifySuccess: vi.fn(), notifyError: vi.fn() },
      });

      const firstPromise = coordinator.acceptSuggestion('page-dedupe', 'sug-dedupe');
      const secondPromise = coordinator.acceptSuggestion('page-dedupe', 'sug-dedupe');

      expect(await secondPromise).toBe(false);
      expect(acceptMock).toHaveBeenCalledTimes(1);

      resolveRpc({ ok: true });
      expect(await firstPromise).toBe(true);
      coordinator.reset();
    });

    it('skips local CodeMirror buffer splice when a connected synced Yjs provider is active, but splices when offline/HTTP-only', async () => {
      const fakeSocket = createFakeSocket();
      (globalThis as Record<string, unknown>).__fluxFakeSocket = fakeSocket;

      container = document.createElement('div');
      document.body.appendChild(container);

      const makeSug = (id: string, pageId: string): PageSuggestion => ({
        id,
        pageId,
        type: 'delete',
        originalText: 'old ',
        suggestedText: '',
        fromLine: 1,
        fromColumn: 1,
        toLine: 1,
        toColumn: 5,
        status: 'pending',
        authorId: 'u-1',
        author: { id: 'u-1', name: 'Alice' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const coordinator = new ReviewCoordinator({
        service: {
          acceptSuggestion: vi.fn().mockResolvedValue({ ok: true, page: { rev: 2 } }),
          rejectSuggestion: vi.fn(),
          acceptAllSuggestions: vi.fn(),
          rejectAllSuggestions: vi.fn(),
          acceptSelectedSuggestions: vi.fn(),
          rejectSelectedSuggestions: vi.fn(),
        },
        notification: { notifySuccess: vi.fn(), notifyError: vi.fn() },
      });

      // Live synced Yjs page -> skip local buffer splice to prevent CRDT double-edit
      const { provider } = acquireYjsProvider('space-yjs', 'page-yjs-guard', {});
      provider.status = 'connected';
      provider.isSynced = true;

      const yjsSug = makeSug('sug-yjs-1', 'page-yjs-guard');
      const liveView = new EditorView({
        state: EditorState.create({
          doc: 'old line',
          extensions: [createTrackChangesExtension({ pageId: 'page-yjs-guard', initialSuggestions: [yjsSug] })],
        }),
        parent: container,
      });
      coordinator.bindEditorView(liveView, 'page-yjs-guard');
      coordinator.syncEditorDecorations(liveView, [yjsSug], [], 'changes', false, 'page-yjs-guard');

      await coordinator.acceptSuggestion('page-yjs-guard', 'sug-yjs-1');
      expect(liveView.state.doc.toString()).toBe('old line');
      liveView.destroy();

      // Offline / HTTP-only page -> immediate 0ms local optimistic splice still active
      const httpSug = makeSug('sug-http-1', 'page-http-guard');
      const httpView = new EditorView({
        state: EditorState.create({
          doc: 'old line',
          extensions: [createTrackChangesExtension({ pageId: 'page-http-guard', initialSuggestions: [httpSug] })],
        }),
        parent: container,
      });
      coordinator.bindEditorView(httpView, 'page-http-guard');
      coordinator.syncEditorDecorations(httpView, [httpSug], [], 'changes', false, 'page-http-guard');

      await coordinator.acceptSuggestion('page-http-guard', 'sug-http-1');
      expect(httpView.state.doc.toString()).toBe('line');
      httpView.destroy();

      coordinator.reset();
      expect(coordinator.getReviewStatus('page-http-guard')).toBe('draft');
    });
  });

  describe('5. History & Review SDK Page-Scope & Personal Space Routing', () => {
    it('routes History & Review calls accurately across Project, Page-scoped, and Personal Space modes', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            ok: true,
            review: { status: 'in_review', roundNumber: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      await history.restoreProjectVersionFile('proj-1', 3, '/main.tex');
      expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
        '/api/v1/pages/spaces/proj-1/history/versions/3/restore-file',
      );

      await history.restoreProjectVersionFile('', 3, '/main.tex', undefined, { pageId: 'page-9' });
      expect(String(fetchSpy.mock.calls[1]?.[0])).toBe(
        '/api/v1/pages/pages/page-9/history/versions/3/restore-file',
      );

      await history.getProjectVersions('proj-1', { pageId: 'page-9' });
      expect(String(fetchSpy.mock.calls[2]?.[0])).toBe(
        '/api/v1/pages/spaces/proj-1/history/versions?pageId=page-9',
      );

      await review.getReviewStatus('', 'doc-7');
      expect(String(fetchSpy.mock.calls[3]?.[0])).toBe(
        '/api/v1/pages/pages/doc-7/review-status',
      );

      await review.getProjectOverview('page-9', { isPageScope: true });
      expect(String(fetchSpy.mock.calls[4]?.[0])).toBe(
        '/api/v1/pages/pages/page-9/review-overview',
      );
    });
  });
});
