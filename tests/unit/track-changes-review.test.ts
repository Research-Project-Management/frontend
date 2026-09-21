import { describe, it, expect, vi, beforeEach } from 'vitest';
import { suggestionService } from '@/features/editor/services/suggestion.service';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import type { PageSuggestion, SuggestionType, SuggestionStatus } from '@/features/editor/types';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

import { apiGet, apiPost } from '@/shared/lib/api';

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
      (apiGet as any).mockResolvedValue({ suggestions: mockSuggestions.slice(0, 2) });

      const result = await suggestionService.getSuggestions('page-1', 'pending');
      expect(apiGet).toHaveBeenCalledWith('/api/pages/page-1/suggestions?status=pending');
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('pending');
    });

    it('should create suggestion payload correctly', async () => {
      const newSugg = mockSuggestions[0];
      (apiPost as any).mockResolvedValue({ suggestion: newSugg });

      const result = await suggestionService.createSuggestion({
        pageId: 'page-1',
        type: 'insert',
        suggestedText: '\\usepackage{amsmath}\n',
        fromLine: 2,
        toLine: 2,
        description: 'Add amsmath for equations',
      });

      expect(apiPost).toHaveBeenCalledWith('/api/pages/page-1/suggestions', {
        type: 'insert',
        suggestedText: '\\usepackage{amsmath}\n',
        fromLine: 2,
        toLine: 2,
        description: 'Add amsmath for equations',
      });
      expect(result.id).toBe('sugg-1');
    });

    it('should accept a suggestion and receive updated document content', async () => {
      (apiPost as any).mockResolvedValue({
        ok: true,
        suggestion: { ...mockSuggestions[1], status: 'accepted' },
        page: { id: 'page-1', content: 'Updated LaTeX document text' },
      });

      const res = await suggestionService.acceptSuggestion('page-1', 'sugg-2');
      expect(apiPost).toHaveBeenCalledWith('/api/pages/page-1/suggestions/sugg-2/accept', {});
      expect(res.ok).toBe(true);
      expect(res.suggestion.status).toBe('accepted');
      expect(res.page.content).toBe('Updated LaTeX document text');
    });

    it('should reject a suggestion', async () => {
      (apiPost as any).mockResolvedValue({
        ok: true,
        suggestion: { ...mockSuggestions[1], status: 'rejected' },
      });

      const res = await suggestionService.rejectSuggestion('page-1', 'sugg-2');
      expect(apiPost).toHaveBeenCalledWith('/api/pages/page-1/suggestions/sugg-2/reject', {});
      expect(res.ok).toBe(true);
      expect(res.suggestion.status).toBe('rejected');
    });

    it('should accept all pending suggestions and return accepted count & updated page', async () => {
      (apiPost as any).mockResolvedValue({
        ok: true,
        acceptedCount: 2,
        page: { id: 'page-1', content: 'Fully accepted document' },
      });

      const res = await suggestionService.acceptAllSuggestions('page-1');
      expect(apiPost).toHaveBeenCalledWith('/api/pages/page-1/suggestions/accept-all', {});
      expect(res.ok).toBe(true);
      expect(res.acceptedCount).toBe(2);
      expect(res.page.content).toBe('Fully accepted document');
    });

    it('should reject all pending suggestions', async () => {
      (apiPost as any).mockResolvedValue({
        ok: true,
        rejectedCount: 2,
      });

      const res = await suggestionService.rejectAllSuggestions('page-1');
      expect(apiPost).toHaveBeenCalledWith('/api/pages/page-1/suggestions/reject-all', {});
      expect(res.ok).toBe(true);
      expect(res.rejectedCount).toBe(2);
    });
  });

  describe('2. Review Event Bus & Realtime Sync', () => {
    it('should broadcast and receive suggestion events via EditorEventBus', () => {
      const listener = vi.fn();
      const unsub = EditorEventBus.on('flux:review-event', listener);

      EditorEventBus.emit('flux:review-event', {
        pageId: 'page-1',
        event: 'suggestion:accepted',
        payload: {
          suggestion: mockSuggestions[0],
          page: { id: 'page-1', content: 'New Content' },
        },
      });

      expect(listener).toHaveBeenCalledWith({
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
});
