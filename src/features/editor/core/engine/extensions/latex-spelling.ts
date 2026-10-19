/**
 * latex-spelling.ts
 *
 * CodeMirror 6 Live LaTeX Spell Check Extension (Engines Layer).
 * Location: `features/editor/engines/extensions/latex-spelling.ts`
 *
 * Architecture & Overleaf Parity:
 * - Highlights misspelled words with a red wavy underline (cm-spell-error).
 * - Intelligently filters out LaTeX syntax, macros (\command), math environments ($...$, \begin{equation}),
 *   citation keys (\cite{key}), labels (\ref{label}), and comments (%).
 * - Provides interactive hover tooltip with:
 *   1. Candidate replacement suggestions (1-click auto-replace)
 *   2. "Add to Project Dictionary" action (saves via spellingService)
 *   3. "Ignore" for the current session (0ms immediate clearing)
 * - Caches validated words locally for 60fps typing performance.
 */

import {
  StateField,
  StateEffect,
  RangeSetBuilder,
  type Extension,
  type Transaction,
} from '@codemirror/state';
import {
  EditorView,
  Decoration,
  type DecorationSet,
  ViewPlugin,
  type ViewUpdate,
  hoverTooltip,
  type Tooltip,
} from '@codemirror/view';
import type {
  SpellingServicePort,
  SpellingNotificationPort,
} from '@/features/editor/domain/types/ports/spelling.port';
import {
  resolveSpellingService,
  resolveSpellingNotifier,
  spellingServiceFacet,
  spellingNotifierFacet,
} from '@/features/editor/core/engine/adapters/editor-spelling-port';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── State Effects ─────────────────────────────────────────────────────────────

export interface SpellErrorRange {
  from: number;
  to: number;
  word: string;
  suggestions: string[];
}

export const setSpellErrorsEffect = StateEffect.define<SpellErrorRange[]>();
export const addIgnoredWordEffect = StateEffect.define<string>();
export const clearSpellErrorsEffect = StateEffect.define<void>();

// ── Shared Session Dictionaries & Caches ───────────────────────────────────────

const sessionIgnoredWords = new Set<string>([
  'overleaf', 'latex', 'pdflatex', 'xelatex', 'lualatex', 'bibtex', 'biber',
  'et', 'al', 'arxiv', 'doi', 'rgb', 'rgba', 'cpu', 'gpu', 'api', 'url',
  'fig', 'tab', 'eq', 'sec', 'algo', 'auth', 'init', 'impl', 'repo',
]);

const MAX_WORD_VALIDITY_CACHE_SIZE = 5000;
const MAX_WORD_SUGGESTIONS_CACHE_SIZE = 1000;

const wordValidityCache = new Map<string, boolean>();
const wordSuggestionsCache = new Map<string, string[]>();

export function setWordValidityBounded(word: string, isValid: boolean): void {
  if (wordValidityCache.size >= MAX_WORD_VALIDITY_CACHE_SIZE && !wordValidityCache.has(word)) {
    const oldestKey = wordValidityCache.keys().next().value;
    if (oldestKey) wordValidityCache.delete(oldestKey);
  }
  wordValidityCache.set(word, isValid);
}

export function setWordSuggestionsBounded(word: string, suggestions: string[]): void {
  if (wordSuggestionsCache.size >= MAX_WORD_SUGGESTIONS_CACHE_SIZE && !wordSuggestionsCache.has(word)) {
    const oldestKey = wordSuggestionsCache.keys().next().value;
    if (oldestKey) wordSuggestionsCache.delete(oldestKey);
  }
  wordSuggestionsCache.set(word, suggestions);
}

export function clearSpellingCaches(): void {
  wordValidityCache.clear();
  wordSuggestionsCache.clear();
}

// Reusable Uint8Array buffer pool to eliminate high-frequency allocations during typing
let sharedMaskBuffer = new Uint8Array(65536);

function getMaskBuffer(len: number): Uint8Array {
  if (sharedMaskBuffer.length < len) {
    const nextSize = Math.max(len, sharedMaskBuffer.length * 2);
    sharedMaskBuffer = new Uint8Array(nextSize);
  }
  const mask = sharedMaskBuffer.subarray(0, len);
  mask.fill(0);
  return mask;
}

// ── LaTeX Word Filter & Tokenizer ─────────────────────────────────────────────

