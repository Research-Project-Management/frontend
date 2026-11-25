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
import { findBeginDocumentLine } from './latex-visual-document-shell';

class ListMarkerWidget extends WidgetType {
  constructor(
    readonly label: string,
    readonly isTerm: boolean = false,
  ) {
    super();
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof ListMarkerWidget &&
      other.label === this.label &&
      other.isTerm === this.isTerm
    );
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = this.isTerm ? 'cm-visual-list-term' : 'cm-visual-list-bullet';
    span.textContent = this.label;
    return span;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

const BEGIN_ENV_RE = /^\s*\\begin\{(quote|itemize|enumerate|description)\}\s*(?:%.*)?$/;
const END_ENV_RE = /^\s*\\end\{(quote|itemize|enumerate|description)\}\s*(?:%.*)?$/;
const ITEM_LINE_RE = /^(\s*\\item(?:\[([^\]]*)\])?(?:\s+|$))/;
const FULL_COMMENT_LINE_RE = /^\s*%.*$/;

function countPrecedingBackslashes(text: string, idx: number): number {
  let count = 0;
  for (let j = idx - 1; j >= 0 && text[j] === '\\'; j--) {
    count++;
  }
  return count;
}

function findInlineCommentStart(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '%' && countPrecedingBackslashes(text, i) % 2 === 0) {
      return i;
    }
  }
  return -1;
}

const DECO_HIDDEN_LINE = Decoration.line({ class: 'cm-visual-hidden-line' });
const DECO_COMMENT_TEXT = Decoration.mark({ class: 'cm-visual-comment-text' });
const DECO_QUOTE_LINE = Decoration.line({ class: 'cm-visual-quote-line' });
const DECO_SYNTAX_HIDE = Decoration.replace({});

const DECO_LIST_DEPTH: Record<number, Decoration> = {
  1: Decoration.line({ class: 'cm-visual-list-line cm-visual-list-d1' }),
  2: Decoration.line({ class: 'cm-visual-list-line cm-visual-list-d2' }),
  3: Decoration.line({ class: 'cm-visual-list-line cm-visual-list-d3' }),
  4: Decoration.line({ class: 'cm-visual-list-line cm-visual-list-d4' }),
};

type EnvKind =
  | 'quote'
  | 'itemize'
  | 'enumerate'
  | 'description'
  | 'theorem'
  | 'lemma'
  | 'corollary'
  | 'proposition'
  | 'definition'
  | 'remark'
  | 'example'
  | 'proof'
  | 'abstract';

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
    const beginDocLine = findBeginDocumentLine(doc);
    const bodyStartLine = beginDocLine ? beginDocLine.number + 1 : 1;

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
        if (isVisible) {
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
        if (isVisible) {
          pending.push({ from: line.from, to: line.from, deco: DECO_HIDDEN_LINE });
          if (line.to > line.from) {
            pending.push({ from: line.from, to: line.to, deco: DECO_HIDDEN_INLINE_SAFE });
          }
        }
        continue;
      }

      // Style standalone comments in muted green/teal (Overleaf parity: keep visible at exact line number)
      if (FULL_COMMENT_LINE_RE.test(text)) {
        if (isVisible && line.to > line.from) {
          pending.push({ from: line.from, to: line.to, deco: DECO_COMMENT_TEXT });
        }
        continue;
      }

      const activeFrame = stack[stack.length - 1];
      const inlineCommentIdx = findInlineCommentStart(text);
      let itemCmdEnd = line.from;

      if (activeFrame) {
        if (activeFrame.kind === 'quote') {
          if (isVisible) {
            pending.push({ from: line.from, to: line.from, deco: DECO_QUOTE_LINE });
          }
        } else {
          // Active list environment (`itemize`, `enumerate`, or `description`)
          const listDepth = Math.min(
            4,
            stack.filter(
              (f) =>
                f.kind === 'itemize' ||
                f.kind === 'enumerate' ||
                f.kind === 'description',
            ).length,
          );
          const itemMatch = ITEM_LINE_RE.exec(text);
          if (itemMatch) {
            activeFrame.counter += 1;
            if (isVisible) {
              const customLabel = itemMatch[2]?.trim();
              const isDescriptionTerm =
                activeFrame.kind === 'description' && Boolean(customLabel);
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
              itemCmdEnd = cmdTo;
              // Keep bullet/term visible when cursor starts at item content (`selection.from === cmdTo`)
              const isCursorInItemPrefix =
                selection.from < cmdTo && selection.to >= cmdFrom;
              if (!isCursorInItemPrefix && cmdTo > cmdFrom) {
                pending.push({
                  from: cmdFrom,
                  to: cmdTo,
                  deco: Decoration.replace({
                    widget: new ListMarkerWidget(markerText, isDescriptionTerm),
                  }),
                });
              }
            }
          } else {
            const visibleText =
              inlineCommentIdx > 0 ? text.slice(0, inlineCommentIdx) : text;
            if (isVisible && visibleText.trim().length > 0) {
              pending.push({
                from: line.from,
                to: line.from,
                deco: DECO_LIST_DEPTH[listDepth] ?? DECO_LIST_DEPTH[1]!,
              });
            }
          }
        }
      }

      if (isVisible && !isCursorOnLine) {
        const prefixEnd = inlineCommentIdx > 0 ? inlineCommentIdx : text.length;
        const scanStart = Math.max(0, itemCmdEnd - line.from);
        for (let i = scanStart; i < prefixEnd; i++) {
          const ch = text[i];
          if (
            (ch === '%' || ch === '&' || ch === '_' || ch === '$' || ch === '#') &&
            countPrecedingBackslashes(text, i) % 2 === 1
          ) {
            pending.push({
              from: line.from + i - 1,
              to: line.from + i,
              deco: DECO_SYNTAX_HIDE,
            });
          }
        }

        if (inlineCommentIdx > 0 && line.from + inlineCommentIdx >= itemCmdEnd) {
          pending.push({
            from: line.from + inlineCommentIdx,
            to: line.to,
            deco: DECO_COMMENT_TEXT,
          });
        }
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
  '.cm-visual-comment-text': {
    color: 'color-mix(in srgb, var(--success) 55%, var(--muted-foreground))',
  },
  '.cm-visual-quote-line': {
    borderLeft: '1px solid var(--border)',
    paddingLeft: '16px !important',
    marginLeft: '4px',
    color: 'var(--muted-foreground)',
    fontStyle: 'italic',
    backgroundColor: 'color-mix(in oklch, var(--muted) 40%, transparent)',
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
    color: 'var(--muted-foreground)',
    userSelect: 'none',
    marginRight: '4px',
  },
  '.cm-visual-list-term': {
    display: 'inline-block',
    fontWeight: '600',
    color: 'var(--foreground)',
    marginRight: '6px',
  },
});

const visualEnvironmentsPlugin = ViewPlugin.fromClass(VisualEnvironmentsPlugin, {
  decorations: (v) => v.decorations,
});

export const latexVisualEnvironments = (): Extension => [
  visualEnvironmentsPlugin,
  EditorView.atomicRanges.of((view) => view.plugin(visualEnvironmentsPlugin)?.decorations ?? Decoration.none),
  visualEnvironmentsTheme,
];
