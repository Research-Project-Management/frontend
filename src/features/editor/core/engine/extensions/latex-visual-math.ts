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
  WidgetType,
} from '@codemirror/view';
import {
  EditorState,
  RangeSetBuilder,
  StateField,
  type Extension,
} from '@codemirror/state';
import katex from 'katex';
import 'katex/contrib/mhchem';
import { findMatchingBrace } from './latex-visual-headings';

// ── KaTeX Render Cache (LRU) ──────────────────────────────────────────────────

const KATEX_CACHE_MAX = 250;
const katexHtmlCache = new Map<string, string>();

function renderKaTeXCached(formula: string, displayMode: boolean): string | null {
  const key = `${displayMode ? 'D:' : 'I:'}${formula}`;
  const cached = katexHtmlCache.get(key);
  if (cached !== undefined) {
    // Refresh LRU order
    katexHtmlCache.delete(key);
    katexHtmlCache.set(key, cached);
    return cached;
  }
  try {
    const html = katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
    });
    if (katexHtmlCache.size >= KATEX_CACHE_MAX) {
      const oldestKey = katexHtmlCache.keys().next().value;
      if (oldestKey !== undefined) katexHtmlCache.delete(oldestKey);
    }
    katexHtmlCache.set(key, html);
    return html;
  } catch {
    return null;
  }
}

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

    const renderedHtml = renderKaTeXCached(this.formula, this.displayMode);
    if (renderedHtml !== null) {
      container.innerHTML = renderedHtml;
    } else {
      container.textContent = this.formula;
    }

    container.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const currentPos = view.posAtDOM(container);
      const docLen = view.state.doc.length;
      const targetPos = Math.max(
        0,
        Math.min(this.to, docLen, Math.max(this.from, currentPos + (this.displayMode ? 2 : 1))),
      );
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

const DISPLAY_DOLLAR_REGEX = /\$\$([\s\S]*?)\$\$/g;
const BRACKET_MATH_REGEX = /\\\[([\s\S]*?)\\\]/g;
const ENV_MATH_REGEX = /\\begin\{(equation\*?|align\*?|gather\*?|multline\*?)\}([\s\S]*?)\\end\{\1\}/g;
const INLINE_DOLLAR_REGEX = /(?<!\$)\$(?!\$)([^\$\n]+?)(?<!\$)\$(?!\$)/g;
const CE_PREFIX_REGEX = /\\ce\{/g;

function findMathSpans(text: string, offset: number): MathSpan[] {
  const spans: MathSpan[] = [];
  const hasDollar = text.indexOf('$') !== -1;
  const hasBackslash = text.indexOf('\\') !== -1;

  if (!hasDollar && !hasBackslash) {
    return spans;
  }

  let match: RegExpExecArray | null;

  // 1. Double dollar $$ ... $$
  if (hasDollar) {
    DISPLAY_DOLLAR_REGEX.lastIndex = 0;
    while ((match = DISPLAY_DOLLAR_REGEX.exec(text)) !== null) {
      spans.push({
        formula: match[1].trim(),
        displayMode: true,
        from: offset + match.index,
        to: offset + match.index + match[0].length,
      });
    }
  }

  // 2. Bracket math \[ ... \] & 3. Environment math \begin{equation} ... \end{equation}
  if (hasBackslash) {
    BRACKET_MATH_REGEX.lastIndex = 0;
    while ((match = BRACKET_MATH_REGEX.exec(text)) !== null) {
      spans.push({
        formula: match[1].trim(),
        displayMode: true,
        from: offset + match.index,
        to: offset + match.index + match[0].length,
      });
    }

    if (text.indexOf('\\begin{') !== -1) {
      ENV_MATH_REGEX.lastIndex = 0;
      while ((match = ENV_MATH_REGEX.exec(text)) !== null) {
        const envName = match[1];
        const innerRaw = match[2].replace(/\\label\{[^}]*\}/g, '').trim();
        let katexFormula = innerRaw;
        if (envName.startsWith('align')) {
          katexFormula = `\\begin{aligned}\n${innerRaw}\n\\end{aligned}`;
        } else if (envName.startsWith('gather')) {
          katexFormula = `\\begin{gathered}\n${innerRaw}\n\\end{gathered}`;
        }
        spans.push({
          formula: katexFormula,
          displayMode: true,
          from: offset + match.index,
          to: offset + match.index + match[0].length,
        });
      }
    }
  }

  // 4. Single dollar $ ... $ (exclude $$ ... $$)
  if (hasDollar) {
    INLINE_DOLLAR_REGEX.lastIndex = 0;
    while ((match = INLINE_DOLLAR_REGEX.exec(text)) !== null) {
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
  }

  // 5. Standalone mhchem chemical formulas \ce{...} outside math spans
  if (hasBackslash && text.indexOf('\\ce{') !== -1) {
    CE_PREFIX_REGEX.lastIndex = 0;
    while ((match = CE_PREFIX_REGEX.exec(text)) !== null) {
      const openBrace = match.index + match[0].length - 1;
      const closeBrace = findMatchingBrace(text, openBrace);
      if (closeBrace === null) continue;
      const from = offset + match.index;
      const to = offset + closeBrace + 1;
      CE_PREFIX_REGEX.lastIndex = closeBrace + 1;
      const overlaps = spans.some((s) => from < s.to && to > s.from);
      if (!overlaps) {
        spans.push({
          formula: text.slice(match.index, closeBrace + 1),
          displayMode: false,
          from,
          to,
        });
      }
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

// ── StateField (Required by CM6 for multi-line block replace decorations) ──

function computeMathDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = state.doc;
  const selection = state.selection.main;

  if (doc.length === 0) {
    return builder.finish();
  }

  const allSpans = findMathSpans(doc.toString(), 0);
  allSpans.sort((a, b) => a.from - b.from);

  let lastTo = -1;
  for (const span of allSpans) {
    if (span.from < lastTo) {
      continue;
    }
    lastTo = span.to;

    // If the cursor or selection touches or intersects this math span, reveal raw LaTeX
    const cursorInside = selection.from <= span.to && selection.to >= span.from;
    if (cursorInside) {
      continue;
    }

    const spansMultipleLines =
      doc.lineAt(span.from).number !== doc.lineAt(span.to).number;

    builder.add(
      span.from,
      span.to,
      Decoration.replace({
        widget: new KaTeXWidget(span.formula, span.displayMode, span.from, span.to),
        ...(spansMultipleLines ? { block: true } : {}),
      }),
    );
  }

  return builder.finish();
}

const visualMathField = StateField.define<DecorationSet>({
  create(state) {
    return computeMathDecorations(state);
  },
  update(decorations, tr) {
    if (tr.docChanged || tr.selection) {
      return computeMathDecorations(tr.state);
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const latexVisualMath = (): Extension => [
  visualMathField,
  visualMathTheme,
];