const SPELL_MATH_REGEX = /(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|(?<!\\)\$[^$\n]+(?<!\\)\$|\\\(.*?\\\)|\s*\\\[[\s\S]*?\\\]/g;
const SPELL_ENV_REGEX = /\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|verbatim|lstlisting|minted)\}[\s\S]*?\\end\{\1\}/g;
const SPELL_CMD_ARG_REGEX = /\\(?:cite[a-z]*|ref|eqref|label|input|include|usepackage|documentclass|bibliographystyle|bibliography)\*?(?:\[[^\]]*\])*\{([^}]+)\}/gi;
const SPELL_GENERIC_CMD_REGEX = /\\[a-zA-Z@]+(?:\*?)/g;
const SPELL_BIB_ENTRY_REGEX = /@[a-zA-Z]+\s*\{[^,\s]+,/g;
const SPELL_BIB_FIELD_KEY_REGEX = /(?:^|[\n,])\s*([a-zA-Z_][a-zA-Z0-9_-]*)\s*=/g;
const SPELL_BIB_IGNORED_FIELD_REGEX = /(?:author|editor|doi|url|eprint|isbn|issn|biburl|file|archiveprefix|primaryclass)\s*=\s*(?:\{[\s\S]*?\}|"[^"]*")/gi;
const SPELL_WORD_REGEX = /[\p{L}]{2,}(?:['’][\p{L}]+)?/gu;

/**
 * Extracts natural language words from LaTeX document while skipping
 * math, macros, citation keys, labels, and comments.
 */
export function extractLatexWords(text: string): Array<{ word: string; from: number; to: number }> {
  const words: Array<{ word: string; from: number; to: number }> = [];
  const len = text.length;
  if (len === 0) return words;

  // Mask non-text ranges: comments, math, verbatim, and commands (pooled buffer)
  const mask = getMaskBuffer(len); // 1 = skip

  // 1. Mask comments: % until end of line (unless escaped as \%)
  let i = 0;
  while (i < len) {
    if (text[i] === '%') {
      let backslashes = 0;
      let k = i - 1;
      while (k >= 0 && text[k] === '\\') {
        backslashes++;
        k--;
      }
      if (backslashes % 2 === 0) {
        while (i < len && text[i] !== '\n') {
          mask[i] = 1;
          i++;
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  // 2. Mask display math ($$ ... $$) and inline math ($ ... $) (ignoring escaped \$)
  SPELL_MATH_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPELL_MATH_REGEX.exec(text)) !== null) {
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (k < len) mask[k] = 1;
    }
  }

  // 3. Mask math & code environments: \begin{equation}... \end{equation}, etc.
  SPELL_ENV_REGEX.lastIndex = 0;
  while ((m = SPELL_ENV_REGEX.exec(text)) !== null) {
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (k < len) mask[k] = 1;
    }
  }

  // 4. Mask commands and their macro arguments: \cite{...}, \ref{...}, \label{...}, \input{...}, \usepackage{...}
  SPELL_CMD_ARG_REGEX.lastIndex = 0;
  while ((m = SPELL_CMD_ARG_REGEX.exec(text)) !== null) {
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (k < len) mask[k] = 1;
    }
  }

  // 5. Mask generic commands: \textbf, \section, \item, etc.
  SPELL_GENERIC_CMD_REGEX.lastIndex = 0;
  while ((m = SPELL_GENERIC_CMD_REGEX.exec(text)) !== null) {
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (k < len) mask[k] = 1;
    }
  }

  // 5b. Mask BibTeX entry declarations and citation keys: @article{loshchilov2017decoupled, etc.
  SPELL_BIB_ENTRY_REGEX.lastIndex = 0;
  while ((m = SPELL_BIB_ENTRY_REGEX.exec(text)) !== null) {
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (k < len) mask[k] = 1;
    }
  }

  // 5c. Mask BibTeX field names: author =, title =, journal =, etc.
  SPELL_BIB_FIELD_KEY_REGEX.lastIndex = 0;
  while ((m = SPELL_BIB_FIELD_KEY_REGEX.exec(text)) !== null) {
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (k < len) mask[k] = 1;
    }
  }

  // 5d. Mask BibTeX identifier/metadata field contents (authors, URLs, DOIs, eprints, etc.)
  SPELL_BIB_IGNORED_FIELD_REGEX.lastIndex = 0;
  while ((m = SPELL_BIB_IGNORED_FIELD_REGEX.exec(text)) !== null) {
    for (let k = m.index; k < m.index + m[0].length; k++) {
      if (k < len) mask[k] = 1;
    }
  }

  // 6. Tokenize remaining natural language words (Unicode-aware for multi-language & Vietnamese)
  SPELL_WORD_REGEX.lastIndex = 0;
  while ((m = SPELL_WORD_REGEX.exec(text)) !== null) {
    const from = m.index;
    const to = from + m[0].length;
    // Ensure no character of this word was masked
    let isMasked = false;
    for (let k = from; k < to; k++) {
      if (mask[k] === 1) {
        isMasked = true;
        break;
      }
    }
    if (!isMasked) {
      words.push({ word: m[0], from, to });
    }
  }

  return words;
}

