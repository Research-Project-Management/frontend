/**
 * subsystems/spelling/extensions/extension.ts
 *
 * CodeMirror 6 live spell-check extension composition root.
 * Accepts optional injected seams (`checkWords`, `learnWord`, `getProjectId`, `cache`)
 * for clean DIP & headless testing, defaulting to production SDK/store adapters.
 */

import type { Extension } from '@codemirror/state';
import { type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { toast } from 'sonner';
import { pagesService } from '@/features/editor/sdk/pages.service';
import type { SpellingReport } from '@/features/editor/sdk/pages/spelling.client';
import { resolveEditorScopeFromState } from '@/features/editor/core/coordinator/editor-scope';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import { extractLatexWords } from '../model/word-extractor';
import {
  SpellingCache,
  hashSpellingInput,
  spellingCache,
} from '../model/cache';
import {
  type SpellErrorRange,
  setErrorsEffect,
  unignoreWordEffect,
  clearErrorsEffect,
  spellingStateField,
  spellingTheme,
} from './decorations';
import { createSpellingContextMenu } from './context-menu';

const MAX_WORDS_PER_CHECK = 5000;

export function normalizeSpellLanguage(language?: string | null): string {
  const trimmed = language?.trim();
  if (!trimmed) return 'en-US';
  return trimmed.replace(/_/g, '-');
}

export interface SpellingExtensionOptions {
  projectId?: string;
  language?: string;
  enabled?: boolean;
  cache?: SpellingCache;
  getProjectId?: () => string;
  checkWords?: (projectId: string, words: string[], language: string) => Promise<SpellingReport>;
  learnWord?: (projectId: string, word: string) => Promise<unknown>;
}

function defaultGetSpaceId(explicitSpaceId?: string): string {
  if (explicitSpaceId?.trim()) {
    return explicitSpaceId.trim();
  }
  const scope = resolveEditorScopeFromState(usePageStore.getState());
  return scope.spaceId || (scope.rootPageId ? scope.routeSpaceParam : '');
}

function createSpellingPlugin(config: {
  language: string;
  cache: SpellingCache;
  getProjectId: () => string;
  checkWords: (projectId: string, words: string[], language: string) => Promise<SpellingReport>;
}) {
  const { language, cache, getProjectId, checkWords } = config;

  return ViewPlugin.fromClass(
    class {
      private debounceTimer: ReturnType<typeof setTimeout> | null = null;
      private lastCheckedHash: string | null = null;
      private isDestroyed = false;
      private readonly unsubscribeCache: () => void;

      constructor(readonly view: EditorView) {
        this.unsubscribeCache = cache.subscribe((removedWord?: string) => {
          if (this.isDestroyed) return;
          if (removedWord) {
            this.view.dispatch({ effects: unignoreWordEffect.of(removedWord) });
          }
          this.lastCheckedHash = null;
          this.scheduleCheck(this.view, 50);
        });

        this.scheduleCheck(view, 600);
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.scheduleCheck(update.view, 500);
        }
      }

      destroy() {
        this.isDestroyed = true;
        this.unsubscribeCache();
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

        const targetProjectId = getProjectId();
        if (!targetProjectId) return;

        const cacheKey = hashSpellingInput(targetProjectId, language, text);
        if (this.lastCheckedHash === cacheKey) return;

        const cachedRanges = cache.get(cacheKey);
        if (cachedRanges) {
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
          const requestEpoch = cache.getEpoch();
          const rawRanges = await cache.getOrCompute(cacheKey, requestEpoch, async () => {
            const tokens = extractLatexWords(text);
            if (tokens.length === 0) return [];

            const uniqueWords = Array.from(new Set(tokens.map((t) => t.word))).slice(
              0,
              MAX_WORDS_PER_CHECK,
            );
            const report = await checkWords(targetProjectId, uniqueWords, language);
            if (!report || !Array.isArray(report.errors)) return null;

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
            return ranges;
          });

          if (!rawRanges || this.isDestroyed || cache.getEpoch() !== requestEpoch) return;

          const currentHash = hashSpellingInput(
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

  const language = normalizeSpellLanguage(options.language);
  const cache = options.cache ?? spellingCache;
  const getProjectId = options.getProjectId ?? (() => defaultGetSpaceId(options.projectId));
  const checkWords =
    options.checkWords ??
    ((projId, words, lang) =>
      pagesService.spelling.check(projId, {
        words,
        language: normalizeSpellLanguage(lang),
      }));
  const learnWord =
    options.learnWord ?? ((projId, word) => pagesService.spelling.learnWord(projId, word));

  const handleLearnWord = async (word: string) => {
    const activeProjectId = getProjectId();
    if (!activeProjectId) return;

    try {
      await learnWord(activeProjectId, word);
      cache.invalidate(undefined, activeProjectId);
      toast.success(`Added "${word}" to project dictionary`, { id: `spell-dict-${word}` });
    } catch {
      cache.invalidate(word, activeProjectId);
      toast.error(`Failed to save "${word}" to project dictionary`, {
        id: `spell-dict-${word}`,
      });
    }
  };

  return [
    spellingStateField,
    spellingTheme,
    createSpellingContextMenu(handleLearnWord),
    createSpellingPlugin({ language, cache, getProjectId, checkWords }),
  ];
}
