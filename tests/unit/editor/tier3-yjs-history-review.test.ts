import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import {
  sessionCoordinator,
  shouldUseRealtimePersistence,
} from '@/features/editor/core/coordinator/session.coordinator';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  acquireYjsProvider,
  evictYjsProviderByDocId,
  evictYjsProvidersByProject,
  clearYjsProviderPool,
  getActiveYjsProvider,
} from '@/features/editor/sdk/realtime/yjs-provider-pool';
import { YjsSocketIOProvider } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import * as Y from 'yjs';
import {
  createReviewExtension,
  encodeYjsAnchor,
  resolveCommentRange,
  resolveSuggestionRange,
  reviewStateField,
  ReviewCoordinator,
  setYDocEffect,
} from '@/features/editor/subsystems/review';
import { history, review } from '@/features/editor/sdk/pages.service';
import { useConnectivityStore } from '@/features/editor/core';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';
import type { PageComment } from '@/features/editor/domain/types/comment.types';

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
          createReviewExtension({
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
      const fieldState = editorView.state.field(reviewStateField);
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
      expect(fieldState.suggestions[0].groupId).toBeTruthy();
      expect(fieldState.suggestions[0].groupId).toBe(fieldState.suggestions[1].groupId);
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
          extensions: [createReviewExtension({ pageId: 'page-yjs-guard', initialSuggestions: [yjsSug] })],
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
          extensions: [createReviewExtension({ pageId: 'page-http-guard', initialSuggestions: [httpSug] })],
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

  describe('6. Hybrid Yjs RelativePosition Anchoring', () => {
    it('tracks suggestion range via Yjs RelativePosition anchors after earlier document insertions', () => {
      const yDoc = new Y.Doc();
      const yText = yDoc.getText('content');
      yText.insert(0, 'Alpha target omega');

      const startIdx = 'Alpha '.length;
      const endIdx = startIdx + 'target'.length;
      const anchorStart = encodeYjsAnchor(yText, startIdx);
      const anchorEnd = encodeYjsAnchor(yText, endIdx);
      expect(anchorStart).toBeTruthy();
      expect(anchorEnd).toBeTruthy();

      // Simulate another collaborator inserting text before the anchored range
      const prefix = 'Prefix inserted ';
      yText.insert(0, prefix);

      container = document.createElement('div');
      document.body.appendChild(container);
      const state = EditorState.create({
        doc: yText.toString(),
        extensions: [
          createReviewExtension({
            pageId: 'doc-yjs-anchor',
            yDoc,
          }),
        ],
      });
      editorView = new EditorView({ state, parent: container });

      // Simulate hydrated server suggestion without fromIndex/toIndex and stale line/column
      const staleSuggestion: PageSuggestion = {
        id: 'sug-anchor-1',
        pageId: 'doc-yjs-anchor',
        type: 'insert',
        originalText: '',
        suggestedText: 'target',
        status: 'pending',
        authorId: 'u-1',
        author: { id: 'u-1', name: 'Alice' },
        fromLine: 1,
        fromColumn: startIdx + 1,
        toLine: 1,
        toColumn: endIdx + 1,
        anchorStart,
        anchorEnd,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const field = editorView.state.field(reviewStateField);
      expect(field.yDoc).toBe(yDoc);

      const resolved = resolveSuggestionRange(editorView.state.doc, staleSuggestion, field.yDoc);
      expect(editorView.state.doc.sliceString(resolved.from, resolved.to)).toBe('target');

      // Clearing yDoc via effect updates reviewStateField
      editorView.dispatch({ effects: [setYDocEffect.of(null)] });
      expect(editorView.state.field(reviewStateField).yDoc).toBeNull();
    });

    it('tracks comment range and shifted multi-line number via Yjs RelativePosition anchors', () => {
      const yDoc = new Y.Doc();
      const yText = yDoc.getText('content');
      yText.insert(0, 'Line one\nReview target phrase here');

      const anchorIdx = yText.toString().indexOf('target');
      const anchorStart = encodeYjsAnchor(yText, anchorIdx);
      const anchorEnd = encodeYjsAnchor(yText, anchorIdx + 'target'.length);
      expect(anchorStart).toBeTruthy();
      expect(anchorEnd).toBeTruthy();

      // Insert 2 new lines before the anchored comment
      yText.insert(0, 'Added header 1\nAdded header 2\n');

      container = document.createElement('div');
      document.body.appendChild(container);
      const state = EditorState.create({
        doc: yText.toString(),
        extensions: [
          createReviewExtension({
            pageId: 'doc-comment-anchor',
            yDoc,
          }),
        ],
      });
      editorView = new EditorView({ state, parent: container });

      const comment: PageComment = {
        id: 'cmt-anchor-1',
        page: 'doc-comment-anchor',
        projectPageId: 'doc-comment-anchor',
        author: { id: 'u-1', name: 'Alice' },
        content: 'Clarify target wording',
        line: 2,
        lineEnd: 2,
        anchorStart,
        anchorEnd,
        status: 'open',
        replies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const resolved = resolveCommentRange(editorView.state.doc, comment, yDoc);
      expect(resolved).not.toBeNull();
      expect(resolved!.line).toBe(4);
      expect(editorView.state.doc.sliceString(resolved!.from, resolved!.to)).toBe('target');
    });
  });

  describe('7. Closed-Loop Realtime Persistence ACK (doc:persisted)', () => {
    it('requires isProviderSynced=true in shouldUseRealtimePersistence and syncs serverRev on document:persisted', () => {
      expect(
        shouldUseRealtimePersistence({
          hasYText: true,
          isOnline: true,
          isProviderConnected: true,
          isProviderSynced: false,
        }),
      ).toBe(false);

      expect(
        shouldUseRealtimePersistence({
          hasYText: true,
          isOnline: true,
          isProviderConnected: true,
          isProviderSynced: true,
        }),
      ).toBe(true);

      const docId = nextId('doc-ack');
      lruDocumentCache.registerModel(docId, {
        projectId: 'proj-ack',
        content: 'hello',
        serverRev: 3,
      });
      lruDocumentCache.updateContent(docId, 'hello edited', true);

      editorCommandBus.dispatch({
        type: 'document:persisted',
        docId,
        rev: 7,
        version: 7,
        savedAt: '2026-11-22T16:40:00.000Z',
      });

      const updated = lruDocumentCache.getModel(docId);
      expect(updated?.serverRev).toBe(7);
      expect(updated?.isDirty).toBe(false);

      // Out-of-order stale rev must be ignored (monotonic guard)
      editorCommandBus.dispatch({
        type: 'document:persisted',
        docId,
        rev: 4,
        version: 4,
      });
      expect(lruDocumentCache.getModel(docId)?.serverRev).toBe(7);
      lruDocumentCache.evictModel(docId);
    });

    it('keeps isDirty=true when user types new edits while doc:persisted ACK is in flight', async () => {
      const docId = nextId('doc-race');
      lruDocumentCache.registerModel(docId, {
        projectId: 'proj-race',
        content: 'v1',
        serverRev: 1,
      });
      lruDocumentCache.updateContent(docId, 'v2', true);

      // Force realtime flush mode via spy on isRealtimeConnected
      vi.spyOn(sessionCoordinator, 'isRealtimeConnected').mockReturnValue(true);
      await sessionCoordinator.flushFile(docId);

      // Must remain dirty until authoritative doc:persisted ACK arrives
      expect(lruDocumentCache.getModel(docId)?.isDirty).toBe(true);

      // User types v3 before ACK for v2 arrives
      lruDocumentCache.updateContent(docId, 'v3', true);

      editorCommandBus.dispatch({
        type: 'document:persisted',
        docId,
        rev: 2,
        version: 2,
        savedAt: '2026-11-22T16:52:00.000Z',
      });

      // serverRev updates to 2, but isDirty stays true because v3 > flushed v2
      const afterStaleAck = lruDocumentCache.getModel(docId);
      expect(afterStaleAck?.serverRev).toBe(2);
      expect(afterStaleAck?.isDirty).toBe(true);

      // Next flush + ACK for v3 cleanly marks document clean
      await sessionCoordinator.flushFile(docId);
      editorCommandBus.dispatch({
        type: 'document:persisted',
        docId,
        rev: 3,
        version: 3,
        savedAt: '2026-11-22T16:52:02.000Z',
      });
      expect(lruDocumentCache.getModel(docId)?.serverRev).toBe(3);
      expect(lruDocumentCache.getModel(docId)?.isDirty).toBe(false);

      lruDocumentCache.evictModel(docId);
    });
  });
});
