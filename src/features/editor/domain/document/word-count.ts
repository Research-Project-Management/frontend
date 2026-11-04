/**
 * word-count.ts
 *
 * Domain types and lightweight adapters for LaTeX word count statistics.
 * Authoritative TeXcount analysis is executed on the backend via
 * `POST /api/v1/manuscripts/word-count` (`TexWordCounter`).
 */

export interface WordCountSection {
  title: string;
  level: string;
  line: number;
  words: number;
}

export interface WordCountFileStats {
  id: string;
  title: string;
  path?: string;
  words: number;
  wordsInText: number;
  wordsInHeaders: number;
  wordsInCaptions: number;
  wordsInBibliography?: number;
  headers: number;
  floats: number;
  math: number;
  mathInlines: number;
  mathDisplayed: number;
}

export interface TeXcountStats {
  wordsInText: number;
  wordsInHeaders: number;
  wordsInCaptions: number;
  wordsInBibliography?: number;
  headers: number;
  floats: number;
  mathInlines: number;
  mathDisplayed: number;
  totalWords?: number;
  charactersWithSpaces?: number;
  charactersNoSpaces?: number;
  cjkCharacters?: number;
  readingTimeMinutes?: number;
  sections?: WordCountSection[];
  perFileStats?: WordCountFileStats[];
  rawOutput?: string;
}

export type LatexWordCountResult = TeXcountStats;

export interface ProjectTeXcountStats extends TeXcountStats {
  rootFile: string;
  includedFiles: string[];
  byFile: Record<string, TeXcountStats>;
}

export const EMPTY_TEXCOUNT_STATS: TeXcountStats = {
  wordsInText: 0,
  wordsInHeaders: 0,
  wordsInCaptions: 0,
  wordsInBibliography: 0,
  headers: 0,
  floats: 0,
  mathInlines: 0,
  mathDisplayed: 0,
  totalWords: 0,
  charactersWithSpaces: 0,
  charactersNoSpaces: 0,
  cjkCharacters: 0,
  readingTimeMinutes: 0,
  sections: [],
};

/**
 * Lightweight synchronous placeholder/adapter returning empty baseline stats
 * until the backend `manuscriptService.compiler.wordCount` response arrives.
 */
export function countLatexWords(
  _latex?: string,
  _options?: { includeBib?: boolean },
): TeXcountStats {
  return { ...EMPTY_TEXCOUNT_STATS };
}

export function countProjectLatexWords(
  _files: Record<string, string> | Map<string, string>,
  options?: { rootFile?: string; includeBib?: boolean },
): ProjectTeXcountStats {
  return {
    ...EMPTY_TEXCOUNT_STATS,
    rootFile: options?.rootFile || 'main.tex',
    includedFiles: [],
    byFile: {},
  };
}
