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
import { usePageStore } from '@/features/editor/core/store/editor.store';

export interface ExtractedLatexWord {
  word: string;
  from: number;
  to: number;
  line: number;
  col: number;
}

function maskRangeWithSpaces(chars: string[], start: number, end: number): void {
  const limit = Math.min(chars.length, end);
  for (let i = Math.max(0, start); i < limit; i++) {
    if (chars[i] !== '\n') {
      chars[i] = ' ';
    }
  }
}

/**
 * Extracts natural-language words from LaTeX and BibTeX source text while masking
 * comments, math expressions, verbatim blocks, macro names, and citation/ref metadata.
 */
export function extractLatexWords(text: string): ExtractedLatexWord[] {
  if (!text) return [];
  const chars = text.split('');

  const maskMatches = (regex: RegExp) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) break;
      maskRangeWithSpaces(chars, m.index, m.index + m[0].length);
    }
  };

  // 1. Verbatim / code / math environments
  maskMatches(
    /\\begin\{(verbatim|lstlisting|minted|tikzpicture|equation|align|alignat|gather|multline|flalign|eqnarray)\*?\}[\s\S]*?\\end\{\1\*?\}/g,
  );

  // 2. Unescaped % comments (strip before inline math scanning)
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '%') {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 0) {
        let end = i;
        while (end < text.length && text[end] !== '\n') end++;
        maskRangeWithSpaces(chars, i, end);
        i = end;
      } else if (i > 0) {
        chars[i - 1] = ' ';
        chars[i] = ' ';
      }
    } else if (text[i] === '$' && i > 0) {
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 1) {
        chars[i - 1] = ' ';
        chars[i] = ' ';
      }
    }
  }

  // 3. Display & inline math on remaining unmasked text
  const afterComments = chars.join('');
  const maskOnCurrent = (regex: RegExp) => {
    regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(afterComments)) !== null) {
      if (m[0].length === 0) break;
      maskRangeWithSpaces(chars, m.index, m.index + m[0].length);
    }
  };
  maskOnCurrent(/\$\$[\s\S]*?\$\$/g);
  maskOnCurrent(/\\\[[\s\S]*?\\\]/g);
  maskOnCurrent(/\\\([\s\S]*?\\\)/g);
  maskOnCurrent(/\$(?:\\\$|[^$\n])+\$/g);

  // 4. Mask non-prose macro arguments (cite, ref, label, usepackage, url, etc.)
  const afterMath = chars.join('');
  const maskArgMacros =
    /\\(?:[a-zA-Z]*cite[a-zA-Z]*|ref|eqref|pageref|autoref|nameref|cref|Cref|label|usepackage|documentclass|input|include|subfile|includegraphics|bibliography|bibliographystyle|addbibresource|url|href|begin|end)\*?(?:\[[^\]]*\])*\{[^}]*\}/g;
  let argMatch: RegExpExecArray | null;
  while ((argMatch = maskArgMacros.exec(afterMath)) !== null) {
    maskRangeWithSpaces(chars, argMatch.index, argMatch.index + argMatch[0].length);
  }

  // 5. Mask BibTeX entry headers and non-prose metadata fields (keep title/abstract/note prose)
  const afterMacros = chars.join('');
  const bibHeaderRegex = /@[a-zA-Z]+\s*\{[^,\s]+,/g;
  let bibMatch: RegExpExecArray | null;
  while ((bibMatch = bibHeaderRegex.exec(afterMacros)) !== null) {
    maskRangeWithSpaces(chars, bibMatch.index, bibMatch.index + bibMatch[0].length);
  }
  const bibNonProseFieldRegex =
    /\b(?:author|editor|journal|year|month|day|doi|url|eprint|archiveprefix|primaryclass|isbn|issn|volume|number|issue|pages|publisher|organization|institution|school|address|howpublished|key|crossref|keywords|language)\s*=\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|[a-zA-Z0-9._-]+)\s*,?/gi;
  while ((bibMatch = bibNonProseFieldRegex.exec(afterMacros)) !== null) {
    maskRangeWithSpaces(chars, bibMatch.index, bibMatch.index + bibMatch[0].length);
  }
  const bibProseFieldKeyRegex =
    /\b(?:title|booktitle|abstract|note)\s*=/gi;
  while ((bibMatch = bibProseFieldKeyRegex.exec(afterMacros)) !== null) {
    maskRangeWithSpaces(chars, bibMatch.index, bibMatch.index + bibMatch[0].length);
  }

  // 6. Mask remaining LaTeX command tokens (\textbf, \textit, etc.) while keeping brace contents
  const afterBib = chars.join('');
  const cmdNameRegex = /\\[a-zA-Z@]+\*?/g;
  let cmdMatch: RegExpExecArray | null;
  while ((cmdMatch = cmdNameRegex.exec(afterBib)) !== null) {
    maskRangeWithSpaces(chars, cmdMatch.index, cmdMatch.index + cmdMatch[0].length);
  }

  const finalMasked = chars.join('');
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1);
  }

  const getLineCol = (offset: number): { line: number; col: number } => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= offset) lo = mid + 1;
      else hi = mid - 1;
    }
    const lineIdx = Math.max(0, hi);
    return { line: lineIdx + 1, col: offset - lineStarts[lineIdx] + 1 };
  };

  const results: ExtractedLatexWord[] = [];
  const wordRegex = /[\p{L}]+(?:['’][\p{L}]+)*/gu;
  let wMatch: RegExpExecArray | null;
  while ((wMatch = wordRegex.exec(finalMasked)) !== null) {
    const word = wMatch[0];
    if (word.length < 2) continue;
    const { line, col } = getLineCol(wMatch.index);
    results.push({
      word,
      from: wMatch.index,
      to: wMatch.index + word.length,
      line,
      col,
    });
  }
  return results;
}

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

// ── Session Ignored Words (User "Ignore in this document" clicks) ───────────

const sessionIgnoredWords = new Set<string>();
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

export function clearSpellingCaches(): void {
  spellingResultCache.clear();
  inFlightSpellingChecks.clear();
}

export function resetSpellingSessionCache(): void {
  sessionIgnoredWords.clear();
  spellingResultCache.clear();
  inFlightSpellingChecks.clear();
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
          const svc = resolveSpellingService(view, ports?.spellingService);
          const notif = resolveSpellingNotifier(view, ports?.notifier);
          const pageState = usePageStore.getState();
          const targetDictProjectId = projectId || pageState.spaceId || '';
          try {
            if (targetDictProjectId) {
              await svc.learnProjectWord(targetDictProjectId, word);
              notif.success(`Added "${word}" to project dictionary`, { id: `spell-dict-${word}` });
            } else if (typeof svc.learnUserWord === 'function') {
              await svc.learnUserWord(word);
              notif.success(`Added "${word}" to personal dictionary`, { id: `spell-dict-${word}` });
            }
          } catch {
            // Gracefully learned in session via effect
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
let lastSpellingProjectId: string | null = null;

export function createSpellingViewPlugin(options: LatexSpellingOptions = {}) {
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

        // If in test mode, return quickly without network
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
            effects: filtered.length > 0 ? setSpellErrorsEffect.of(filtered) : clearSpellErrorsEffect.of(),
          });
          return;
        }

        try {
          this.abortController?.abort();
          this.abortController = new AbortController();

          // Delegate LaTeX prose tokenization, dictionary lookup, and suggestion generation to backend SpellingService
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
        const pageState = usePageStore.getState();
        const targetDictProjectId = projectId || pageState.spaceId || '';
        if (targetDictProjectId) {
          try {
            await svc.learnProjectWord(targetDictProjectId, word);
            notif.success(`Added "${word}" to project dictionary`, { id: `spell-dict-${word}` });
          } catch {
            if (notif.error) {
              notif.error(`Failed to save "${word}" to project dictionary (ignored for this session)`, {
                id: `spell-dict-${word}`,
              });
            }
          }
        } else if (typeof svc.learnUserWord === 'function') {
          try {
            await svc.learnUserWord(word);
            notif.success(`Added "${word}" to personal dictionary`, { id: `spell-dict-${word}` });
          } catch {
            notif.success(`Learned "${word}" in session`, { id: `spell-dict-${word}` });
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