// ── StateField for Misspelled Word Highlights ─────────────────────────────────

const spellErrorMark = (word: string, suggestions: string[]) =>
  Decoration.mark({
    class: 'cm-spell-error',
    attributes: {
      'data-spell-word': word,
      'data-spell-suggestions': suggestions.join(','),
    },
  });

export const spellingStateField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(errors, tr: Transaction) {
    errors = errors.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setSpellErrorsEffect)) {
        const builder = new RangeSetBuilder<Decoration>();
        // Ranges must be added in strictly sorted order
        const sorted = [...effect.value].sort((a, b) => a.from - b.from);
        for (const item of sorted) {
          if (item.from < item.to && item.to <= tr.newDoc.length) {
            builder.add(item.from, item.to, spellErrorMark(item.word, item.suggestions));
          }
        }
        errors = builder.finish();
      } else if (effect.is(addIgnoredWordEffect)) {
        sessionIgnoredWords.add(effect.value.toLowerCase());
        setWordValidityBounded(effect.value.toLowerCase(), true);
        wordSuggestionsCache.delete(effect.value.toLowerCase());
        // Filter out decorations for the now-ignored word
        const newBuilder = new RangeSetBuilder<Decoration>();
        const iter = errors.iter();
        while (iter.value !== null) {
          const spec = iter.value.spec as { attributes?: Record<string, string> };
          const wordAttr = spec.attributes?.['data-spell-word'];
          if (wordAttr && wordAttr.toLowerCase() !== effect.value.toLowerCase()) {
            newBuilder.add(iter.from, iter.to, iter.value);
          }
          iter.next();
        }
        errors = newBuilder.finish();
      } else if (effect.is(clearSpellErrorsEffect)) {
        errors = Decoration.none;
      }
    }
    return errors;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Hover Tooltip: Quick Fixes & Learn Word ───────────────────────────────────

