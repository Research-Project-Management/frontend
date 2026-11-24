/**
 * latex-visual-environments.ts
 *
 * CodeMirror 6 Visual Mode Environments & Comments Extension (Overleaf Visual Editor Parity).
 * - Renders `quote` blocks with a clean vertical accent border and muted italic typography.
 * - Renders `itemize` / `enumerate` lists with indented lines and native bullet / numbered markers.
 * - Collapses `\begin{...}`, `\end{...}`, and standalone `% ...` comment lines when unfocused,
 *   revealing raw LaTeX syntax as soon as the cursor enters that range.
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

class ListMarkerWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }

  eq(other: WidgetType): boolean {
    return other instanceof ListMarkerWidget && other.label === this.label;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-visual-list-bullet';
    span.textContent = this.label;
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const BEGIN_DOC_RE = /^[^%]*\\begin\{document\}/;
const BEGIN_ENV_RE = /^\s*\\begin\{(quote|itemize|enumerate)\}\s*(?:%.*)?$/;
const END_ENV_RE = /^\s*\\end\{(quote|itemize|enumerate)\}\s*(?:%.*)?$/;
const ITEM_LINE_RE = /^(\s*\\item(?:\[([^\]]*)\])?(?:\s+|$))/;
const FULL_COMMENT_LINE_RE = /^\s*%.*$/;

const DECO_HIDDEN_LINE = Decoration.line({ class: 'cm-visual-hidden-line' });
const DECO_HIDDEN_COMMENT_LINE = Decoration.line({ class: 'cm-visual-comment-hidden' });
const DECO_QUOTE_LINE = Decoration.line({ class: 'cm-visual-quote-line' });
const DECO_SYNTAX_HIDE = Decoration.replace({});

const DECO_LIST_DEPTH: Record<number, Decoration> = {
  1: Decoration.line({ class: 'cm-visual-list-line cm-visual-list-d1' }),
  2: Decoration.line({ class: 'cm-visual-list-line cm-visual-list-d2' }),
  3: Decoration.line({ class: 'cm-visual-list-line cm-visual-list-d3' }),
  4: Decoration.line({ class: 'cm-visual-list-line cm-visual-list-d4' }),
};

type EnvKind = 'quote' | 'itemize' | 'enumerate';

interface EnvStackFrame {
  kind: EnvKind;
  counter: number;
}

class VisualEnvironmentsPlugin {
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
    const doc = view.state.doc;
    if (doc.length === 0) return Decoration.none;

    const visibleRanges = view.visibleRanges;
    if (visibleRanges.length === 0) return Decoration.none;

    const maxVisibleTo = visibleRanges[visibleRanges.length - 1]!.to;
    const maxVisibleLine = doc.lineAt(Math.min(maxVisibleTo, doc.length)).number;

    const visibleLineSet = new Set<number>();
    for (const { from, to } of visibleRanges) {
      const startL = doc.lineAt(from).number;
      const endL = doc.lineAt(to).number;
      for (let l = startL; l <= endL; l++) {
        visibleLineSet.add(l);
      }
    }

    const selection = view.state.selection.main;

    // Locate preamble end so preamble lines are never tagged as body comments/envs
    let bodyStartLine = 1;
    const preambleScanLimit = Math.min(doc.lines, 400);
    for (let l = 1; l <= preambleScanLimit; l++) {
      if (BEGIN_DOC_RE.test(doc.line(l).text)) {
        bodyStartLine = l + 1;
        break;
      }
    }

    interface PendingDeco {
      from: number;
      to: number;
      deco: Decoration;
    }
    const pending: PendingDeco[] = [];
    const stack: EnvStackFrame[] = [];

    for (let l = bodyStartLine; l <= maxVisibleLine; l++) {
      const line = doc.line(l);
      const text = line.text;
      const isVisible = visibleLineSet.has(l);
      const isCursorOnLine = selection.from <= line.to && selection.to >= line.from;

      const beginMatch = BEGIN_ENV_RE.exec(text);
      if (beginMatch) {
        stack.push({ kind: beginMatch[1] as EnvKind, counter: 0 });
        if (isVisible && !isCursorOnLine) {
          pending.push({ from: line.from, to: line.from, deco: DECO_HIDDEN_LINE });
          if (line.to > line.from) {
            pending.push({ from: line.from, to: line.to, deco: DECO_HIDDEN_INLINE_SAFE });
          }
        }
        continue;
      }

      const endMatch = END_ENV_RE.exec(text);
      if (endMatch) {
        const closingKind = endMatch[1] as EnvKind;
        for (let idx = stack.length - 1; idx >= 0; idx--) {
          if (stack[idx]!.kind === closingKind) {
            stack.splice(idx);
            break;
          }
        }
        if (isVisible && !isCursorOnLine) {
          pending.push({ from: line.from, to: line.from, deco: DECO_HIDDEN_LINE });
          if (line.to > line.from) {
            pending.push({ from: line.from, to: line.to, deco: DECO_HIDDEN_INLINE_SAFE });
          }
        }
        continue;
      }

      // Check standalone comments in document body
      if (FULL_COMMENT_LINE_RE.test(text)) {
        if (isVisible && !isCursorOnLine) {
          pending.push({ from: line.from, to: line.from, deco: DECO_HIDDEN_COMMENT_LINE });
          if (line.to > line.from) {
            pending.push({ from: line.from, to: line.to, deco: DECO_SYNTAX_HIDE });
          }
        }
        continue;
      }

      const activeFrame = stack[stack.length - 1];
      if (!activeFrame) continue;

      if (activeFrame.kind === 'quote') {
        if (isVisible && text.trim().length > 0) {
          pending.push({ from: line.from, to: line.from, deco: DECO_QUOTE_LINE });
        }
        continue;
      }

      // Active list environment (`itemize` or `enumerate`)
      const listDepth = Math.min(
        4,
        stack.filter((f) => f.kind === 'itemize' || f.kind === 'enumerate').length,
      );
      const itemMatch = ITEM_LINE_RE.exec(text);
      if (itemMatch) {
        activeFrame.counter += 1;
        if (isVisible) {
          const customLabel = itemMatch[2]?.trim();
          const markerText = customLabel
            ? `${customLabel} `
            : activeFrame.kind === 'enumerate'
              ? `${activeFrame.counter}. `
              : '• ';

          pending.push({
            from: line.from,
            to: line.from,
            deco: DECO_LIST_DEPTH[listDepth] ?? DECO_LIST_DEPTH[1]!,
          });

          const cmdFrom = line.from;
          const cmdTo = line.from + itemMatch[1]!.length;
          // Keep bullet visible when cursor starts at item content (`selection.from === cmdTo`)
          const isCursorInItemPrefix =
            selection.from < cmdTo && selection.to >= cmdFrom;
          if (!isCursorInItemPrefix && cmdTo > cmdFrom) {
            pending.push({
              from: cmdFrom,
              to: cmdTo,
              deco: Decoration.replace({ widget: new ListMarkerWidget(markerText) }),
            });
          }
        }
      } else if (isVisible && text.trim().length > 0) {
        pending.push({
          from: line.from,
          to: line.from,
          deco: DECO_LIST_DEPTH[listDepth] ?? DECO_LIST_DEPTH[1]!,
        });
      }
    }

    pending.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      if (a.deco.startSide !== b.deco.startSide) return a.deco.startSide - b.deco.startSide;
      return b.to - a.to;
    });

    const builder = new RangeSetBuilder<Decoration>();
    for (const item of pending) {
      builder.add(item.from, item.to, item.deco);
    }
    return builder.finish();
  }
}

const DECO_HIDDEN_INLINE_SAFE = DECO_SYNTAX_HIDE;

const visualEnvironmentsTheme = EditorView.baseTheme({
  '.cm-visual-comment-hidden': {
    height: '0 !important',
    minHeight: '0 !important',
    paddingTop: '0 !important',
    paddingBottom: '0 !important',
    marginTop: '0 !important',
    marginBottom: '0 !important',
    lineHeight: '0 !important',
    fontSize: '0 !important',
    overflow: 'hidden !important',
  },
  '.cm-visual-quote-line': {
    borderLeft: '3px solid var(--border, #cbd5e1)',
    paddingLeft: '16px !important',
    marginLeft: '4px',
    color: 'var(--muted-foreground, #475569)',
    fontStyle: 'italic',
    backgroundColor: 'color-mix(in oklch, var(--muted, #f1f5f9) 45%, transparent)',
  },
  '.cm-visual-list-line': {
    paddingLeft: '24px !important',
  },
  '.cm-visual-list-d2': {
    paddingLeft: '42px !important',
  },
  '.cm-visual-list-d3': {
    paddingLeft: '60px !important',
  },
  '.cm-visual-list-d4': {
    paddingLeft: '78px !important',
  },
  '.cm-visual-list-bullet': {
    display: 'inline-block',
    minWidth: '1.1em',
    fontWeight: '600',
    color: 'var(--primary, #2563eb)',
    userSelect: 'none',
    marginRight: '4px',
  },
});

export const latexVisualEnvironments = (): Extension => [
  ViewPlugin.fromClass(VisualEnvironmentsPlugin, {
    decorations: (v) => v.decorations,
  }),
  visualEnvironmentsTheme,
];
