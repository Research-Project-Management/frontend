/**
 * latex-spelling-ui.ts
 *
 * CodeMirror 6 Spell Check StateField, Hover Tooltip, Context Menu, and Theme.
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
} from '@/features/editor/core/engine/adapters/editor-spelling-port';
import { usePageStore } from '@/features/editor/core/store/editor.store';

export interface SpellErrorRange {
  from: number;
  to: number;
  word: string;
  suggestions: string[];
}

export const setSpellErrorsEffect = StateEffect.define<SpellErrorRange[]>();
export const addIgnoredWordEffect = StateEffect.define<string>();
export const clearSpellErrorsEffect = StateEffect.define<void>();

export const sessionIgnoredWords = new Set<string>();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
        const sorted = [...effect.value].sort((a, b) => a.from - b.from);
        for (const item of sorted) {
          if (item.from < item.to && item.to <= tr.newDoc.length) {
            builder.add(item.from, item.to, spellErrorMark(item.word, item.suggestions));
          }
        }
        errors = builder.finish();
      } else if (effect.is(addIgnoredWordEffect)) {
        sessionIgnoredWords.add(effect.value.toLowerCase());
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

function findSpellingRangeAtPos(
  view: EditorView,
  pos: number,
): { from: number; to: number; word: string; suggestions: string[] } | null {
  const decorations = view.state.field(spellingStateField, false);
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

  return targetRange;
}

async function learnSpellingWord(
  view: EditorView,
  word: string,
  projectId?: string,
  ports?: { spellingService?: SpellingServicePort; notifier?: SpellingNotificationPort },
  notifyFallbackOnError = false,
): Promise<void> {
  const svc = resolveSpellingService(view, ports?.spellingService);
  const notif = resolveSpellingNotifier(view, ports?.notifier);
  const pageState = usePageStore.getState();
  const targetDictProjectId = projectId || pageState.spaceId || '';
  if (targetDictProjectId) {
    try {
      await svc.learnProjectWord(targetDictProjectId, word);
      notif.success(`Added "${word}" to project dictionary`, { id: `spell-dict-${word}` });
    } catch {
      if (notifyFallbackOnError && notif.error) {
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
      if (notifyFallbackOnError) {
        notif.success(`Learned "${word}" in session`, { id: `spell-dict-${word}` });
      }
    }
  } else if (notifyFallbackOnError) {
    notif.success(`Learned "${word}" in session`, { id: `spell-dict-${word}` });
  }
}

export function createSpellingHoverTooltip(
  projectId?: string,
  ports?: { spellingService?: SpellingServicePort; notifier?: SpellingNotificationPort },
): Extension {
  return hoverTooltip((view, pos): Tooltip | null => {
    const activeRange = findSpellingRangeAtPos(view, pos);
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

        const header = document.createElement('div');
        header.className = 'flex items-center gap-1.5 font-medium text-foreground';
        header.innerHTML = `
          <span class="size-2 rounded-full bg-destructive shrink-0"></span>
          <span>Spelling: <code class="font-mono text-destructive font-semibold">${escapeHtml(word)}</code></span>
        `;
        dom.appendChild(header);

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

        const actions = document.createElement('div');
        actions.className = 'pt-1.5 border-t border-border flex items-center justify-between gap-2';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className =
          'text-11 px-2 py-0.5 rounded-sm bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors cursor-pointer';
        addBtn.textContent = 'Add to dictionary';
        addBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          view.dispatch({ effects: addIgnoredWordEffect.of(word) });
          await learnSpellingWord(view, word, projectId, ports, false);
        };
        actions.appendChild(addBtn);

        const ignoreBtn = document.createElement('button');
        ignoreBtn.type = 'button';
        ignoreBtn.className =
          'text-11 px-2 py-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer';
        ignoreBtn.textContent = 'Ignore';
        ignoreBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          view.dispatch({ effects: addIgnoredWordEffect.of(word) });
        };
        actions.appendChild(ignoreBtn);

        dom.appendChild(actions);
        return { dom };
      },
    };
  });
}

export function createSpellingContextMenu(
  projectId?: string,
  ports?: { spellingService?: SpellingServicePort; notifier?: SpellingNotificationPort },
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

        const activeRange = findSpellingRangeAtPos(view, pos);
        if (!activeRange) return false;

        e.preventDefault();
        e.stopPropagation();

        const { from, to, word, suggestions } = activeRange;

        const menu = document.createElement('div');
        menu.className =
          'fixed p-2 rounded-md border border-border bg-popover text-popover-foreground shadow-overlay text-xs font-sans select-none space-y-1.5 min-w-48 max-w-64 z-[9999] animate-in fade-in-50 zoom-in-95';
        menu.style.left = `${Math.min(e.clientX, window.innerWidth - 220)}px`;
        menu.style.top = `${Math.min(e.clientY, window.innerHeight - 200)}px`;

        const header = document.createElement('div');
        header.className =
          'px-1.5 py-0.5 flex items-center gap-1.5 text-11 font-medium text-muted-foreground border-b border-border/60 pb-1.5';
        header.innerHTML = `
          <span class="size-1.5 rounded-full bg-destructive shrink-0"></span>
          <span>Spelling: <code class="font-mono text-destructive font-semibold">${escapeHtml(word)}</code></span>
        `;
        menu.appendChild(header);

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

        const actions = document.createElement('div');
        actions.className = 'pt-1 border-t border-border/60 space-y-0.5';

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
          view.dispatch({ effects: addIgnoredWordEffect.of(word) });
          removeMenu();
          view.focus();
          await learnSpellingWord(view, word, projectId, ports, true);
        };
        actions.appendChild(addBtn);

        const ignoreBtn = document.createElement('button');
        ignoreBtn.type = 'button';
        ignoreBtn.className =
          'w-full text-left px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer';
        ignoreBtn.textContent = 'Ignore in this document';
        ignoreBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          view.dispatch({ effects: addIgnoredWordEffect.of(word) });
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
      },
    ),
  ];
}

export const spellingTheme = EditorView.baseTheme({
  '.cm-spell-error': {
    textDecoration: 'underline wavy #ef4444',
    textDecorationThickness: '1.5px',
    textUnderlineOffset: '2.5px',
    cursor: 'text',
  },
});