export function createSpellingHoverTooltip(
  projectId?: string,
  ports?: { spellingService?: SpellingServicePort; notifier?: SpellingNotificationPort }
): Extension {
  return hoverTooltip((view, pos, side): Tooltip | null => {
    const { state } = view;
    const decorations = state.field(spellingStateField, false);
    if (!decorations) return null;

    let targetRange: { from: number; to: number; word: string; suggestions: string[] } | null = null;

    decorations.between(pos, pos, (from, to, value) => {
      const spec = value.spec as { attributes?: Record<string, string> };
      const word = spec.attributes?.['data-spell-word'];
      const rawSug = spec.attributes?.['data-spell-suggestions'];
      if (word && pos >= from && pos <= to) {
        targetRange = {
          from,
          to,
          word,
          suggestions: rawSug ? rawSug.split(',').filter(Boolean) : [],
        };
        return false;
      }
    });

    const activeRange = targetRange as { from: number; to: number; word: string; suggestions: string[] } | null;
    if (!activeRange) return null;

    const { from, to, word, suggestions } = activeRange;

    return {
      pos: from,
      end: to,
      above: true,
      arrow: true,
      create: () => {
        const dom = document.createElement('div');
        dom.className =
          'p-2.5 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 text-12 font-sans select-none space-y-2 min-w-52 max-w-72 z-50 animate-in fade-in-50 zoom-in-95';

        // Title
        const header = document.createElement('div');
        header.className = 'flex items-center gap-1.5 font-medium text-foreground';
        header.innerHTML = `
          <span class="size-2 rounded-full bg-destructive shrink-0"></span>
          <span>Spelling: <code class="font-mono text-destructive font-semibold">${escapeHtml(word)}</code></span>
        `;
        dom.appendChild(header);

        // Suggestions
        if (suggestions.length > 0) {
          const sugLabel = document.createElement('div');
          sugLabel.className = 'text-11 text-muted-foreground font-medium';
          sugLabel.textContent = 'Suggestions:';
          dom.appendChild(sugLabel);

          const list = document.createElement('div');
          list.className = 'flex flex-wrap gap-1';

          suggestions.slice(0, 5).forEach((sug) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className =
              'px-2 py-1 text-12 rounded-sm bg-muted hover:bg-muted/80 text-foreground font-mono transition-colors cursor-pointer border border-border';
            btn.textContent = sug;
            btn.title = `Replace with "${sug}"`;
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              view.dispatch({
                changes: { from, to, insert: sug },
                userEvent: 'input.complete.spelling',
              });
            };
            list.appendChild(btn);
          });
          dom.appendChild(list);
        } else {
          const noSug = document.createElement('div');
          noSug.className = 'text-11 italic text-muted-foreground';
          noSug.textContent = 'No suggestions found';
          dom.appendChild(noSug);
        }

        // Action Buttons
        const actions = document.createElement('div');
        actions.className = 'pt-1.5 border-t border-border flex items-center justify-between gap-2';

        // 1. Add to dictionary
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className =
          'text-11 px-2 py-0.5 rounded-sm bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors cursor-pointer';
        addBtn.textContent = 'Add to dictionary';
        addBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          view.dispatch({
            effects: addIgnoredWordEffect.of(word),
          });
          if (projectId) {
            try {
              const svc = resolveSpellingService(view, ports?.spellingService);
              const notif = resolveSpellingNotifier(view, ports?.notifier);
              await svc.learnProjectWord(projectId, word);
              notif.success(`Added "${word}" to project dictionary`, { id: `spell-dict-${word}` });
            } catch {
              // Gracefully learned in session via effect
            }
          }
        };
        actions.appendChild(addBtn);

        // 2. Ignore in document
        const ignoreBtn = document.createElement('button');
        ignoreBtn.type = 'button';
        ignoreBtn.className =
          'text-11 px-2 py-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer';
        ignoreBtn.textContent = 'Ignore';
        ignoreBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          view.dispatch({
            effects: addIgnoredWordEffect.of(word),
          });
        };
        actions.appendChild(ignoreBtn);

        dom.appendChild(actions);
        return { dom };
      },
    };
  });
}

// ── ViewPlugin: Background Document Spell Checker ─────────────────────────────

export interface LatexSpellingOptions {
  projectId?: string;
  language?: string;
  enabled?: boolean;
  spellingService?: SpellingServicePort;
  notifier?: SpellingNotificationPort;
}

let lastSpellingLanguage: string | null = null;

