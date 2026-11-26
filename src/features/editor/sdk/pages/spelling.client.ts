/**
 * spelling.client.ts
 *
 * Pages Spelling & Project Dictionary Sub-API (Part of pagesService SDK).
 */

import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';
import { PAGES_API_BASE } from './base';

export interface CustomDictionaryResponse {
  words: string[];
  count: number;
}

export interface MisspelledWord {
  word: string;
  suggestions: string[];
}

export interface SpellingReport {
  language: string;
  totalWordsChecked: number;
  misspelledCount: number;
  errors: MisspelledWord[];
}

export interface CheckSpellingPayload {
  words: string[];
  language?: string;
}

const spaceSpellingBase = (projectId: string) =>
  `${PAGES_API_BASE}/spaces/${encodeURIComponent(projectId)}/spelling`;

export const spelling = {
  check: (
    projectId: string,
    payload: CheckSpellingPayload,
  ): Promise<SpellingReport> =>
    apiPost<SpellingReport>(`${spaceSpellingBase(projectId)}/check`, payload),

  listDictionary: async (projectId: string): Promise<string[]> => {
    const res = await apiGet<CustomDictionaryResponse>(
      `${spaceSpellingBase(projectId)}/dictionary`,
    );
    return res?.words || [];
  },

  learnWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiPost<{ success: boolean; word: string }>(
      `${spaceSpellingBase(projectId)}/dictionary`,
      { word },
    );
    return res?.success ?? true;
  },

  unlearnWord: async (projectId: string, word: string): Promise<boolean> => {
    const res = await apiDelete<{ success: boolean; removed: boolean; word: string }>(
      `${spaceSpellingBase(projectId)}/dictionary/${encodeURIComponent(word)}`,
    );
    return res?.success ?? true;
  },
};
