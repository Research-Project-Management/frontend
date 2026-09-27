/**
 * spelling.service.ts
 *
 * Frontend client for Manuscripts Spelling & Custom Dictionaries:
 * - Check document spelling
 * - Get candidate suggestions
 * - Manage learned words (List, Add, Remove) for Project & User dictionaries
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';

export interface CustomDictionaryResponse {
  words: string[];
}

export interface SpellingSuggestionResponse {
  word: string;
  suggestions: string[];
}

export const spellingService = {
  /**
   * List custom words learned for a specific project.
   */
  getProjectDictionary: async (projectId: string): Promise<string[]> => {
    try {
      const res = await apiGet<CustomDictionaryResponse>(
        `/api/v1/manuscripts/projects/${projectId}/spelling/dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  /**
   * Add a word to the project's custom dictionary.
   */
  learnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `/api/v1/manuscripts/projects/${projectId}/spelling/dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  /**
   * Remove a word from the project's custom dictionary.
   */
  unlearnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `/api/v1/manuscripts/projects/${projectId}/spelling/dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },

  /**
   * List personal custom words learned across all projects for the current user.
   */
  getUserDictionary: async (): Promise<string[]> => {
    try {
      const res = await apiGet<CustomDictionaryResponse>(
        `/api/v1/manuscripts/spelling/user-dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  /**
   * Add a word to the user's personal dictionary.
   */
  learnUserWord: async (word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `/api/v1/manuscripts/spelling/user-dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  /**
   * Remove a word from the user's personal dictionary.
   */
  unlearnUserWord: async (word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `/api/v1/manuscripts/spelling/user-dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },

  /**
   * Get suggestions for a misspelled word.
   */
  getSuggestions: async (word: string, language: string = 'en_US'): Promise<string[]> => {
    try {
      const res = await apiGet<SpellingSuggestionResponse>(
        `/api/v1/manuscripts/spelling/suggestions?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`,
      );
      return res?.suggestions || [];
    } catch {
      return [];
    }
  },
};