export function createSpellingViewPlugin(options: LatexSpellingOptions = {}) {
  const { projectId, language = 'en_US', enabled = true, spellingService: customService } = options;

  return ViewPlugin.fromClass(
    class {
      private timer: ReturnType<typeof setTimeout> | null = null;
      private abortController: AbortController | null = null;

      constructor(readonly view: EditorView) {
        if (enabled) {
          if (lastSpellingLanguage !== null && lastSpellingLanguage !== language) {
            clearSpellingCaches();
          }
          lastSpellingLanguage = language;

          const svc = resolveSpellingService(view, customService);
          // Pre-hydrate project and user custom dictionaries into session caches
          if (projectId) {
            void svc.getProjectDictionary(projectId).then((dictWords) => {
              if (Array.isArray(dictWords)) {
                dictWords.forEach((w) => {
                  const lower = w.toLowerCase();
                  sessionIgnoredWords.add(lower);
                  setWordValidityBounded(lower, true);
                  wordSuggestionsCache.delete(lower);
                });
              }
            }).catch(() => {});
          }
          void svc.getUserDictionary().then((dictWords) => {
            if (Array.isArray(dictWords)) {
              dictWords.forEach((w) => {
                const lower = w.toLowerCase();
                sessionIgnoredWords.add(lower);
                setWordValidityBounded(lower, true);
                wordSuggestionsCache.delete(lower);
              });
            }
          }).catch(() => {});

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
          view.dispatch({ effects: clearSpellErrorsEffect.of() });
          return;
        }

        const words = extractLatexWords(text);
        if (words.length === 0) {
          view.dispatch({ effects: clearSpellErrorsEffect.of() });
          return;
        }

        // If in test mode, return quickly without network
        if (process.env.NODE_ENV === 'test') {
          return;
        }

        // Identify candidate words that have not been checked yet
        const unverifiedWords = words.filter(({ word }) => {
          const lower = word.toLowerCase();
          if (sessionIgnoredWords.has(lower)) return false;
          return !wordValidityCache.has(lower);
        });

        // Fast-path: If all words in the document are already in cache, evaluate locally in 0ms!
        if (unverifiedWords.length === 0) {
          const spellRanges: SpellErrorRange[] = [];
          for (const item of words) {
            const lower = item.word.toLowerCase();
            if (wordValidityCache.get(lower) === false && !sessionIgnoredWords.has(lower)) {
              spellRanges.push({
                from: item.from,
                to: item.to,
                word: item.word,
                suggestions: wordSuggestionsCache.get(lower) || [],
              });
            }
          }

          view.dispatch({
            effects: spellRanges.length > 0 ? setSpellErrorsEffect.of(spellRanges) : clearSpellErrorsEffect.of(),
          });
          return;
        }

        try {
          this.abortController?.abort();
          this.abortController = new AbortController();

          // Call backend spelling service for unverified text
          const svc = resolveSpellingService(view, customService);
          const targetProj = projectId || 'default';
          const report = await svc.checkSpelling(targetProj, {
            text,
            language,
          });

          if (!report || !Array.isArray(report.errors)) return;

          const errorMap = new Map<string, string[]>();
          report.errors.forEach((err) => {
            const lower = err.word.toLowerCase();
            errorMap.set(lower, err.suggestions || []);
            setWordSuggestionsBounded(lower, err.suggestions || []);
            setWordValidityBounded(lower, false);
          });

          // Mark checked unverified words that had no errors as valid in cache
          unverifiedWords.forEach(({ word }) => {
            const lower = word.toLowerCase();
            if (!errorMap.has(lower)) {
              setWordValidityBounded(lower, true);
            }
          });

          const spellRanges: SpellErrorRange[] = [];
          for (const item of words) {
            const lower = item.word.toLowerCase();
            if (wordValidityCache.get(lower) === false && !sessionIgnoredWords.has(lower)) {
              spellRanges.push({
                from: item.from,
                to: item.to,
                word: item.word,
                suggestions: wordSuggestionsCache.get(lower) || [],
              });
            }
          }

          view.dispatch({
            effects: spellRanges.length > 0 ? setSpellErrorsEffect.of(spellRanges) : clearSpellErrorsEffect.of(),
          });
        } catch {
          // Graceful fallback on network glitch
        }
      }
    },
  );
}

// ── Context Menu: Right-Click Quick Fixes & Add to Dictionary (Overleaf Parity) ──

