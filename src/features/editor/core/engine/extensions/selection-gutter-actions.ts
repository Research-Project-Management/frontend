/**
 * selection-gutter-actions.ts
 *
 * Overleaf-parity floating 2-button gutter pill shown alongside non-empty text selections
 * for quick Comment creation and AI Writing Tools actions.
 */

import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import { useWorkspaceStore } from '@/features/editor/core/store/workspace.store';
import { useSettingsStore } from '@/features/editor/core/store/settings.store';

export interface SelectionGutterAiAction {
  id: 'polish' | 'rewrite' | 'concise' | 'grammar' | 'explain' | 'ask';
  label: string;
  description: string;
  prompt: string;
}

export const SELECTION_GUTTER_AI_ACTIONS: readonly SelectionGutterAiAction[] = [
  {
    id: 'polish',
    label: 'Academic Polish',
    description: 'Improve academic tone, clarity, and LaTeX phrasing',
    prompt:
      'Polish the selected LaTeX passage for publication-grade academic tone, clarity, and flow while preserving all technical meaning, math, and citations.',
  },
  {
    id: 'rewrite',
    label: 'Rewrite & Clarify',
    description: 'Rephrase for clearer structure and readability',
    prompt:
      'Rewrite the selected LaTeX passage to improve readability and logical flow without altering technical claims or LaTeX commands.',
  },
  {
    id: 'concise',
    label: 'Make Concise',
    description: 'Tighten wording without losing key details',
    prompt:
      'Make the selected LaTeX passage more concise and direct while keeping all essential technical details, formulas, and citations intact.',
  },
  {
    id: 'grammar',
    label: 'Fix Grammar & Style',
    description: 'Correct grammar, spelling, and punctuation',
    prompt:
      'Fix any grammar, spelling, and punctuation issues in the selected passage while keeping LaTeX commands intact.',
  },
  {
    id: 'explain',
    label: 'Explain Selection',
    description: 'Break down math, notation, or LaTeX logic',
    prompt:
      'Explain the selected LaTeX passage, including its mathematical meaning, notation, and LaTeX commands.',
  },
  {
    id: 'ask',
    label: 'Ask AI…',
    description: 'Open AI panel with this selection attached',
    prompt: '',
  },
] as const;

const SVG_NS = 'http://www.w3.org/2000/svg';

function createCommentSvgIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '15');
  svg.setAttribute('height', '15');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const bubble = document.createElementNS(SVG_NS, 'path');
  bubble.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');

  const line1 = document.createElementNS(SVG_NS, 'path');
  line1.setAttribute('d', 'M8 9h8');

  const line2 = document.createElementNS(SVG_NS, 'path');
  line2.setAttribute('d', 'M8 13h5');

  svg.appendChild(bubble);
  svg.appendChild(line1);
  svg.appendChild(line2);
  return svg;
}

function createAiLogoIcon(): HTMLImageElement {
  const img = document.createElement('img');
  img.src = '/Chat.svg';
  img.alt = '';
  img.width = 16;
  img.height = 16;
  img.setAttribute('aria-hidden', 'true');
  img.draggable = false;
  img.style.width = '16px';
  img.style.height = '16px';
  img.style.borderRadius = '9999px';
  img.style.display = 'block';
  return img;
}

const selectionGutterActionsTheme = EditorView.baseTheme({
  '.cm-selection-gutter-pill': {
    position: 'absolute',
    zIndex: '30',
    display: 'none',
    flexDirection: 'row',
    alignItems: 'center',
    width: 'auto',
    height: '30px',
    padding: '2px',
    gap: '2px',
    borderRadius: '6px',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.10)',
    userSelect: 'none',
    boxSizing: 'border-box',
  },
  '.cm-selection-gutter-btn': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    padding: '0',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 120ms ease, color 120ms ease',
  },
  '.cm-selection-gutter-btn-comment': {
    color: 'var(--muted-foreground)',
    '&:hover': {
      backgroundColor: 'var(--accent)',
      color: 'var(--accent-foreground)',
    },
  },
  '.cm-selection-gutter-btn-ai': {
    color: 'var(--primary)',
    '&:hover, &[aria-expanded="true"]': {
      backgroundColor: 'var(--accent)',
      color: 'var(--primary)',
    },
  },
  '.cm-selection-gutter-divider': {
    width: '1px',
    height: '14px',
    margin: '0 1px',
    backgroundColor: 'var(--border)',
  },
});

