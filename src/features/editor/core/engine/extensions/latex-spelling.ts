/**
 * latex-spelling.ts
 *
 * CodeMirror 6 Live LaTeX Spell Check Extension (Engines Layer).
 * Location: `features/editor/core/engine/extensions/latex-spelling.ts`
 */

import type { Extension } from '@codemirror/state';
import { type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import type {
  SpellingServicePort,
  SpellingNotificationPort,
} from '@/features/editor/domain/types/ports/spelling.port';
import {
  resolveSpellingService,
  spellingServiceFacet,
  spellingNotifierFacet,
} from '@/features/editor/core/engine/adapters/editor-spelling.port';
import { usePageStore } from '@/features/editor/core/store/editor.store';
import {
  extractLatexWords,
  type ExtractedLatexWord,
} from '@/features/editor/domain/latex/latex-word-extractor';
import {
  type SpellErrorRange,
  setSpellErrorsEffect,
  addIgnoredWordEffect,
  clearSpellErrorsEffect,
  sessionIgnoredWords,
  spellingStateField,
  spellingTheme,
  createSpellingHoverTooltip,
  createSpellingContextMenu,
} from './latex-spelling-ui';

export {
  extractLatexWords,
  setSpellErrorsEffect,
  addIgnoredWordEffect,
  clearSpellErrorsEffect,
  spellingStateField,
  spellingTheme,
  createSpellingHoverTooltip,
  createSpellingContextMenu,
};
export type { ExtractedLatexWord, SpellErrorRange };

const spellingResultCache = new Map<string, SpellErrorRange[]>();
const inFlightSpellingChecks = new Map<string, Promise<SpellErrorRange[] | null>>();

function hashSpellingInput(projectId: string, language: string, text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${projectId}|${language}|${text.length}:${h >>> 0}`;
}

function resetSpellingSessionCache(): void {
  sessionIgnoredWords.clear();
  spellingResultCache.clear();
  inFlightSpellingChecks.clear();
}

export interface LatexSpellingOptions {
  projectId?: string;
  language?: string;
  enabled?: boolean;
  spellingService?: SpellingServicePort;
  notifier?: SpellingNotificationPort;
}

let lastSpellingLanguage: string | null = null;
let lastSpellingProjectId: string | null = null;

function createSpellingViewPlugin(options: LatexSpellingOptions = {}) {
  const { projectId, language = 'en_US', enabled = true, spellingService: customService } = options;

  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null;
      private abortController: AbortController | null = null;
      private lastCheckedHash: string | null = null;

      constructor(readonly view: EditorView) {
        if (enabled) {
          const pageState = usePageStore.getState();
          const targetProjectKey =
            projectId ||
            pageState.spaceId ||
            pageState.parentPageId ||
            pageState.currentPage?.id ||
            '';
          if (
            (lastSpellingLanguage !== null && lastSpellingLanguage !== language) ||
            (lastSpellingProjectId !== null && lastSpellingProjectId !== targetProjectKey)
          ) {
            resetSpellingSessionCache();
          }
          lastSpellingLanguage = language;
          lastSpellingProjectId = targetProjectKey;

          this.scheduleCheck(view, 600);
        }
      }

      update(update: ViewUpdate) {
        if (!enabled) return;
        if (update.docChanged) {
          this.scheduleCheck(update.view, 500);
        }
      }

      destroy() {
        if (this.timer) clearTimeout(this.timer);
        this.abortController?.abort();
      }

      private scheduleCheck(view: EditorView, delay: number) {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          void this.runSpellCheck(view);
        }, delay);
      }

      private async runSpellCheck(view: EditorView) {
        const text = view.state.doc.toString();
        if (!text.trim()) {
          this.lastCheckedHash = '';
          view.dispatch({ effects: clearSpellErrorsEffect.of() });
          return;
        }

        if (process.env.NODE_ENV === 'test') {
          return;
        }

        const pageState = usePageStore.getState();
        const targetProj =
          projectId ||
          pageState.spaceId ||
          pageState.parentPageId ||
          pageState.currentPage?.id ||
          '';
        if (!targetProj) {
          return;
        }
        const inputHash = hashSpellingInput(targetProj, language, text);
        if (this.lastCheckedHash === inputHash) {
          return;
        }

        const cachedRanges = spellingResultCache.get(inputHash);
        if (cachedRanges) {
          this.lastCheckedHash = inputHash;
          const filtered = cachedRanges.filter((r) => !sessionIgnoredWords.has(r.word.toLowerCase()));
          view.dispatch({
            effects:
              filtered.length > 0 ? setSpellErrorsEffect.of(filtered) : clearSpellErrorsEffect.of(),
          });
          return;
        }

        try {
          this.abortController?.abort();
          this.abortController = new AbortController();

          const svc = resolveSpellingService(view, customService);
          let checkPromise = inFlightSpellingChecks.get(inputHash);
          if (!checkPromise) {
            checkPromise = (async (): Promise<SpellErrorRange[] | null> => {
              try {
                const report = await svc.checkSpelling(targetProj, {
                  text,
                  language,
                });
                if (!report || !Array.isArray(report.errors)) return null;
                const doc = view.state.doc;
                const rawRanges: SpellErrorRange[] = [];
                for (const err of report.errors) {
                  const lower = (err.word || '').toLowerCase();
                  if (!lower) continue;

                  const lineNo = Math.max(1, Math.min(doc.lines, err.line || 1));
                  const lineObj = doc.line(lineNo);
                  const colOffset = Math.max(0, (err.col || 1) - 1);
                  const from = Math.min(lineObj.to, lineObj.from + colOffset);
                  const len = err.length || err.word.length;
                  const to = Math.min(lineObj.to, from + len);

                  if (from < to) {
                    rawRanges.push({
                      from,
                      to,
                      word: err.word,
                      suggestions: err.suggestions || [],
                    });
                  }
                }
                if (spellingResultCache.size >= 32) {
                  const oldestKey = spellingResultCache.keys().next().value;
                  if (oldestKey !== undefined) {
                    spellingResultCache.delete(oldestKey);
                  }
                }
                spellingResultCache.set(inputHash, rawRanges);
                return rawRanges;
              } finally {
                inFlightSpellingChecks.delete(inputHash);
              }
            })();
            inFlightSpellingChecks.set(inputHash, checkPromise);
          }

          const rawRanges = await checkPromise;
          if (!rawRanges) return;

          this.lastCheckedHash = inputHash;
          const spellRanges = rawRanges.filter((r) => !sessionIgnoredWords.has(r.word.toLowerCase()));

          view.dispatch({
            effects:
              spellRanges.length > 0
                ? setSpellErrorsEffect.of(spellRanges)
                : clearSpellErrorsEffect.of(),
          });
        } catch {
          // Graceful fallback on network glitch
        }
      }
    },
  );
}

export function createLatexSpellingExtension(options: LatexSpellingOptions = {}): Extension[] {
  if (options.enabled === false) {
    return [];
  }

  const ports = {
    spellingService: options.spellingService,
    notifier: options.notifier,
  };

  const extensions: Extension[] = [
    spellingStateField,
    spellingTheme,
    createSpellingContextMenu(options.projectId, ports),
    createSpellingViewPlugin(options),
  ];

  if (options.spellingService) {
    extensions.push(spellingServiceFacet.of(options.spellingService));
  }
  if (options.notifier) {
    extensions.push(spellingNotifierFacet.of(options.notifier));
  }

  return extensions;
}
