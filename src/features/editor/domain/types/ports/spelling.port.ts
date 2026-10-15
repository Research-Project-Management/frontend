/**
 * spelling.port.ts
 *
 * Pure Domain Port contracts for Spelling Service and Notifications.
 * Location: `features/editor/domain/types/ports/spelling.port.ts`
 *
 * Matt Pocock Codebase Design principles:
 * - Pure Domain contracts without SDK, UI, or framework dependencies.
 * - Deep module boundaries: decouples CodeMirror extensions from network/UI singletons.
 * - Testable: allows unit testing spellcheck extensions with in-memory test doubles.
 */

export interface MisspelledWordDomain {
  word: string;
  line?: number;
  col?: number;
  length?: number;
  suggestions?: string[];
}

export interface SpellingReportDomain {
  language: string;
  totalWordsChecked: number;
  misspelledCount: number;
  errors: MisspelledWordDomain[];
}

export interface CheckSpellingPayloadDomain {
  text?: string;
  docId?: string;
  language?: string;
}

export interface SpellingServicePort {
  getProjectDictionary(projectId: string): Promise<string[]>;
  getUserDictionary(): Promise<string[]>;
  learnProjectWord(projectId: string, word: string): Promise<unknown>;
  checkSpelling(
    projectId: string,
    payload: CheckSpellingPayloadDomain,
  ): Promise<SpellingReportDomain | null>;
}

export interface SpellingNotificationPort {
  success(message: string, options?: { id?: string }): void;
  error?(message: string, options?: { id?: string }): void;
}
