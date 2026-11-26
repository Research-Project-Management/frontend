/**
 * subsystems/spelling/extensions/context-menu.ts
 *
 * Right-click spelling context menu for replacing words, learning to project dictionary,
 * and ignoring within the current session.
 */

import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { toast } from 'sonner';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { findErrorAt, ignoreWordEffect } from './decorations';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createSpellingContextMenu(
  resolveProjectId: () => string,
  onDictionaryChanged?: (unlearnedWord?: string) => void,
): Extension {
  let menuEl: HTMLDivElement | null = null;
  let listenersAttached = false;

  const handleOutsideClick = (event: MouseEvent) => {
    if (menuEl && event.target instanceof Node && menuEl.contains(event.target)) {
      return;
    }
    closeMenu();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') closeMenu();
  };

  const closeMenu = () => {
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
    if (listenersAttached && typeof window !== 'undefined') {
      window.removeEventListener('mousedown', handleOutsideClick, { capture: true });
      window.removeEventListener('keydown', handleKeyDown);
      listenersAttached = false;
    }
  };

  const attachListeners = () => {
    if (!listenersAttached && typeof window !== 'undefined') {
      window.addEventListener('mousedown', handleOutsideClick, { capture: true });
      window.addEventListener('keydown', handleKeyDown);
      listenersAttached = true;
    }
  };

  return [
    EditorView.domEventHandlers({
      contextmenu(event, view) {
        closeMenu();

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;

        const range = findErrorAt(view, pos);
        if (!range) return false;

        event.preventDefault();
        event.stopPropagation();

        const { from, to, word, suggestions } = range;
        const isReadOnly = view.state.readOnly;

        const menu = document.createElement('div');
        menu.className =
          'fixed p-2 rounded-md border border-border bg-popover text-popover-foreground shadow-overlay text-xs font-sans select-none space-y-1.5 min-w-48 max-w-64 z-[9999] animate-in fade-in-50 zoom-in-95';
        menu.style.left = `${Math.min(event.clientX, window.innerWidth - 220)}px`;
        menu.style.top = `${Math.min(event.clientY, window.innerHeight - 200)}px`;

        const header = document.createElement('div');
        header.className =
          'px-1.5 py-0.5 flex items-center gap-1.5 text-11 font-medium text-muted-foreground border-b border-border/60 pb-1.5';
        header.innerHTML = `
          <span class="size-1.5 rounded-full bg-destructive shrink-0"></span>
          <span>Spelling: <code class="font-mono text-destructive font-semibold">${escapeHtml(word)}</code></span>
        `;
        menu.appendChild(header);

        if (!isReadOnly && suggestions.length > 0) {
          const list = document.createElement('div');
          list.className = 'space-y-0.5 py-0.5';

          suggestions.slice(0, 4).forEach((suggestion) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className =
              'w-full text-left px-2 py-1 rounded-md text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer flex items-center justify-between';
            item.innerHTML = `<span>${escapeHtml(suggestion)}</span><span class="text-[10px] text-muted-foreground">Replace</span>`;
            item.onclick = (clickEvent) => {
              clickEvent.preventDefault();
              clickEvent.stopPropagation();
              // Guard against stale offsets if Yjs mutated the document while menu was open
              if (
                to <= view.state.doc.length &&
                view.state.doc.sliceString(from, to) === word
              ) {
                view.dispatch({
                  changes: { from, to, insert: suggestion },
                  userEvent: 'input.complete.spelling',
                });
              }
              closeMenu();
              view.focus();
            };
            list.appendChild(item);
          });
          menu.appendChild(list);
        }

        const actions = document.createElement('div');
        actions.className = 'pt-1 border-t border-border/60 space-y-0.5';

        if (!isReadOnly) {
          const learnBtn = document.createElement('button');
          learnBtn.type = 'button';
          learnBtn.className =
            'w-full text-left px-2 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer flex items-center gap-1.5';
          learnBtn.innerHTML = `
            <svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
            <span>Add to project dictionary</span>
          `;
          learnBtn.onclick = async (clickEvent) => {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            view.dispatch({ effects: ignoreWordEffect.of(word) });
            closeMenu();
            view.focus();

            const activeProjectId = resolveProjectId();
            if (!activeProjectId) return;

            try {
              await pagesService.spelling.learnWord(activeProjectId, word);
              onDictionaryChanged?.();
              toast.success(`Added "${word}" to project dictionary`, { id: `spell-dict-${word}` });
            } catch {
              onDictionaryChanged?.(word);
              toast.error(`Failed to save "${word}" to project dictionary`, {
                id: `spell-dict-${word}`,
              });
            }
          };
          actions.appendChild(learnBtn);
        }

        const ignoreBtn = document.createElement('button');
        ignoreBtn.type = 'button';
        ignoreBtn.className =
          'w-full text-left px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer';
        ignoreBtn.textContent = 'Ignore in this document';
        ignoreBtn.onclick = (clickEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          view.dispatch({ effects: ignoreWordEffect.of(word) });
          closeMenu();
          view.focus();
        };
        actions.appendChild(ignoreBtn);

        menu.appendChild(actions);

        document.body.appendChild(menu);
        menuEl = menu;
        attachListeners();
        return true;
      },
    }),
    ViewPlugin.fromClass(
      class {
        destroy() {
          closeMenu();
        }
      },
    ),
  ];
}
