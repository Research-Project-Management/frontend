import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { toast } from 'sonner';
import {
  ReviewCoordinator,
  reviewCoordinator,
  createReviewExtension,
  useReviewSync,
  type ReviewServicePort,
} from '@/features/editor/subsystems/review';
import {
  editorCommandBus,
  useDocumentCollaborationStore,
  useWorkspaceStore,
} from '@/features/editor/core';
import { pagesService } from '@/features/editor/sdk/pages.service';
import {
  createCommentSchema,
  createReplySchema,
} from '@/features/editor/domain/types/comment.types';
import type {
  PageSuggestion,
  SuggestionType,
  SuggestionStatus,
} from '@/features/editor/domain/types/suggestion.types';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('ReviewCoordinator, Track Changes SDK & Realtime Review Sync', () => {
  let mockService: ReviewServicePort;
  let coordinator: ReviewCoordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = {
      acceptSuggestion: vi.fn().mockResolvedValue({ success: true }),
      rejectSuggestion: vi.fn().mockResolvedValue({ success: true }),
      acceptAllSuggestions: vi.fn().mockResolvedValue({ success: true }),
      rejectAllSuggestions: vi.fn().mockResolvedValue({ success: true }),
      acceptSelectedSuggestions: vi.fn().mockResolvedValue({ success: true }),
      rejectSelectedSuggestions: vi.fn().mockResolvedValue({ success: true }),
    };

    coordinator = new ReviewCoordinator({
      service: mockService,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    reviewCoordinator.resetPorts();
  });

  describe('1. ReviewCoordinator Deep Module (Ports, Optimistic Rollback & Group Resolution)', () => {
    it('acceptSuggestion & rejectSuggestion call servicePort and dispatch bus events', async () => {
      const busEvents: unknown[] = [];
      const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
        busEvents.push(cmd);
      });

      expect(await coordinator.acceptSuggestion('page-1', 'sug-123')).toBe(true);
      expect(mockService.acceptSuggestion).toHaveBeenCalledWith('page-1', 'sug-123');
      expect(toast.success).toHaveBeenCalledWith('Change accepted', { id: 'sug-sug-123' });

      expect(await coordinator.rejectSuggestion('page-1', 'sug-456')).toBe(true);
      expect(mockService.rejectSuggestion).toHaveBeenCalledWith('page-1', 'sug-456');
      expect(toast.success).toHaveBeenCalledWith('Change rejected', { id: 'sug-sug-456' });

      expect(busEvents).toHaveLength(2);
      expect(busEvents[0]).toMatchObject({
        type: 'editor:review-event',
        pageId: 'page-1',
        event: 'suggestion:accepted',
        payload: { suggestionId: 'sug-123' },
      });
      expect(busEvents[1]).toMatchObject({
        type: 'editor:review-event',
        pageId: 'page-1',
        event: 'suggestion:rejected',
        payload: { suggestionId: 'sug-456' },
      });

      unsub();
    });

    it('acceptSuggestion dispatches suggestion:rollback and notifies error on service failure', async () => {
      mockService.acceptSuggestion = vi.fn().mockRejectedValue(new Error('Network error'));

      const busEvents: unknown[] = [];
      const unsub = editorCommandBus.subscribe('editor:review-event', (cmd) => {
        busEvents.push(cmd);
      });

      expect(await coordinator.acceptSuggestion('page-1', 'sug-123')).toBe(false);
      expect(toast.error).toHaveBeenCalledWith('Network error', { id: 'sug-sug-123' });
      expect(busEvents[0]).toMatchObject({
        type: 'editor:review-event',
        pageId: 'page-1',
        event: 'suggestion:rollback',
        payload: { suggestionId: 'sug-123' },
      });

      unsub();
    });

    it('delegates bulk operations (acceptAll, rejectAll, acceptSelected, rejectSelected) and rolls back CodeMirror buffer on failure', async () => {
      await coordinator.acceptAll('page-1');
      expect(mockService.acceptAllSuggestions).toHaveBeenCalledWith('page-1');
      await coordinator.rejectAll('page-1');
      expect(mockService.rejectAllSuggestions).toHaveBeenCalledWith('page-1');
      await coordinator.acceptSelected('page-1', ['sug-1', 'sug-2']);
      expect(mockService.acceptSelectedSuggestions).toHaveBeenCalledWith('page-1', [
        'sug-1',
        'sug-2',
      ]);
      await coordinator.rejectSelected('page-1', ['sug-3']);
      expect(mockService.rejectSelectedSuggestions).toHaveBeenCalledWith('page-1', ['sug-3']);

      mockService.acceptAllSuggestions = vi.fn().mockRejectedValue(new Error('Bulk failure'));
      const container = document.createElement('div');
      document.body.appendChild(container);
      const view = new EditorView({
        state: EditorState.create({
          doc: 'We propose an inefficient algorithm.',
          extensions: [createReviewExtension()],
        }),
        parent: container,
      });

      try {
        coordinator.bindEditorView(view, 'page-bulk-err');
        coordinator.syncEditorDecorations(
          view,
          [
            {
              id: 'sug-del-err',
              pageId: 'page-bulk-err',
              type: 'delete',
              originalText: 'inefficient ',
              suggestedText: '',
              fromLine: 1,
              fromColumn: 15,
              toLine: 1,
              toColumn: 27,
              status: 'pending',
              authorId: 'u-1',
              author: { id: 'u-1', name: 'Alice' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          [],
          'changes',
          false,
          'page-bulk-err',
        );

        expect(await coordinator.acceptAll('page-bulk-err')).toBe(false);
        expect(view.state.doc.toString()).toBe('We propose an inefficient algorithm.');
      } finally {
        view.destroy();
        container.remove();
      }
    });

    it('supports setPorts, initiateComment sidebar activation, 1->0 wire column conversion, and groupId pair batch resolution', async () => {
      reviewCoordinator.setPorts({ service: mockService });
      await reviewCoordinator.acceptSuggestion('page-live', 'sug-live');
      expect(mockService.acceptSuggestion).toHaveBeenCalledWith('page-live', 'sug-live');
      reviewCoordinator.resetPorts();

      useDocumentCollaborationStore.getState().clearPendingComment();
      useWorkspaceStore.getState().setActiveSidebarTab('files');
      useWorkspaceStore.getState().setSidebarLeftOpen(false);

      coordinator.initiateComment(15, 'sample selected text');
      expect(useDocumentCollaborationStore.getState().pendingComment).toEqual({
        startLine: 15,
        endLine: 15,
        selectedText: 'sample selected text',
      });
      expect(useWorkspaceStore.getState().activeSidebarTab).toBe('review');
      expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);

      vi.useFakeTimers();
      const createSuggestion = vi.fn().mockImplementation(async (payload) => ({
        id: 'persisted-col-1',
        ...payload,
        status: 'pending' as const,
        authorId: 'u-1',
        author: { id: 'u-1', name: 'Alice' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      const acceptSuggestion = vi.fn().mockResolvedValue({ success: true });

      reviewCoordinator.setPorts({
        service: { ...mockService, createSuggestion, acceptSuggestion },
      });

      try {
        editorCommandBus.dispatch({
          type: 'editor:review-event',
          pageId: 'page-col',
          event: 'suggestion:local-recorded',
          payload: {
            suggestion: {
              id: 'sug-local-col-1',
              pageId: 'page-col',
              groupId: 'grp-col-1',
              type: 'delete',
              originalText: 'inefficient ',
              suggestedText: '',
              fromLine: 1,
              fromColumn: 18,
              toLine: 1,
              toColumn: 30,
              fromIndex: 17,
              toIndex: 29,
              status: 'pending',
              authorId: 'u-1',
              author: { id: 'u-1', name: 'Alice' },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          },
        });

        await vi.advanceTimersByTimeAsync(400);
        expect(createSuggestion).toHaveBeenCalledWith(
          expect.objectContaining({
            pageId: 'page-col',
            groupId: 'grp-col-1',
            fromLine: 1,
            fromColumn: 17,
            toLine: 1,
            toColumn: 29,
          }),
        );
        expect(await reviewCoordinator.acceptSuggestion('page-col', 'sug-local-col-1')).toBe(true);
        expect(acceptSuggestion).toHaveBeenCalledWith('page-col', 'persisted-col-1');
      } finally {
        vi.useRealTimers();
        reviewCoordinator.reset();
      }

      const batchResolve = vi.fn().mockResolvedValue({ success: true });
      const grpCoordinator = new ReviewCoordinator({
        service: { ...mockService, batchResolve },
      });
      grpCoordinator.syncEditorDecorations(
        null,
        [
          {
            id: 'sug-grp-del',
            pageId: 'page-grp',
            groupId: 'grp-pair-1',
            type: 'delete',
            originalText: 'old',
            suggestedText: '',
            fromLine: 1,
            fromColumn: 1,
            toLine: 1,
            toColumn: 4,
            status: 'pending',
            authorId: 'u-1',
            author: { id: 'u-1', name: 'Alice' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'sug-grp-ins',
            pageId: 'page-grp',
            groupId: 'grp-pair-1',
            type: 'insert',
            originalText: '',
            suggestedText: 'new',
            fromLine: 1,
            fromColumn: 4,
            toLine: 1,
            toColumn: 7,
            status: 'pending',
            authorId: 'u-1',
            author: { id: 'u-1', name: 'Alice' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        [],
        'changes',
        false,
        'page-grp',
      );

      expect(await grpCoordinator.acceptSuggestion('page-grp', 'sug-grp-del')).toBe(true);
      expect(batchResolve).toHaveBeenCalledWith('page-grp', {
        suggestionIds: ['sug-grp-del', 'sug-grp-ins'],
        action: 'accept',
      });
    });
  });

  describe('2. Suggestions SDK, Realtime Sync & Comment Mutations', () => {
    const sampleSuggestion: PageSuggestion = {
      id: 'sugg-1',
      pageId: 'page-1',
      authorId: 'user-1',
      author: { id: 'user-1', name: 'Alice', email: 'alice@test.com' },
      type: 'insert' as SuggestionType,
      originalText: '',
      suggestedText: '\\usepackage{amsmath}\n',
      fromLine: 2,
      fromColumn: 1,
      toLine: 2,
      toColumn: 1,
      status: 'pending' as SuggestionStatus,
      description: 'Add amsmath for equations',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    it('routes pagesService.suggestions get, accept, reject, and batch-resolve endpoints accurately', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ suggestions: [sampleSuggestion] }))
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            suggestion: { ...sampleSuggestion, status: 'accepted' },
            page: { id: 'page-1', content: 'Updated LaTeX document text' },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            suggestion: { ...sampleSuggestion, status: 'rejected' },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            ok: true,
            acceptedCount: 2,
            page: { id: 'page-1', content: 'Fully accepted document' },
          }),
        )
        .mockResolvedValueOnce(jsonResponse({ ok: true, rejectedCount: 2 }));

      const list = await pagesService.suggestions.getSuggestions('page-1', 'pending');
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(
        '/api/v1/pages/docs/page-1/suggestions?status=pending',
      );
      expect(list).toHaveLength(1);

      const accepted = await pagesService.suggestions.acceptSuggestion('page-1', 'sugg-1');
      expect(String(fetchSpy.mock.calls[1]?.[0])).toContain(
        '/api/v1/pages/docs/page-1/suggestions/sugg-1/accept',
      );
      expect(accepted.suggestion.status).toBe('accepted');

      const rejected = await pagesService.suggestions.rejectSuggestion('page-1', 'sugg-1');
      expect(String(fetchSpy.mock.calls[2]?.[0])).toContain(
        '/api/v1/pages/docs/page-1/suggestions/sugg-1/reject',
      );
      expect(rejected.suggestion.status).toBe('rejected');

      const acceptedAll = await pagesService.suggestions.acceptAllSuggestions('page-1');
      expect(String(fetchSpy.mock.calls[3]?.[0])).toContain(
        '/api/v1/pages/docs/page-1/suggestions/batch-resolve',
      );
      expect(acceptedAll.acceptedCount).toBe(2);

      const rejectedAll = await pagesService.suggestions.rejectAllSuggestions('page-1');
      expect(rejectedAll.rejectedCount).toBe(2);
    });

    it('useReviewSync invalidates suggestion and review queries on bus events', () => {
      vi.spyOn(pagesService.suggestions, 'getSuggestions').mockResolvedValue([]);
      vi.spyOn(pagesService.comments, 'getComments').mockResolvedValue([]);

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries');
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children);

      const { unmount } = renderHook(() => useReviewSync('doc-sync-1', null), { wrapper });

      act(() => {
        editorCommandBus.dispatch({
          type: 'editor:review-event',
          pageId: 'doc-sync-1',
          event: 'track-changes:created',
        });
        editorCommandBus.dispatch({
          type: 'editor:review-event',
          pageId: 'doc-sync-1',
          event: 'review:status-changed',
        });
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['page-suggestions', 'doc-sync-1'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['project-review-overview'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['manuscript-review-status'] });

      unmount();
      client.clear();
    });

    it('validates 10,000-char comment schemas and invokes updateComment & updateReply cleanly', async () => {
      expect(createCommentSchema.safeParse({ content: 'x'.repeat(10000) }).success).toBe(true);
      expect(createCommentSchema.safeParse({ content: 'x'.repeat(10001) }).success).toBe(false);
      expect(createReplySchema.safeParse({ content: 'x'.repeat(10000) }).success).toBe(true);
      expect(createReplySchema.safeParse({ content: 'x'.repeat(10001) }).success).toBe(false);

      const { useUpdateComment, useUpdateReply } = await vi.importActual<
        typeof import('@/features/editor/subsystems/review/hooks/useComments')
      >('@/features/editor/subsystems/review/hooks/useComments');

      const updateSpy = vi.spyOn(pagesService.comments, 'updateComment').mockResolvedValue({
        id: 'cmt-1',
        page: 'doc-cmt-1',
        projectPageId: 'doc-cmt-1',
        author: { id: 'u-1', name: 'Alice' },
        content: 'Edited wording',
        line: 3,
        status: 'open',
        replies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const replyUpdateSpy = vi.spyOn(pagesService.comments, 'updateReply').mockResolvedValue({
        id: 'cmt-2',
        page: 'doc-cmt-2',
        projectPageId: 'doc-cmt-2',
        author: { id: 'u-1', name: 'Alice' },
        content: 'Root',
        line: 1,
        status: 'open',
        replies: [
          {
            id: 'rep-1',
            author: { id: 'u-1', name: 'Alice' },
            content: 'Updated reply',
            createdAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children);

      const commentHook = renderHook(() => useUpdateComment(client), { wrapper });
      await act(async () => {
        await commentHook.result.current.mutateAsync({
          pageId: 'doc-cmt-1',
          commentId: 'cmt-1',
          content: 'Edited wording',
        });
      });
      expect(updateSpy).toHaveBeenCalledWith('doc-cmt-1', 'cmt-1', { content: 'Edited wording' });
      commentHook.unmount();

      const replyHook = renderHook(() => useUpdateReply(client), { wrapper });
      await act(async () => {
        await replyHook.result.current.mutateAsync({
          pageId: 'doc-cmt-2',
          commentId: 'cmt-2',
          replyId: 'rep-1',
          content: 'Updated reply',
        });
      });
      expect(replyUpdateSpy).toHaveBeenCalledWith(
        'doc-cmt-2',
        'cmt-2',
        'rep-1',
        'Updated reply',
      );
      replyHook.unmount();
      client.clear();
    });
  });
});
