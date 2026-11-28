import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { editorCommandBus } from '@/features/editor/core';
import { useReviewSync } from '@/features/editor/subsystems/review';
import {
  createCommentSchema,
  createReplySchema,
} from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion, SuggestionType, SuggestionStatus } from '@/features/editor/domain/types/suggestion.types';

import * as api from '@/shared/lib/api';

describe('Track Changes & Review System (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSuggestions: PageSuggestion[] = [
    {
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
    },
    {
      id: 'sugg-2',
      pageId: 'page-1',
      authorId: 'user-2',
      author: { id: 'user-2', name: 'Bob', email: 'bob@test.com' },
      type: 'replace' as SuggestionType,
      originalText: 'very fast algorithm',
      suggestedText: 'computationally efficient approach',
      fromLine: 15,
      fromColumn: 5,
      toLine: 15,
      toColumn: 24,
      status: 'pending' as SuggestionStatus,
      description: 'Academic tone refinement',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sugg-3',
      pageId: 'page-1',
      authorId: 'user-1',
      author: { id: 'user-1', name: 'Alice', email: 'alice@test.com' },
      type: 'delete' as SuggestionType,
      originalText: 'draft note: check later',
      suggestedText: '',
      fromLine: 28,
      fromColumn: 1,
      toLine: 28,
      toColumn: 23,
      status: 'accepted' as SuggestionStatus,
      description: 'Remove draft notes',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  describe('1. Suggestion Service API Client', () => {
    it('should query suggestions with status filter', async () => {
      const apiGetSpy = vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        suggestions: mockSuggestions.slice(0, 2),
      } as any);

      const result = await pagesService.suggestions.getSuggestions('page-1', 'pending');
      expect(apiGetSpy).toHaveBeenCalledWith(
        '/api/v1/pages/docs/page-1/suggestions?status=pending',
        expect.anything(),
      );
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('pending');
    });

    it('should create suggestion payload correctly', async () => {
      const newSugg = mockSuggestions[0];
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        suggestion: newSugg,
      } as any);

      const result = await pagesService.suggestions.createSuggestion({
        pageId: 'page-1',
        type: 'insert',
        suggestedText: '\\usepackage{amsmath}\n',
        fromLine: 2,
        toLine: 2,
        description: 'Add amsmath for equations',
      });

      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/pages/docs/page-1/suggestions', {
        type: 'insert',
        suggestedText: '\\usepackage{amsmath}\n',
        fromLine: 2,
        toLine: 2,
        description: 'Add amsmath for equations',
      });
      expect(result.id).toBe('sugg-1');
    });

    it('should accept a suggestion and receive updated document content', async () => {
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        ok: true,
        suggestion: { ...mockSuggestions[1], status: 'accepted' },
        page: { id: 'page-1', content: 'Updated LaTeX document text' },
      } as any);

      const res = await pagesService.suggestions.acceptSuggestion('page-1', 'sugg-2');
      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/pages/docs/page-1/suggestions/sugg-2/accept', {});
      expect(res.ok).toBe(true);
      expect(res.suggestion.status).toBe('accepted');
      expect(res.page.content).toBe('Updated LaTeX document text');
    });

    it('should reject a suggestion', async () => {
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        ok: true,
        suggestion: { ...mockSuggestions[1], status: 'rejected' },
      } as any);

      const res = await pagesService.suggestions.rejectSuggestion('page-1', 'sugg-2');
      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/pages/docs/page-1/suggestions/sugg-2/reject', {});
      expect(res.ok).toBe(true);
      expect(res.suggestion.status).toBe('rejected');
    });

    it('should accept all pending suggestions and return accepted count & updated page', async () => {
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        ok: true,
        acceptedCount: 2,
        page: { id: 'page-1', content: 'Fully accepted document' },
      } as any);

      const res = await pagesService.suggestions.acceptAllSuggestions('page-1');
      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/pages/docs/page-1/suggestions/batch-resolve', {
        action: 'accept',
      });
      expect(res.ok).toBe(true);
      expect(res.acceptedCount).toBe(2);
      expect(res.page?.content).toBe('Fully accepted document');
    });

    it('should reject all pending suggestions', async () => {
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        ok: true,
        rejectedCount: 2,
      } as any);

      const res = await pagesService.suggestions.rejectAllSuggestions('page-1');
      expect(apiPostSpy).toHaveBeenCalledWith('/api/v1/pages/docs/page-1/suggestions/batch-resolve', {
        action: 'reject',
      });
      expect(res.ok).toBe(true);
      expect(res.rejectedCount).toBe(2);
    });
  });

  describe('2. Review Command Bus & Realtime Sync', () => {
    it('should broadcast and receive suggestion events via editorCommandBus', () => {
      const listener = vi.fn();
      const unsub = editorCommandBus.subscribe('editor:review-event', listener);

      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: 'page-1',
        event: 'suggestion:accepted',
        payload: {
          suggestion: mockSuggestions[0],
          page: { id: 'page-1', content: 'New Content' },
        },
      });

      expect(listener).toHaveBeenCalledWith({
        type: 'editor:review-event',
        pageId: 'page-1',
        event: 'suggestion:accepted',
        payload: {
          suggestion: mockSuggestions[0],
          page: { id: 'page-1', content: 'New Content' },
        },
      });

      unsub();
    });
  });

  describe('3. Track Changes Safe Content Replacement Algorithm', () => {
    function applyReplacement(
      doc: string,
      sugg: { fromLine: number; toLine: number; type: string; suggestedText: string },
    ): string {
      const lines = doc.split('\n');
      const startIdx = Math.max(0, sugg.fromLine - 1);
      const endIdx = Math.min(lines.length - 1, sugg.toLine - 1);

      if (sugg.type === 'delete') {
        lines.splice(startIdx, endIdx - startIdx + 1);
      } else if (sugg.type === 'insert') {
        lines.splice(startIdx, 0, ...sugg.suggestedText.split('\n'));
      } else {
        lines.splice(startIdx, endIdx - startIdx + 1, ...sugg.suggestedText.split('\n'));
      }
      return lines.join('\n');
    }

    it('should accurately insert code at specified line', () => {
      const doc = '\\documentclass{article}\n\\begin{document}\nHello\n\\end{document}';
      const updated = applyReplacement(doc, {
        fromLine: 2,
        toLine: 2,
        type: 'insert',
        suggestedText: '\\usepackage{amsmath}',
      });

      expect(updated).toBe(
        '\\documentclass{article}\n\\usepackage{amsmath}\n\\begin{document}\nHello\n\\end{document}',
      );
    });

    it('should accurately delete target line', () => {
      const doc = 'Line 1\nDraft notes to remove\nLine 3';
      const updated = applyReplacement(doc, {
        fromLine: 2,
        toLine: 2,
        type: 'delete',
        suggestedText: '',
      });

      expect(updated).toBe('Line 1\nLine 3');
    });

    it('should accurately replace multi-line section', () => {
      const doc = 'Line 1\nOld Section A\nOld Section B\nLine 4';
      const updated = applyReplacement(doc, {
        fromLine: 2,
        toLine: 3,
        type: 'replace',
        suggestedText: 'New Section Combined',
      });

      expect(updated).toBe('Line 1\nNew Section Combined\nLine 4');
    });
  });

  describe('4. Realtime Review Sync & Comment Update Regression', () => {
    it('useReviewSync invalidates prefix suggestion queries on track-changes:* and status queries on review:status-changed', () => {
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
          event: 'track-changes:resolved',
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

    it('useUpdateComment omits status when only content is edited', async () => {
      const { useUpdateComment } = await vi.importActual<
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

      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children);

      const { result, unmount } = renderHook(() => useUpdateComment(client), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          pageId: 'doc-cmt-1',
          commentId: 'cmt-1',
          content: 'Edited wording',
        });
      });

      expect(updateSpy).toHaveBeenCalledWith('doc-cmt-1', 'cmt-1', {
        content: 'Edited wording',
      });

      unmount();
      client.clear();
    });

    it('createCommentSchema & createReplySchema accept up to 10000 chars and useUpdateReply invokes comments.updateReply', async () => {
      const maxStr = 'x'.repeat(10000);
      const overStr = 'x'.repeat(10001);
      expect(createCommentSchema.safeParse({ content: maxStr }).success).toBe(true);
      expect(createCommentSchema.safeParse({ content: overStr }).success).toBe(false);
      expect(createReplySchema.safeParse({ content: maxStr }).success).toBe(true);
      expect(createReplySchema.safeParse({ content: overStr }).success).toBe(false);

      const { useUpdateReply } = await vi.importActual<
        typeof import('@/features/editor/subsystems/review/hooks/useComments')
      >('@/features/editor/subsystems/review/hooks/useComments');

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

      const { result, unmount } = renderHook(() => useUpdateReply(client), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
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

      unmount();
      client.clear();
    });
  });
});
