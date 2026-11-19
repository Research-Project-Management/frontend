import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '@/shared/lib/api';
import { pagesService } from '@/features/editor/sdk/pages.service';
const spelling = pagesService.spelling;

describe('Spelling & Custom Dictionary (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Project Custom Dictionary', () => {
    it('fetches project learned words', async () => {
      const mockWords = ['antigravity', 'latexmk', 'biber'];
      const apiGetSpy = vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        words: mockWords,
      } as any);

      const words = await spelling.getProjectDictionary('proj-1');

      expect(apiGetSpy).toHaveBeenCalledWith('/api/v1/pages/spaces/proj-1/spelling/dictionary');
      expect(words).toEqual(mockWords);
    });

    it('learns a new project word', async () => {
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        success: true,
        word: 'transformer',
      } as any);

      const success = await spelling.learnProjectWord('proj-1', 'transformer');

      expect(apiPostSpy).toHaveBeenCalledWith(
        '/api/v1/pages/spaces/proj-1/spelling/dictionary/learn',
        { word: 'transformer' },
      );
      expect(success).toBe(true);
    });

    it('unlearns/deletes a word from project dictionary', async () => {
      const apiDeleteSpy = vi.spyOn(api, 'apiDelete').mockResolvedValueOnce({
        success: true,
        removed: true,
        word: 'mistyped',
      } as any);

      const success = await spelling.unlearnProjectWord('proj-1', 'mistyped');

      expect(apiDeleteSpy).toHaveBeenCalledWith(
        '/api/v1/pages/spaces/proj-1/spelling/dictionary/mistyped',
      );
      expect(success).toBe(true);
    });
  });

  describe('User Personal Dictionary', () => {
    it('fetches personal learned words', async () => {
      const mockWords = ['vietnamese', 'phdthesis'];
      const apiGetSpy = vi.spyOn(api, 'apiGet').mockResolvedValueOnce({
        words: mockWords,
      } as any);

      const words = await spelling.getUserDictionary();

      expect(apiGetSpy).toHaveBeenCalledWith('/api/v1/pages/spelling/user-dictionary');
      expect(words).toEqual(mockWords);
    });

    it('learns a user word and unlearns a user word', async () => {
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        success: true,
        word: 'algorithmics',
      } as any);

      await spelling.learnUserWord('algorithmics');
      expect(apiPostSpy).toHaveBeenCalledWith(
        '/api/v1/pages/spelling/user-dictionary/learn',
        { word: 'algorithmics' },
      );

      const apiDeleteSpy = vi.spyOn(api, 'apiDelete').mockResolvedValueOnce({
        success: true,
        removed: true,
        word: 'algorithmics',
      } as any);

      await spelling.unlearnUserWord('algorithmics');
      expect(apiDeleteSpy).toHaveBeenCalledWith(
        '/api/v1/pages/spelling/user-dictionary/algorithmics',
      );
    });
  });
});
