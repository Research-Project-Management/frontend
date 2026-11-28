/**
 * latex-visual-citations.ts
 *
 * CodeMirror 6 Visual Mode Citation & Cross-Reference Badge Widget Extension.
 * Location: `frontend/src/features/editor/engines/extensions/latex-visual-citations.ts`
 *
 * Replaces verbose LaTeX citations (\cite{key}, \citep{key}, \ref{sec:intro})
 * with clean, clickable badge chips in Visual Mode.
 * Underlying LaTeX source buffer remains 100% untouched.
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { editorCommandBus } from '@/features/editor/core/bus/command-bus';
import {
  parseCiteCommand,
  buildCiteCommand,
  formatVisualCitationLabel,
  scanVisualCitationBadges,
} from './latex-visual-citations.parser';

function focusChipOffset(view: EditorView, chip: HTMLElement, offsetInRaw: number): void {
  const currentPos = view.posAtDOM(chip);
  const targetPos = Math.max(0, Math.min(currentPos + offsetInRaw, view.state.doc.length));
  view.dispatch({
    selection: { anchor: targetPos, head: targetPos },
    scrollIntoView: true,
  });
  view.focus();
}

// ── Badge Widgets ─────────────────────────────────────────────────────────────

let activeCitationPopover: HTMLElement | null = null;
function closeActiveCitationPopover(): void {
  if (activeCitationPopover) {
    activeCitationPopover.remove();
    activeCitationPopover = null;
  }
}

class CitationBadgeWidget extends WidgetType {
  private readonly label: string;

  constructor(
    public readonly keys: string[],
    public readonly rawText: string,
    public readonly from: number,
    public readonly to: number,
  ) {
    super();
    const parsed = parseCiteCommand(rawText, keys);
    this.label = formatVisualCitationLabel(parsed.keys, parsed.prenote, parsed.postnote);
  }

  override eq(other: CitationBadgeWidget): boolean {
    return this.rawText === other.rawText && this.label === other.label;
  }

  override ignoreEvent(event: Event): boolean {
    return event.type !== 'click';
  }

  toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'cm-visual-citation-chip';
    chip.title = `${this.rawText} (click to edit citation)`;

    const text = document.createElement('span');
    text.className = 'cm-visual-citation-label';
    text.textContent = this.label;

    chip.appendChild(text);

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeActiveCitationPopover();

      const parsed = parseCiteCommand(this.rawText, this.keys);
      const rect = chip.getBoundingClientRect();
      const pop = document.createElement('div');
      pop.className =
        'fixed z-50 w-72 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg space-y-2';
      pop.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 300))}px`;
      pop.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 230)}px`;

      pop.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-semibold text-foreground">Edit Citation (${parsed.command})</span>
          <button type="button" data-action="raw" class="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer">Raw LaTeX</button>
        </div>
        <label class="block space-y-1">
          <span class="text-[11px] text-muted-foreground">Citation key(s)</span>
          <input data-field="keys" type="text" class="w-full h-7 px-2 rounded border border-border bg-background font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
        </label>
        <div class="grid grid-cols-2 gap-2">
          <label class="block space-y-1">
            <span class="text-[11px] text-muted-foreground">Prenote</span>
            <input data-field="prenote" type="text" placeholder="e.g. see" class="w-full h-7 px-2 rounded border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <label class="block space-y-1">
            <span class="text-[11px] text-muted-foreground">Postnote</span>
            <input data-field="postnote" type="text" placeholder="e.g. p. 12" class="w-full h-7 px-2 rounded border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </label>
        </div>
        <div class="flex items-center justify-between pt-1">
          <button type="button" data-action="library" class="h-7 px-2 rounded border border-border hover:bg-muted text-xs text-foreground cursor-pointer">Browse Library</button>
          <div class="flex items-center gap-1.5">
            <button type="button" data-action="cancel" class="h-7 px-2 rounded hover:bg-muted text-xs text-muted-foreground cursor-pointer">Cancel</button>
            <button type="button" data-action="apply" class="h-7 px-2.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium cursor-pointer">Apply</button>
          </div>
        </div>
      `;

      const keysInput = pop.querySelector<HTMLInputElement>('input[data-field="keys"]')!;
      const preInput = pop.querySelector<HTMLInputElement>('input[data-field="prenote"]')!;
      const postInput = pop.querySelector<HTMLInputElement>('input[data-field="postnote"]')!;
      keysInput.value = parsed.keys.join(', ');
      preInput.value = parsed.prenote;
      postInput.value = parsed.postnote;

      const onOutsideMouseDown = (ev: MouseEvent) => {
        if (!pop.contains(ev.target as Node) && ev.target !== chip) {
          cleanup();
        }
      };
      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          cleanup();
        } else if (ev.key === 'Enter' && pop.contains(ev.target as Node)) {
          ev.preventDefault();
          applyEdit();
        }
      };
      const cleanup = () => {
        document.removeEventListener('mousedown', onOutsideMouseDown, true);
        document.removeEventListener('keydown', onKeyDown, true);
        closeActiveCitationPopover();
      };

      const applyEdit = () => {
        const currentPos = view.posAtDOM(chip);
        const nextKeys = keysInput.value.split(',').map((k) => k.trim()).filter(Boolean);
        if (nextKeys.length > 0 && currentPos >= 0) {
          const replacement = buildCiteCommand({
            ...parsed,
            keys: nextKeys,
            prenote: preInput.value,
            postnote: postInput.value,
          });
          view.dispatch({
            changes: { from: currentPos, to: currentPos + this.rawText.length, insert: replacement },
          });
        }
        cleanup();
        view.focus();
      };

      pop.querySelector('[data-action="apply"]')?.addEventListener('click', applyEdit);
      pop.querySelector('[data-action="cancel"]')?.addEventListener('click', cleanup);
      pop.querySelector('[data-action="library"]')?.addEventListener('click', () => {
        cleanup();
        editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
      });
      pop.querySelector('[data-action="raw"]')?.addEventListener('click', () => {
        const bracePos = this.rawText.indexOf('{');
        cleanup();
        focusChipOffset(view, chip, bracePos !== -1 ? bracePos + 1 : 0);
      });

      document.body.appendChild(pop);
      activeCitationPopover = pop;
      document.addEventListener('mousedown', onOutsideMouseDown, true);
      document.addEventListener('keydown', onKeyDown, true);
      keysInput.focus();
    });

    return chip;
  }
}

class ReferenceBadgeWidget extends WidgetType {
  constructor(
    public readonly label: string,
    public readonly rawText: string,
    public readonly isEq: boolean,
    public readonly from: number,
    public readonly to: number,
  ) {
    super();
  }

  override eq(other: ReferenceBadgeWidget): boolean {
    return (
      this.rawText === other.rawText &&
      this.isEq === other.isEq
    );
  }

  override ignoreEvent(event: Event): boolean {
    return event.type !== 'click';
  }

  toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'cm-visual-ref-chip';
    chip.title = `Cross-reference: ${this.label} (click to edit)`;

    const text = document.createElement('span');
    text.className = 'cm-visual-ref-label';
    text.textContent = this.isEq ? `(${this.label})` : `[${this.label}]`;

    chip.appendChild(text);

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const bracePos = this.rawText.indexOf('{');
      focusChipOffset(view, chip, bracePos !== -1 ? bracePos + 1 : 0);
    });

    return chip;
  }
}

class LinkBadgeWidget extends WidgetType {
  constructor(
    public readonly url: string,
    public readonly label: string,
    public readonly rawText: string,
    public readonly editOffsetInRaw: number,
  ) {
    super();
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof LinkBadgeWidget &&
      other.rawText === this.rawText &&
      other.url === this.url &&
      other.label === this.label
    );
  }

  override ignoreEvent(event: Event): boolean {
    return event.type !== 'click';
  }

  toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'cm-visual-link-chip';
    chip.title = `${this.url} (Click to edit · Ctrl+Click to open)`;
    chip.textContent = this.label;

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if ((e.ctrlKey || e.metaKey) && /^https?:\/\//i.test(this.url)) {
        window.open(this.url, '_blank', 'noopener,noreferrer');
        return;
      }
      focusChipOffset(view, chip, this.editOffsetInRaw);
    });

    return chip;
  }
}

class FootnoteBadgeWidget extends WidgetType {
  constructor(
    public readonly preview: string,
    public readonly rawText: string,
    public readonly editOffsetInRaw: number,
  ) {
    super();
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof FootnoteBadgeWidget &&
      other.rawText === this.rawText &&
      other.preview === this.preview
    );
  }

  override ignoreEvent(event: Event): boolean {
    return event.type !== 'click';
  }

  toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'cm-visual-footnote-chip';
    chip.title = this.preview
      ? `Footnote: ${this.preview} (click to edit)`
      : 'Footnote (click to edit)';
    chip.textContent = 'fn';

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      focusChipOffset(view, chip, this.editOffsetInRaw);
    });

    return chip;
  }
}

// ── Theme ─────────────────────────────────────────────────────────────────────

const visualCitationsTheme = EditorView.baseTheme({
  '.cm-visual-citation-chip': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '1px 6px',
    margin: '0 2px',
    borderRadius: '4px',
    fontSize: '0.85em',
    lineHeight: '1.4',
    cursor: 'pointer',
    backgroundColor: 'var(--muted)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    verticalAlign: 'baseline',
    '&:hover': {
      backgroundColor: 'var(--accent)',
      borderColor: 'var(--primary)',
    },
    '&:focus-visible': {
      outline: '1.5px solid var(--primary)',
      outlineOffset: '1px',
    },
  },
  '.cm-visual-citation-label': {
    fontWeight: '500',
    fontFamily: 'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, monospace',
  },
  '.cm-visual-ref-chip': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '1px 5px',
    margin: '0 2px',
    borderRadius: '4px',
    fontSize: '0.85em',
    lineHeight: '1.4',
    cursor: 'pointer',
    backgroundColor: 'var(--muted)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
    verticalAlign: 'baseline',
    '&:hover': {
      backgroundColor: 'var(--accent)',
      borderColor: 'var(--primary)',
    },
    '&:focus-visible': {
      outline: '1.5px solid var(--primary)',
      outlineOffset: '1px',
    },
  },
  '.cm-visual-ref-label': {
    fontWeight: '500',
    fontFamily: 'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, monospace',
  },
  '.cm-visual-link-chip': {
    display: 'inline',
    color: 'var(--primary)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
    borderRadius: '4px',
    padding: '0 2px',
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    },
  },
  '.cm-visual-footnote-chip': {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0 5px',
    margin: '0 2px',
    borderRadius: '9999px',
    fontSize: '0.75em',
    fontWeight: '600',
    lineHeight: '1.35',
    verticalAlign: 'super',
    cursor: 'pointer',
    backgroundColor: 'color-mix(in srgb, var(--warning) 14%, transparent)',
    color: 'var(--warning)',
    border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--warning) 24%, transparent)',
    },
  },
});

// ── ViewPlugin ───────────────────────────────────────────────────────────────

class VisualCitationsPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.computeDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (
      update.docChanged ||
      update.viewportChanged ||
      update.selectionSet
    ) {
      this.decorations = this.computeDecorations(update.view);
    }
  }

  private computeDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const state = view.state;
    const doc = state.doc;
    const selection = state.selection.main;

    if (doc.length === 0) {
      return builder.finish();
    }

    interface PendingBadge {
      readonly from: number;
      readonly to: number;
      readonly widget: WidgetType;
    }
    const badges: PendingBadge[] = [];

    for (const { from, to } of view.visibleRanges) {
      const lineFrom = doc.lineAt(from).from;
      const lineTo = doc.lineAt(to).to;
      const text = doc.sliceString(lineFrom, lineTo);

      for (const item of scanVisualCitationBadges(text, lineFrom, selection)) {
        if (item.kind === 'cite') {
          badges.push({
            from: item.from,
            to: item.to,
            widget: new CitationBadgeWidget(item.keys, item.rawText, item.from, item.to),
          });
        } else if (item.kind === 'ref') {
          badges.push({
            from: item.from,
            to: item.to,
            widget: new ReferenceBadgeWidget(item.label, item.rawText, item.isEq, item.from, item.to),
          });
        } else if (item.kind === 'link') {
          badges.push({
            from: item.from,
            to: item.to,
            widget: new LinkBadgeWidget(item.url, item.label, item.rawText, item.editOffsetInRaw),
          });
        } else {
          badges.push({
            from: item.from,
            to: item.to,
            widget: new FootnoteBadgeWidget(item.preview, item.rawText, item.editOffsetInRaw),
          });
        }
      }
    }

    // Sort strictly by position (outermost span first when sharing `from`)
    badges.sort((a, b) => a.from - b.from || b.to - a.to);

    let lastTo = -1;
    for (const badge of badges) {
      if (badge.from < lastTo) continue;
      lastTo = badge.to;
      builder.add(
        badge.from,
        badge.to,
        Decoration.replace({ widget: badge.widget })
      );
    }

    return builder.finish();
  }
}

const visualCitationsPlugin = ViewPlugin.fromClass(VisualCitationsPlugin, {
  decorations: (v) => v.decorations,
});

/**
 * Overleaf Visual Editor parity: typing `@` at the start of a line or after whitespace/opening
 * punctuation opens the Citation Picker modal without leaving a stray `@` in the LaTeX source.
 * Emails (e.g. `user@domain.com`), escaped `\@`, and `%` comment lines pass through untouched.
 */
const visualCitationAtTrigger = EditorView.inputHandler.of((view, from, to, text) => {
  if (text !== '@' || from !== to) return false;
  const line = view.state.doc.lineAt(from);
  const beforeCursor = line.text.slice(0, from - line.from);
  // Ignore inside a % comment
  for (let i = 0; i < beforeCursor.length; i++) {
    if (beforeCursor[i] === '%' && (i === 0 || beforeCursor[i - 1] !== '\\')) {
      return false;
    }
  }
  const prevChar = beforeCursor.length > 0 ? beforeCursor[beforeCursor.length - 1] : '';
  if (prevChar && !/[\s([{"']/.test(prevChar)) {
    return false;
  }
  editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
  return true;
});

export const latexVisualCitations = (): Extension => [
  visualCitationsPlugin,
  visualCitationAtTrigger,
  EditorView.atomicRanges.of((view) => view.plugin(visualCitationsPlugin)?.decorations ?? Decoration.none),
  visualCitationsTheme,
];
