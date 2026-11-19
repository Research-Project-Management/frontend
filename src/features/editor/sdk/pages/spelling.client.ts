/**
 * spelling.client.ts
 *
 * Pages Spelling & Custom Dictionaries Sub-API (Part of pagesService SDK).
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';

export interface CustomDictionaryResponse {
  words: string[];
}

export interface SpellingSuggestionResponse {
  word: string;
  suggestions: string[];
}

export interface MisspelledWord {
  word: string;
  line: number;
  col: number;
  length: number;
  suggestions: string[];
}

export interface SpellingReport {
  language: string;
  totalWordsChecked: number;
  misspelledCount: number;
  errors: MisspelledWord[];
}

export interface CheckSpellingPayload {
  text?: string;
  docId?: string;
  language?: string;
}

export const spelling = {
  checkSpelling: async (
    projectId: string,
    payload: CheckSpellingPayload,
  ): Promise<SpellingReport> => {
    try {
      const res = await apiPost<SpellingReport>(
        `${PAGES_API_BASE}/spaces/${projectId}/spelling/check`,
        payload,
      );
      return res;
    } catch {
      return {
        language: payload.language || 'en-US',
        totalWordsChecked: 0,
        misspelledCount: 0,
        errors: [],
      };
    }
  },

  getProjectDictionary: async (projectId: string): Promise<string[]> => {
    try {
      const res = await apiGet<CustomDictionaryResponse>(
        `${PAGES_API_BASE}/spaces/${projectId}/spelling/dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  learnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `${PAGES_API_BASE}/spaces/${projectId}/spelling/dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  unlearnProjectWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `${PAGES_API_BASE}/spaces/${projectId}/spelling/dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },

  getUserDictionary: async (): Promise<string[]> => {
    try {
      const res = await apiGet<CustomDictionaryResponse>(
        `${PAGES_API_BASE}/spelling/user-dictionary`,
      );
      return res?.words || [];
    } catch {
      return [];
    }
  },

  learnUserWord: async (word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `${PAGES_API_BASE}/spelling/user-dictionary/learn`,
      { word },
    );
    return res?.success ?? true;
  },

  unlearnUserWord: async (word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `${PAGES_API_BASE}/spelling/user-dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },

  getSuggestions: async (word: string, language: string = 'en_US'): Promise<string[]> => {
    try {
      const res = await apiGet<SpellingSuggestionResponse>(
        `${PAGES_API_BASE}/spelling/suggestions?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`,
      );
      return res?.suggestions || [];
    } catch {
      return [];
    }
  },
};
