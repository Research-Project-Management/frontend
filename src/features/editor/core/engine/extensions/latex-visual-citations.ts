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
import { findMatchingBrace } from './latex-visual-headings';

function focusChipOffset(view: EditorView, chip: HTMLElement, offsetInRaw: number): void {
  const currentPos = view.posAtDOM(chip);
  const targetPos = Math.max(0, Math.min(currentPos + offsetInRaw, view.state.doc.length));
  view.dispatch({
    selection: { anchor: targetPos, head: targetPos },
    scrollIntoView: true,
  });
  view.focus();
}

function cleanInlineMarkup(raw: string): string {
  return raw
    .replace(/\\(?:textbf|textit|emph|underline|texttt|url)\{([^{}]*)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Badge Widgets ─────────────────────────────────────────────────────────────

class CitationBadgeWidget extends WidgetType {
  constructor(
    public readonly keys: string[],
    public readonly rawText: string,
    public readonly from: number,
    public readonly to: number,
  ) {
    super();
  }

  override eq(other: CitationBadgeWidget): boolean {
    return this.rawText === other.rawText;
  }

  override ignoreEvent(event: Event): boolean {
    return event.type !== 'click';
  }

  toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'cm-visual-citation-chip';
    chip.title = `Citation: ${this.keys.join(', ')} (click to edit)`;

    const text = document.createElement('span');
    text.className = 'cm-visual-citation-label';
    text.textContent = this.keys.map((k) => `@${k}`).join(', ');

    chip.appendChild(text);

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentPos = view.posAtDOM(chip);
      const bracePos = this.rawText.indexOf('{');
      const targetPos = bracePos !== -1 ? Math.max(0, currentPos + bracePos + 1) : Math.max(0, currentPos);
      view.dispatch({
        selection: { anchor: targetPos, head: targetPos },
        scrollIntoView: true,
      });
      view.focus();
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

    const icon = document.createElement('span');
    icon.className = 'cm-visual-ref-icon';
    icon.textContent = this.isEq ? '🔢' : '🔗';

    const text = document.createElement('span');
    text.className = 'cm-visual-ref-label';
    text.textContent = this.isEq ? `(${this.label})` : `[${this.label}]`;

    chip.appendChild(icon);
    chip.appendChild(text);

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentPos = view.posAtDOM(chip);
      const bracePos = this.rawText.indexOf('{');
      const targetPos = bracePos !== -1 ? Math.max(0, currentPos + bracePos + 1) : Math.max(0, currentPos);
      view.dispatch({
        selection: { anchor: targetPos, head: targetPos },
        scrollIntoView: true,
      });
      view.focus();
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

// ── Matchers ──────────────────────────────────────────────────────────────────

const CITE_REGEX =
  /\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{([^}]+)\}/gi;

const REF_REGEX = /\\(?:eq|auto|c|page|name)?ref\*?\{([^}]+)\}/gi;
const HREF_PREFIX_REGEX = /\\href\*?(?:\[[^\]]*\])?\{/g;
const URL_PREFIX_REGEX = /\\url\*?\{/g;
const FOOTNOTE_PREFIX_REGEX = /\\footnote(?:\[[^\]]*\])?\{/g;

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
    backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
    color: 'var(--primary)',
    border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
    transition: 'all 0.15s ease',
    verticalAlign: 'baseline',
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)',
      borderColor: 'color-mix(in srgb, var(--primary) 40%, transparent)',
    },
  },
  '.cm-visual-citation-icon': {
    fontSize: '0.85em',
  },
  '.cm-visual-citation-label': {
    fontWeight: '500',
    fontFamily: 'monospace',
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
    backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)',
    color: 'var(--success)',
    border: '1px solid color-mix(in srgb, var(--success) 25%, transparent)',
    transition: 'all 0.15s ease',
    verticalAlign: 'baseline',
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--success) 20%, transparent)',
      borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
    },
  },
  '.cm-visual-ref-icon': {
    fontSize: '0.85em',
  },
  '.cm-visual-ref-label': {
    fontWeight: '500',
  },
  '.cm-visual-link-chip': {
    display: 'inline',
    color: 'var(--primary, #2563eb)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
    borderRadius: '3px',
    padding: '0 2px',
    transition: 'background-color 0.15s ease',
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--primary, #2563eb) 10%, transparent)',
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
    backgroundColor: 'color-mix(in srgb, var(--warning, #d97706) 14%, transparent)',
    color: 'var(--warning-foreground, #b45309)',
    border: '1px solid color-mix(in srgb, var(--warning, #d97706) 30%, transparent)',
    transition: 'all 0.15s ease',
    '&:hover': {
      backgroundColor: 'color-mix(in srgb, var(--warning, #d97706) 24%, transparent)',
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

      // 1. Match Citations
      CITE_REGEX.lastIndex = 0;
      let citeMatch: RegExpExecArray | null;
      while ((citeMatch = CITE_REGEX.exec(text)) !== null) {
        const matchFrom = lineFrom + citeMatch.index;
        const matchTo = matchFrom + citeMatch[0].length;

        // Skip if cursor or selection overlaps this citation
        if (selection.from <= matchTo && selection.to >= matchFrom) {
          continue;
        }

        const keys = citeMatch[1]
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);

        badges.push({
          from: matchFrom,
          to: matchTo,
          widget: new CitationBadgeWidget(keys, citeMatch[0], matchFrom, matchTo),
        });
      }

      // 2. Match References
      REF_REGEX.lastIndex = 0;
      let refMatch: RegExpExecArray | null;
      while ((refMatch = REF_REGEX.exec(text)) !== null) {
        const matchFrom = lineFrom + refMatch.index;
        const matchTo = matchFrom + refMatch[0].length;

        // Skip if cursor or selection overlaps
        if (selection.from <= matchTo && selection.to >= matchFrom) {
          continue;
        }

        const isEq = refMatch[0].startsWith('\\eqref');
        const label = refMatch[1].trim();

        badges.push({
          from: matchFrom,
          to: matchTo,
          widget: new ReferenceBadgeWidget(label, refMatch[0], isEq, matchFrom, matchTo),
        });
      }

      // 3. Match Hyperlinks (\href{url}{label})
      HREF_PREFIX_REGEX.lastIndex = 0;
      let hrefMatch: RegExpExecArray | null;
      while ((hrefMatch = HREF_PREFIX_REGEX.exec(text)) !== null) {
        const openUrlBrace = hrefMatch.index + hrefMatch[0].length - 1;
        const closeUrlBrace = findMatchingBrace(text, openUrlBrace);
        if (closeUrlBrace === null) continue;

        let labelOpenBrace = closeUrlBrace + 1;
        while (labelOpenBrace < text.length && /\s/.test(text[labelOpenBrace]!)) {
          labelOpenBrace++;
        }
        if (text[labelOpenBrace] !== '{') continue;

        const closeLabelBrace = findMatchingBrace(text, labelOpenBrace);
        if (closeLabelBrace === null) continue;

        const matchFrom = lineFrom + hrefMatch.index;
        const matchTo = lineFrom + closeLabelBrace + 1;
        HREF_PREFIX_REGEX.lastIndex = closeLabelBrace + 1;

        if (selection.from <= matchTo && selection.to >= matchFrom) {
          continue;
        }

        const url = text.slice(openUrlBrace + 1, closeUrlBrace).trim();
        const rawLabel = text.slice(labelOpenBrace + 1, closeLabelBrace);
        const label = cleanInlineMarkup(rawLabel) || url;
        const rawText = text.slice(hrefMatch.index, closeLabelBrace + 1);
        const editOffsetInRaw = labelOpenBrace + 1 - hrefMatch.index;

        badges.push({
          from: matchFrom,
          to: matchTo,
          widget: new LinkBadgeWidget(url, label, rawText, editOffsetInRaw),
        });
      }

      // 4. Match Standalone URLs (\url{url})
      URL_PREFIX_REGEX.lastIndex = 0;
      let urlMatch: RegExpExecArray | null;
      while ((urlMatch = URL_PREFIX_REGEX.exec(text)) !== null) {
        const openBrace = urlMatch.index + urlMatch[0].length - 1;
        const closeBrace = findMatchingBrace(text, openBrace);
        if (closeBrace === null) continue;

        const matchFrom = lineFrom + urlMatch.index;
        const matchTo = lineFrom + closeBrace + 1;
        URL_PREFIX_REGEX.lastIndex = closeBrace + 1;

        if (selection.from <= matchTo && selection.to >= matchFrom) {
          continue;
        }

        const url = text.slice(openBrace + 1, closeBrace).trim();
        const rawText = text.slice(urlMatch.index, closeBrace + 1);
        const editOffsetInRaw = openBrace + 1 - urlMatch.index;

        badges.push({
          from: matchFrom,
          to: matchTo,
          widget: new LinkBadgeWidget(url, url, rawText, editOffsetInRaw),
        });
      }

      // 5. Match Footnotes (\footnote{...})
      FOOTNOTE_PREFIX_REGEX.lastIndex = 0;
      let fnMatch: RegExpExecArray | null;
      while ((fnMatch = FOOTNOTE_PREFIX_REGEX.exec(text)) !== null) {
        const openBrace = fnMatch.index + fnMatch[0].length - 1;
        const closeBrace = findMatchingBrace(text, openBrace);
        if (closeBrace === null) continue;

        const matchFrom = lineFrom + fnMatch.index;
        const matchTo = lineFrom + closeBrace + 1;
        FOOTNOTE_PREFIX_REGEX.lastIndex = closeBrace + 1;

        if (selection.from <= matchTo && selection.to >= matchFrom) {
          continue;
        }

        const rawBody = text.slice(openBrace + 1, closeBrace);
        const cleaned = cleanInlineMarkup(rawBody);
        const preview =
          cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
        const rawText = text.slice(fnMatch.index, closeBrace + 1);
        const editOffsetInRaw = openBrace + 1 - fnMatch.index;

        badges.push({
          from: matchFrom,
          to: matchTo,
          widget: new FootnoteBadgeWidget(preview, rawText, editOffsetInRaw),
        });
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

export const latexVisualCitations = (): Extension => [
  ViewPlugin.fromClass(VisualCitationsPlugin, {
    decorations: (v) => v.decorations,
  }),
  visualCitationsTheme,
];