interface PillMeasureLayout {
  visible: boolean;
  top: number;
  left: number;
}

function createSelectionGutterActionsPlugin() {
  return ViewPlugin.fromClass(
    class SelectionGutterActionsPlugin {
      private view: EditorView;
      private pill: HTMLDivElement;
      private commentBtn: HTMLButtonElement;
      private divider: HTMLDivElement;
      private aiBtn: HTMLButtonElement;
      private aiMenu: HTMLDivElement | null = null;
      private menuSelectedText = '';
      private menuListenersAttached = false;
      private destroyed = false;
      private isPointerSelecting = false;
      private showDelayTimer: ReturnType<typeof setTimeout> | null = null;
      private readonly measureSpec = {
        key: this,
        read: (view: EditorView): PillMeasureLayout => {
          if (this.destroyed) {
            return { visible: false, top: 0, left: 0 };
          }

          const sel = view.state.selection.main;
          const selectedText = view.state.sliceDoc(sel.from, sel.to);
          if (sel.empty || selectedText.trim().length === 0) {
            return { visible: false, top: 0, left: 0 };
          }

          const editorRect = view.dom.getBoundingClientRect();
          const scrollerRect = view.scrollDOM.getBoundingClientRect();
          const gutterEl = view.dom.querySelector('.cm-gutters') as HTMLElement | null;
          const gutterRect = gutterEl?.getBoundingClientRect() ?? null;
          const pos = Math.min(sel.from, view.state.doc.length);
          const coords = view.coordsAtPos(pos);

          if (
            scrollerRect.height > 0 &&
            coords !== null &&
            (coords.bottom < scrollerRect.top || coords.top > scrollerRect.bottom)
          ) {
            return { visible: false, top: 0, left: 0 };
          }

          const pillHeight = this.pill.offsetHeight || 28;
          const pillWidth = this.pill.offsetWidth || (this.isAiUnavailable() ? 28 : 59);
          const gap = 10;

          const belowTop =
            coords !== null && editorRect.height > 0
              ? coords.bottom - editorRect.top + gap
              : this.computeFallbackLineTop(view, pos) + 26;
          const aboveTop =
            coords !== null && editorRect.height > 0
              ? coords.top - editorRect.top - pillHeight - gap
              : this.computeFallbackLineTop(view, pos) - pillHeight - gap;

          const fitsBelow =
            editorRect.height <= 0 || belowTop + pillHeight <= editorRect.height - 4;
          const rawTop = fitsBelow ? belowTop : aboveTop;
          const top =
            editorRect.height > 0
              ? Math.max(4, Math.min(rawTop, Math.max(4, editorRect.height - pillHeight - 4)))
              : Math.max(0, rawTop);

          const rawLeft =
            coords !== null && editorRect.width > 0
              ? coords.left - editorRect.left
              : gutterRect && gutterRect.width > 0
                ? gutterRect.right - editorRect.left + 4
                : 6;
          const left =
            editorRect.width > 0
              ? Math.max(4, Math.min(rawLeft, Math.max(4, editorRect.width - pillWidth - 4)))
              : Math.max(4, rawLeft);

          return { visible: true, top, left };
        },
        write: (layout: PillMeasureLayout): void => {
          if (this.destroyed) return;

          const sel = this.view.state.selection.main;
          const selectedText = this.view.state.sliceDoc(sel.from, sel.to);
          if (!layout.visible || sel.empty || selectedText.trim().length === 0) {
            this.pill.style.display = 'none';
            this.closeAiMenu();
            return;
          }

          this.pill.style.top = `${layout.top}px`;
          this.pill.style.left = `${layout.left}px`;
          this.pill.style.display = 'flex';
        },
      };

      constructor(view: EditorView) {
        this.view = view;

        this.pill = document.createElement('div');
        this.pill.className = 'cm-selection-gutter-pill';
        this.pill.setAttribute('data-testid', 'selection-gutter-actions');
        this.pill.setAttribute('role', 'toolbar');
        this.pill.setAttribute('aria-label', 'Selection actions');
        this.pill.style.display = 'none';

        this.commentBtn = document.createElement('button');
        this.commentBtn.type = 'button';
        this.commentBtn.className = 'cm-selection-gutter-btn cm-selection-gutter-btn-comment';
        this.commentBtn.setAttribute('data-testid', 'selection-gutter-comment-btn');
        this.commentBtn.setAttribute('aria-label', 'Add comment');
        this.commentBtn.title = 'Add comment (Ctrl+Alt+M)';
        this.commentBtn.appendChild(createCommentSvgIcon());

        this.divider = document.createElement('div');
        this.divider.className = 'cm-selection-gutter-divider';
        this.divider.setAttribute('data-testid', 'selection-gutter-divider');

        this.aiBtn = document.createElement('button');
        this.aiBtn.type = 'button';
        this.aiBtn.className = 'cm-selection-gutter-btn cm-selection-gutter-btn-ai';
        this.aiBtn.setAttribute('data-testid', 'selection-gutter-ai-btn');
        this.aiBtn.setAttribute('aria-label', 'AI writing tools');
        this.aiBtn.title = 'AI writing tools';
        this.aiBtn.setAttribute('aria-haspopup', 'menu');
        this.aiBtn.setAttribute('aria-expanded', 'false');
        this.aiBtn.appendChild(createAiLogoIcon());

        this.pill.appendChild(this.commentBtn);
        this.pill.appendChild(this.divider);
        this.pill.appendChild(this.aiBtn);

        this.pill.addEventListener('mousedown', this.handlePillMouseDown);
        this.commentBtn.addEventListener('click', this.handleCommentClick);
        this.aiBtn.addEventListener('click', this.handleAiButtonClick);

        this.view.dom.appendChild(this.pill);
        this.view.contentDOM.addEventListener('mousedown', this.handleContentMouseDown);
        this.view.scrollDOM.addEventListener('scroll', this.handleScroll, { passive: true });
        if (typeof window !== 'undefined') {
          window.addEventListener('mouseup', this.handleWindowMouseUp);
          window.addEventListener('resize', this.handleWindowResize, { passive: true });
        }

        if (this.syncSelectionState()) {
          this.scheduleMeasure();
        }
      }

      private clearShowDelay(): void {
        if (this.showDelayTimer !== null) {
          clearTimeout(this.showDelayTimer);
          this.showDelayTimer = null;
        }
      }

      private handleContentMouseDown = (): void => {
        this.isPointerSelecting = true;
        this.clearShowDelay();
        this.pill.style.display = 'none';
        this.closeAiMenu();
      };

      private handleWindowMouseUp = (): void => {
        if (!this.isPointerSelecting) return;
        this.isPointerSelecting = false;
        if (!this.destroyed && this.syncSelectionState()) {
          this.scheduleMeasure();
        }
      };

      private handlePillMouseDown = (e: MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();
      };

      private handleCommentClick = (e: MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        const sel = this.view.state.selection.main;
        const selectedText = this.view.state.sliceDoc(sel.from, sel.to);
        if (sel.empty || selectedText.trim().length === 0) {
          return;
        }

        const startLine = this.view.state.doc.lineAt(sel.from).number;
        const endLine = this.view.state.doc.lineAt(sel.to).number;

        this.closeAiMenu();
        editorCommandBus.dispatch({
          type: 'review:create-comment',
          line: startLine,
          endLine,
          selectedText,
        });
      };

      private handleAiButtonClick = (e: MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        if (this.isAiUnavailable()) {
          return;
        }

        if (this.aiMenu) {
          this.closeAiMenu();
          return;
        }

        const sel = this.view.state.selection.main;
        const selectedText = this.view.state.sliceDoc(sel.from, sel.to);
        if (sel.empty || selectedText.trim().length === 0) {
          return;
        }

        this.openAiMenu(selectedText);
      };

      private handleScroll = (): void => {
        this.closeAiMenu();
        const sel = this.view.state.selection.main;
        if (sel.empty || this.view.state.sliceDoc(sel.from, sel.to).trim().length === 0) {
          this.pill.style.display = 'none';
          return;
        }
        this.scheduleMeasure();
      };

      private handleWindowResize = (): void => {
        this.closeAiMenu();
        const sel = this.view.state.selection.main;
        if (sel.empty || this.view.state.sliceDoc(sel.from, sel.to).trim().length === 0) {
          this.pill.style.display = 'none';
          return;
        }
        this.scheduleMeasure();
      };

      private handleWindowMouseDown = (e: MouseEvent): void => {
        const target = e.target as Node | null;
        if (target && (this.aiMenu?.contains(target) || this.pill.contains(target))) {
          return;
        }
        this.closeAiMenu();
      };

      private handleWindowKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
          this.closeAiMenu();
        }
      };

      private isAiUnavailable(): boolean {
        return (
          this.view.state.readOnly ||
          !useSettingsStore.getState().aiAssistEnabled
        );
      }

      private syncReadOnlyState(): void {
        const hideAi = this.isAiUnavailable();
        this.divider.style.display = hideAi ? 'none' : '';
        this.divider.hidden = hideAi;
        this.aiBtn.style.display = hideAi ? 'none' : '';
        this.aiBtn.hidden = hideAi;
        this.aiBtn.disabled = hideAi;
        if (hideAi) {
          this.closeAiMenu();
        }
      }

      private computeFallbackLineTop(view: EditorView, pos: number): number {
        try {
          return view.lineBlockAt(pos).top - view.scrollDOM.scrollTop;
        } catch {
          return 0;
        }
      }

      private syncSelectionState(): boolean {
        if (this.destroyed) return false;

        this.syncReadOnlyState();

        const sel = this.view.state.selection.main;
        const selectedText = this.view.state.sliceDoc(sel.from, sel.to);
        if (sel.empty || selectedText.trim().length === 0) {
          this.pill.style.display = 'none';
          this.closeAiMenu();
          return false;
        }

        this.pill.style.display = 'flex';
        return true;
      }

      private scheduleMeasure(): void {
        if (this.destroyed) return;
        this.view.requestMeasure(this.measureSpec);
      }

      private openAiMenu(selectedText: string): void {
        if (typeof document === 'undefined' || !document.body) return;

        this.closeAiMenu();
        this.menuSelectedText = selectedText;

        const menu = document.createElement('div');
        menu.setAttribute('data-testid', 'selection-gutter-ai-menu');
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'AI writing tools');

        const pillRect = this.pill.getBoundingClientRect();
        const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
        const left = Math.min(pillRect.right + 8, Math.max(8, viewportW - 252));
        const top = Math.min(pillRect.top, Math.max(8, viewportH - 310));

        Object.assign(menu.style, {
          position: 'fixed',
          top: `${Math.max(8, top)}px`,
          left: `${Math.max(8, left)}px`,
          zIndex: '9990',
          width: '240px',
          padding: '6px',
          borderRadius: '8px',
          border: '1px solid var(--border, #e2e8f0)',
          backgroundColor: 'var(--popover, #ffffff)',
          color: 'var(--popover-foreground, #0f172a)',
          boxShadow: '0 10px 28px rgba(15, 23, 42, 0.18)',
          fontFamily: 'inherit',
          fontSize: '12px',
          userSelect: 'none',
          boxSizing: 'border-box',
        });

        const header = document.createElement('div');
        header.textContent = 'AI Writing Tools';
        Object.assign(header.style, {
          padding: '4px 8px 6px',
          marginBottom: '4px',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          fontSize: '11px',
          fontWeight: '600',
          color: 'var(--muted-foreground, #64748b)',
          letterSpacing: '0.01em',
        });
        menu.appendChild(header);

        for (const action of SELECTION_GUTTER_AI_ACTIONS) {
          const itemBtn = document.createElement('button');
          itemBtn.type = 'button';
          itemBtn.setAttribute('role', 'menuitem');
          itemBtn.setAttribute('data-testid', `selection-gutter-ai-action-${action.id}`);

          Object.assign(itemBtn.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            width: '100%',
            padding: '6px 8px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: 'inherit',
            textAlign: 'left',
            cursor: 'pointer',
            gap: '1px',
          });

          const titleSpan = document.createElement('span');
          titleSpan.textContent = action.label;
          Object.assign(titleSpan.style, {
            fontSize: '12px',
            fontWeight: '500',
            lineHeight: '1.3',
          });

          const descSpan = document.createElement('span');
          descSpan.textContent = action.description;
          Object.assign(descSpan.style, {
            fontSize: '11px',
            lineHeight: '1.25',
            color: 'var(--muted-foreground, #64748b)',
          });

          itemBtn.appendChild(titleSpan);
          itemBtn.appendChild(descSpan);

          itemBtn.addEventListener('mouseenter', () => {
            itemBtn.style.backgroundColor = 'var(--accent, #f1f5f9)';
          });
          itemBtn.addEventListener('mouseleave', () => {
            itemBtn.style.backgroundColor = 'transparent';
          });
          itemBtn.addEventListener('mousedown', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
          });
          itemBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            this.handleAiActionSelect(action);
          });

          menu.appendChild(itemBtn);
        }

        document.body.appendChild(menu);
        this.aiMenu = menu;
        this.aiBtn.setAttribute('aria-expanded', 'true');

        if (!this.menuListenersAttached && typeof window !== 'undefined') {
          window.addEventListener('mousedown', this.handleWindowMouseDown, { capture: true });
          window.addEventListener('keydown', this.handleWindowKeyDown);
          this.menuListenersAttached = true;
        }
      }

      private handleAiActionSelect(action: SelectionGutterAiAction): void {
        const sel = this.view.state.selection.main;
        const liveSelection = sel.empty ? '' : this.view.state.sliceDoc(sel.from, sel.to);
        const selectedText =
          liveSelection.trim().length > 0 ? liveSelection : this.menuSelectedText;

        this.closeAiMenu();

        if (!selectedText.trim()) {
          return;
        }

        const layoutStore = useWorkspaceStore.getState();
        layoutStore.setActiveSidebarTab('ai');
        layoutStore.setSidebarLeftOpen(true);

        editorCommandBus.dispatch({
          type: 'sidebar:open-ai-panel',
          selectedText,
          initialPrompt: action.prompt || undefined,
          autoSend: Boolean(action.prompt),
          forceOpen: true,
        });
      }

      private closeAiMenu(): void {
        if (this.aiMenu) {
          this.aiMenu.remove();
          this.aiMenu = null;
        }
        this.menuSelectedText = '';
        this.aiBtn.setAttribute('aria-expanded', 'false');

        if (this.menuListenersAttached && typeof window !== 'undefined') {
          window.removeEventListener('mousedown', this.handleWindowMouseDown, { capture: true });
          window.removeEventListener('keydown', this.handleWindowKeyDown);
          this.menuListenersAttached = false;
        }
      }

      update(update: ViewUpdate): void {
        const readOnlyChanged = update.startState.readOnly !== update.state.readOnly;
        if (update.selectionSet || update.docChanged || readOnlyChanged) {
          this.closeAiMenu();
        }
        if (update.selectionSet) {
          this.clearShowDelay();
          if (this.isPointerSelecting) {
            this.pill.style.display = 'none';
            return;
          }
          if (this.syncSelectionState()) {
            this.scheduleMeasure();
          }
          return;
        }
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.geometryChanged ||
          readOnlyChanged
        ) {
          if (!this.isPointerSelecting && this.syncSelectionState()) {
            this.scheduleMeasure();
          }
        }
      }

      destroy(): void {
        this.destroyed = true;
        this.clearShowDelay();
        this.closeAiMenu();
        this.pill.removeEventListener('mousedown', this.handlePillMouseDown);
        this.commentBtn.removeEventListener('click', this.handleCommentClick);
        this.aiBtn.removeEventListener('click', this.handleAiButtonClick);
        this.view.contentDOM.removeEventListener('mousedown', this.handleContentMouseDown);
        this.view.scrollDOM.removeEventListener('scroll', this.handleScroll);
        if (typeof window !== 'undefined') {
          window.removeEventListener('mouseup', this.handleWindowMouseUp);
          window.removeEventListener('resize', this.handleWindowResize);
        }
        this.pill.remove();
      }
    },
  );
}

export function createSelectionGutterActionsExtension(): Extension {
  return [selectionGutterActionsTheme, createSelectionGutterActionsPlugin()];
}
