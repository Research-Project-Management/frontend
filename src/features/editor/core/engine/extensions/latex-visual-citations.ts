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

    const icon = document.createElement('span');
    icon.className = 'cm-visual-citation-icon';
    icon.textContent = '📚';

    const text = document.createElement('span');
    text.className = 'cm-visual-citation-label';
    text.textContent = this.keys.map((k) => `@${k}`).join(', ');

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

// ── Matchers ──────────────────────────────────────────────────────────────────

const CITE_REGEX =
  /\\(?:auto|paren|text|foot|no|new|short)?cite(?:p|t|alt|alp|author|year|date|num)?\*?(?:\[[^\]]*\])*(?:\[[^\]]*\])*\{([^}]+)\}/gi;

const REF_REGEX = /\\(?:eq|auto|c|page|name)?ref\*?\{([^}]+)\}/gi;

// ── Theme ─────────────────────────────────────────────────────────────────────

const visualCitationsTheme = EditorView.baseTheme({
  '.cm-visual-citation-chip': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    padding: '1px 6px',
    margin: '0 2px',
    borderRadius: '12px',
    fontSize: '0.85em',
    lineHeight: '1.4',
    cursor: 'pointer',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    color: 'var(--primary, #4f46e5)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    transition: 'all 0.15s ease',
    verticalAlign: 'baseline',
    '&:hover': {
      backgroundColor: 'rgba(99, 102, 241, 0.16)',
      borderColor: 'rgba(99, 102, 241, 0.4)',
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
    borderRadius: '10px',
    fontSize: '0.85em',
    lineHeight: '1.4',
    cursor: 'pointer',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    color: '#059669',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    transition: 'all 0.15s ease',
    verticalAlign: 'baseline',
    '&:hover': {
      backgroundColor: 'rgba(16, 185, 129, 0.16)',
      borderColor: 'rgba(16, 185, 129, 0.4)',
    },
  },
  '.cm-visual-ref-icon': {
    fontSize: '0.85em',
  },
  '.cm-visual-ref-label': {
    fontWeight: '500',
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
    }

    // Sort strictly by position
    badges.sort((a, b) => a.from - b.from);

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
