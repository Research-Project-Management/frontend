import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '@/shared/lib/api';
import { spellingService } from '@/features/editor/coordinators/services/spelling.service';

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

      const words = await spellingService.getProjectDictionary('proj-1');

      expect(apiGetSpy).toHaveBeenCalledWith('/api/v1/manuscripts/projects/proj-1/spelling/dictionary');
      expect(words).toEqual(mockWords);
    });

    it('learns a new project word', async () => {
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        success: true,
        word: 'transformer',
      } as any);

      const success = await spellingService.learnProjectWord('proj-1', 'transformer');

      expect(apiPostSpy).toHaveBeenCalledWith(
        '/api/v1/manuscripts/projects/proj-1/spelling/dictionary/learn',
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

      const success = await spellingService.unlearnProjectWord('proj-1', 'mistyped');

      expect(apiDeleteSpy).toHaveBeenCalledWith(
        '/api/v1/manuscripts/projects/proj-1/spelling/dictionary/mistyped',
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

      const words = await spellingService.getUserDictionary();

      expect(apiGetSpy).toHaveBeenCalledWith('/api/v1/manuscripts/spelling/user-dictionary');
      expect(words).toEqual(mockWords);
    });

    it('learns a user word and unlearns a user word', async () => {
      const apiPostSpy = vi.spyOn(api, 'apiPost').mockResolvedValueOnce({
        success: true,
        word: 'algorithmics',
      } as any);

      await spellingService.learnUserWord('algorithmics');
      expect(apiPostSpy).toHaveBeenCalledWith(
        '/api/v1/manuscripts/spelling/user-dictionary/learn',
        { word: 'algorithmics' },
      );

      const apiDeleteSpy = vi.spyOn(api, 'apiDelete').mockResolvedValueOnce({
        success: true,
        removed: true,
        word: 'algorithmics',
      } as any);

      await spellingService.unlearnUserWord('algorithmics');
      expect(apiDeleteSpy).toHaveBeenCalledWith(
        '/api/v1/manuscripts/spelling/user-dictionary/algorithmics',
      );
    });
  });
});
