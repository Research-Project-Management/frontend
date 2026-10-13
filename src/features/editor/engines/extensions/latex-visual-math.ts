/**
 * latex-visual-math.ts
 *
 * CodeMirror 6 Visual Mode KaTeX Math Widget Extension.
 * Location: `frontend/src/features/editor/engines/extensions/latex-visual-math.ts`
 *
 * Replaces inline and display LaTeX math with live rendered KaTeX widgets.
 * Seamless click-to-edit: Clicking any rendered math widget immediately reveals
 * the raw LaTeX text and positions the cursor for instant typing.
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
import katex from 'katex';

// ── KaTeX Math Widget ─────────────────────────────────────────────────────────

class KaTeXWidget extends WidgetType {
  constructor(
    public readonly formula: string,
    public readonly displayMode: boolean,
    public readonly from: number,
    public readonly to: number,
  ) {
    super();
  }

  override eq(other: KaTeXWidget): boolean {
    return (
      this.formula === other.formula &&
      this.displayMode === other.displayMode &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  override ignoreEvent(event: Event): boolean {
    // Intercept click to place cursor inside the math formula
    return event.type !== 'click';
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement(this.displayMode ? 'div' : 'span');
    container.className = this.displayMode
      ? 'cm-visual-math-display'
      : 'cm-visual-math-inline';
    container.title = 'Click to edit LaTeX formula';

    try {
      katex.render(this.formula, container, {
        displayMode: this.displayMode,
        throwOnError: false,
        output: 'htmlAndMathml',
      });
    } catch {
      container.textContent = this.formula;
    }

    container.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Place cursor right after the opening delimiter
      const targetPos = Math.min(this.from + (this.displayMode ? 2 : 1), this.to);
      view.dispatch({
        selection: { anchor: targetPos, head: targetPos },
        scrollIntoView: true,
      });
      view.focus();
    });

    return container;
  }
}

// ── Math Scanner ──────────────────────────────────────────────────────────────

interface MathSpan {
  readonly formula: string;
  readonly displayMode: boolean;
  readonly from: number;
  readonly to: number;
}

function findMathSpans(text: string, offset: number): MathSpan[] {
  const spans: MathSpan[] = [];

  // 1. Double dollar $$ ... $$
  const displayDollarRegex = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = displayDollarRegex.exec(text)) !== null) {
    spans.push({
      formula: match[1].trim(),
      displayMode: true,
      from: offset + match.index,
      to: offset + match.index + match[0].length,
    });
  }

  // 2. Bracket math \[ ... \]
  const bracketRegex = /\\\[([\s\S]*?)\\\]/g;
  while ((match = bracketRegex.exec(text)) !== null) {
    spans.push({
      formula: match[1].trim(),
      displayMode: true,
      from: offset + match.index,
      to: offset + match.index + match[0].length,
    });
  }

  // 3. Environment math \begin{equation} ... \end{equation}
  const envRegex = /\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}/g;
  while ((match = envRegex.exec(text)) !== null) {
    spans.push({
      formula: match[0],
      displayMode: true,
      from: offset + match.index,
      to: offset + match.index + match[0].length,
    });
  }

  // 4. Single dollar $ ... $ (exclude $$ ... $$)
  const inlineDollarRegex = /(?<!\$)\$(?!\$)([^\$\n]+?)(?<!\$)\$(?!\$)/g;
  while ((match = inlineDollarRegex.exec(text)) !== null) {
    const from = offset + match.index;
    const to = from + match[0].length;
    // Ensure this span doesn't overlap with any display spans
    const overlaps = spans.some((s) => s.from <= from && s.to >= to);
    if (!overlaps) {
      spans.push({
        formula: match[1].trim(),
        displayMode: false,
        from,
        to,
      });
    }
  }

  return spans;
}

// ── Visual Math Theme ─────────────────────────────────────────────────────────

const visualMathTheme = EditorView.baseTheme({
  '.cm-visual-math-inline': {
    display: 'inline-block',
    padding: '0 3px',
    margin: '0 1px',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    border: '1px solid transparent',
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    verticalAlign: 'baseline',
    '&:hover': {
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      borderColor: 'rgba(59, 130, 246, 0.25)',
    },
  },
  '.cm-visual-math-display': {
    display: 'flex',
    justifyContent: 'center',
    padding: '12px 16px',
    margin: '6px 0',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: 'rgba(59, 130, 246, 0.03)',
    border: '1px solid rgba(59, 130, 246, 0.08)',
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    '&:hover': {
      backgroundColor: 'rgba(59, 130, 246, 0.08)',
      borderColor: 'rgba(59, 130, 246, 0.25)',
    },
  },
});

// ── ViewPlugin ───────────────────────────────────────────────────────────────

class VisualMathPlugin {
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

    const allSpans: MathSpan[] = [];

    for (const { from, to } of view.visibleRanges) {
      const lineFrom = doc.lineAt(from).from;
      const lineTo = doc.lineAt(to).to;
      const expandedFrom = Math.max(0, lineFrom - 500);
      const expandedTo = Math.min(doc.length, lineTo + 500);
      const text = doc.sliceString(expandedFrom, expandedTo);
      const spans = findMathSpans(text, expandedFrom);
      allSpans.push(...spans);
    }

    // Sort spans strictly by start position
    allSpans.sort((a, b) => a.from - b.from);

    // Filter overlapping spans and spans containing cursor
    let lastTo = -1;
    for (const span of allSpans) {
      if (span.from < lastTo) {
        continue; // Skip overlapping
      }
      lastTo = span.to;

      // If the cursor or selection touches or intersects this math span, reveal the raw LaTeX!
      const cursorInside = selection.from <= span.to && selection.to >= span.from;
      if (cursorInside) {
        continue;
      }

      builder.add(
        span.from,
        span.to,
        Decoration.replace({
          widget: new KaTeXWidget(span.formula, span.displayMode, span.from, span.to),
        })
      );
    }

    return builder.finish();
  }
}

export const latexVisualMath = (): Extension => [
  ViewPlugin.fromClass(VisualMathPlugin, {
    decorations: (v) => v.decorations,
  }),
  visualMathTheme,
];