export function createSpellingContextMenu(
  projectId?: string,
  ports?: { spellingService?: SpellingServicePort; notifier?: SpellingNotificationPort }
): Extension {
  let activeMenuEl: HTMLDivElement | null = null;
  let listenersAttached = false;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') removeMenu();
  };

  const removeMenu = () => {
    if (activeMenuEl) {
      activeMenuEl.remove();
      activeMenuEl = null;
    }
    if (listenersAttached && typeof window !== 'undefined') {
      window.removeEventListener('click', removeMenu, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      listenersAttached = false;
    }
  };

  const attachWindowListeners = () => {
    if (!listenersAttached && typeof window !== 'undefined') {
      window.addEventListener('click', removeMenu, { capture: true });
      window.addEventListener('keydown', handleKeyDown);
      listenersAttached = true;
    }
  };

  return [
    EditorView.domEventHandlers({
      contextmenu(e, view) {
        removeMenu();

      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return false;

      const decorations = view.state.field(spellingStateField, false);
      if (!decorations) return false;

      let targetRange: { from: number; to: number; word: string; suggestions: string[] } | null = null;

      decorations.between(pos, pos, (from, to, value) => {
        const spec = value.spec as { attributes?: Record<string, string> };
        const word = spec.attributes?.['data-spell-word'];
        const rawSug = spec.attributes?.['data-spell-suggestions'];
        if (word && pos >= from && pos <= to) {
          targetRange = {
            from,
            to,
            word,
            suggestions: rawSug ? rawSug.split(',').filter(Boolean) : [],
          };
          return false;
        }
      });

      const activeRange = targetRange as { from: number; to: number; word: string; suggestions: string[] } | null;
      if (!activeRange) return false;

      e.preventDefault();
      e.stopPropagation();

      const { from, to, word, suggestions } = activeRange;

      const menu = document.createElement('div');
      menu.className =
        'fixed p-2 rounded-md border border-border bg-popover text-popover-foreground shadow-overlay text-xs font-sans select-none space-y-1.5 min-w-48 max-w-64 z-[9999] animate-in fade-in-50 zoom-in-95';
      menu.style.left = `${Math.min(e.clientX, window.innerWidth - 220)}px`;
      menu.style.top = `${Math.min(e.clientY, window.innerHeight - 200)}px`;

      // Header
      const header = document.createElement('div');
      header.className =
        'px-1.5 py-0.5 flex items-center gap-1.5 text-11 font-medium text-muted-foreground border-b border-border/60 pb-1.5';
      header.innerHTML = `
        <span class="size-1.5 rounded-full bg-destructive shrink-0"></span>
        <span>Spelling: <code class="font-mono text-destructive font-semibold">${escapeHtml(word)}</code></span>
      `;
      menu.appendChild(header);

      // Suggestions
      if (suggestions.length > 0) {
        const sugContainer = document.createElement('div');
        sugContainer.className = 'space-y-0.5 py-0.5';

        suggestions.slice(0, 4).forEach((sug) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className =
            'w-full text-left px-2 py-1 rounded-md text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer flex items-center justify-between';
          item.innerHTML = `<span>${escapeHtml(sug)}</span><span class="text-[10px] text-muted-foreground">Replace</span>`;
          item.onclick = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            view.dispatch({
              changes: { from, to, insert: sug },
              userEvent: 'input.complete.spelling',
            });
            removeMenu();
            view.focus();
          };
          sugContainer.appendChild(item);
        });
        menu.appendChild(sugContainer);
      }

      // Actions Divider & Buttons
      const actions = document.createElement('div');
      actions.className = 'pt-1 border-t border-border/60 space-y-0.5';

      // 1. Add to Dictionary (Overleaf Parity)
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className =
        'w-full text-left px-2 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-1.5';
      addBtn.innerHTML = `
        <svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        <span>Add to project dictionary</span>
      `;
      addBtn.onclick = async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        view.dispatch({
          effects: addIgnoredWordEffect.of(word),
        });
        removeMenu();
        view.focus();
        const svc = resolveSpellingService(view, ports?.spellingService);
        const notif = resolveSpellingNotifier(view, ports?.notifier);
        if (projectId) {
          try {
            await svc.learnProjectWord(projectId, word);
            notif.success(`Added "${word}" to project dictionary`, { id: `spell-dict-${word}` });
          } catch {
            notif.success(`Learned "${word}" in project`, { id: `spell-dict-${word}` });
          }
        } else {
          notif.success(`Learned "${word}" in session`, { id: `spell-dict-${word}` });
        }
      };
      actions.appendChild(addBtn);

      // 2. Ignore Word in session
      const ignoreBtn = document.createElement('button');
      ignoreBtn.type = 'button';
      ignoreBtn.className =
        'w-full text-left px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer';
      ignoreBtn.textContent = 'Ignore in this document';
      ignoreBtn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        view.dispatch({
          effects: addIgnoredWordEffect.of(word),
        });
        removeMenu();
        view.focus();
      };
      actions.appendChild(ignoreBtn);

      menu.appendChild(actions);

      document.body.appendChild(menu);
      activeMenuEl = menu;
      attachWindowListeners();
      return true;
    },
  }),
  ViewPlugin.fromClass(
    class {
      destroy() {
        removeMenu();
      }
    }
  ),
];
}

// ── Typography & Theme ────────────────────────────────────────────────────────

export const spellingTheme = EditorView.baseTheme({
  '.cm-spell-error': {
    textDecoration: 'underline wavy #ef4444',
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '2.5px',
    cursor: 'text',
  },
});

// ── Complete Extension Assembly ───────────────────────────────────────────────

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
    createSpellingHoverTooltip(options.projectId, ports),
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
