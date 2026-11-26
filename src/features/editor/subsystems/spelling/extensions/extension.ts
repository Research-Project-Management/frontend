/**
 * subsystems/spelling/extensions/extension.ts
 *
 * CodeMirror 6 live spell-check ViewPlugin with debounce, bounded LRU cache,
 * Singleflight request deduplication, stale-response guard, and live cache invalidation.
 */

import type { Extension } from '@codemirror/state';
import { type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { extractLatexWords } from '../model/word-extractor';
import {
  type SpellErrorRange,
  setErrorsEffect,
  unignoreWordEffect,
  clearErrorsEffect,
  spellingStateField,
  spellingTheme,
} from './decorations';
import { createSpellingContextMenu } from './context-menu';

const MAX_CACHE_ENTRIES = 32;
const MAX_WORDS_PER_CHECK = 5000;

const resultCache = new Map<string, SpellErrorRange[]>();
const inFlightChecks = new Map<string, Promise<SpellErrorRange[] | null>>();
const invalidationListeners = new Set<(removedWord?: string) => void>();
let cacheEpoch = 0;

function hashInput(projectId: string, language: string, text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${projectId}|${language}|${text.length}:${hash >>> 0}`;
}

export function resolveSpellingProjectId(explicitProjectId?: string): string {
  const state = usePageStore.getState();
  return explicitProjectId || state.projectId || state.spaceId || '';
}

export function invalidateSpellingCache(
  removedWord?: string,
  projectId?: string,
): void {
  cacheEpoch++;
  if (projectId) {
    const prefix = `${projectId}|`;
    for (const key of resultCache.keys()) {
      if (key.startsWith(prefix)) resultCache.delete(key);
    }
    for (const key of inFlightChecks.keys()) {
      if (key.startsWith(prefix)) inFlightChecks.delete(key);
    }
  } else {
    resultCache.clear();
    inFlightChecks.clear();
  }
  for (const listener of invalidationListeners) {
    listener(removedWord);
  }
}

export interface SpellingExtensionOptions {
  projectId?: string;
  language?: string;
  enabled?: boolean;
}

function createSpellingPlugin(options: SpellingExtensionOptions = {}) {
  const { projectId, language = 'en-US' } = options;

  return ViewPlugin.fromClass(
    class {
      private debounceTimer: ReturnType<typeof setTimeout> | null = null;
      private lastCheckedHash: string | null = null;
      private isDestroyed = false;
      private readonly onCacheInvalidated: (removedWord?: string) => void;

      constructor(readonly view: EditorView) {
        this.onCacheInvalidated = (removedWord?: string) => {
          if (this.isDestroyed) return;
          if (removedWord) {
            this.view.dispatch({ effects: unignoreWordEffect.of(removedWord) });
          }
          this.lastCheckedHash = null;
          this.scheduleCheck(this.view, 50);
        };

        invalidationListeners.add(this.onCacheInvalidated);
        this.scheduleCheck(view, 600);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.scheduleCheck(update.view, 500);
        }
      }

      destroy() {
        this.isDestroyed = true;
        invalidationListeners.delete(this.onCacheInvalidated);
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
      }

      private scheduleCheck(view: EditorView, delayMs: number) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          void this.runCheck(view);
        }, delayMs);
      }

      private async runCheck(view: EditorView) {
        if (this.isDestroyed) return;

        const text = view.state.doc.toString();
        if (!text.trim()) {
          this.lastCheckedHash = '';
          view.dispatch({ effects: clearErrorsEffect.of() });
          return;
        }

        const targetProjectId = resolveSpellingProjectId(projectId);
        if (!targetProjectId) return;

        const cacheKey = hashInput(targetProjectId, language, text);
        if (this.lastCheckedHash === cacheKey) return;

        const cachedRanges = resultCache.get(cacheKey);
        if (cachedRanges) {
          // Refresh LRU recency in O(1)
          resultCache.delete(cacheKey);
          resultCache.set(cacheKey, cachedRanges);
          this.lastCheckedHash = cacheKey;
          view.dispatch({
            effects:
              cachedRanges.length > 0
                ? setErrorsEffect.of(cachedRanges)
                : clearErrorsEffect.of(),
          });
          return;
        }

        try {
          const requestEpoch = cacheEpoch;
          let pending = inFlightChecks.get(cacheKey);
          if (!pending) {
            pending = (async (): Promise<SpellErrorRange[] | null> => {
              try {
                const tokens = extractLatexWords(text);
                if (tokens.length === 0) {
                  if (cacheEpoch === requestEpoch) {
                    resultCache.set(cacheKey, []);
                  }
                  return [];
                }

                const uniqueWords = Array.from(new Set(tokens.map((t) => t.word))).slice(
                  0,
                  MAX_WORDS_PER_CHECK,
                );
                const report = await pagesService.spelling.check(targetProjectId, {
                  words: uniqueWords,
                  language,
                });
                if (!report || !Array.isArray(report.errors)) return null;

                // Match exact case returned by Hunspell (critical for German nouns & proper nouns)
                const suggestionsByWord = new Map<string, string[]>();
                for (const err of report.errors) {
                  if (err.word) {
                    suggestionsByWord.set(err.word, err.suggestions || []);
                  }
                }

                const ranges: SpellErrorRange[] = [];
                if (suggestionsByWord.size > 0) {
                  const docLength = text.length;
                  for (const token of tokens) {
                    const suggestions = suggestionsByWord.get(token.word);
                    if (suggestions === undefined) continue;
                    const from = Math.max(0, Math.min(docLength, token.from));
                    const to = Math.max(from, Math.min(docLength, token.to));
                    if (from < to) {
                      ranges.push({ from, to, word: token.word, suggestions });
                    }
                  }
                }

                if (cacheEpoch === requestEpoch) {
                  if (resultCache.size >= MAX_CACHE_ENTRIES) {
                    const oldestKey = resultCache.keys().next().value;
                    if (oldestKey !== undefined) resultCache.delete(oldestKey);
                  }
                  resultCache.set(cacheKey, ranges);
                }
                return ranges;
              } finally {
                if (inFlightChecks.get(cacheKey) === pending) {
                  inFlightChecks.delete(cacheKey);
                }
              }
            })();
            inFlightChecks.set(cacheKey, pending);
          }

          const rawRanges = await pending;
          if (!rawRanges || this.isDestroyed || cacheEpoch !== requestEpoch) return;

          const currentHash = hashInput(
            targetProjectId,
            language,
            view.state.doc.toString(),
          );
          if (currentHash !== cacheKey) return;

          this.lastCheckedHash = cacheKey;
          view.dispatch({
            effects:
              rawRanges.length > 0
                ? setErrorsEffect.of(rawRanges)
                : clearErrorsEffect.of(),
          });
        } catch {
          // Graceful fallback on transient network error
        }
      }
    },
  );
}

export function createSpellingExtension(options: SpellingExtensionOptions = {}): Extension[] {
  if (options.enabled === false) {
    return [];
  }

  return [
    spellingStateField,
    spellingTheme,
    createSpellingContextMenu(
      () => resolveSpellingProjectId(options.projectId),
      (removedWord) =>
        invalidateSpellingCache(removedWord, resolveSpellingProjectId(options.projectId)),
    ),
    createSpellingPlugin(options),
  ];
}
