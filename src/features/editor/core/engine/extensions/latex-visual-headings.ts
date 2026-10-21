/**
 * latex-visual-headings.ts
 *
 * CodeMirror 6 Visual Mode Headings & Typography Extension.
 * Location: `frontend/src/features/editor/engines/extensions/latex-visual-headings.ts`
 *
 * Replaces lossy contentEditable conversions with Overleaf-style non-destructive
 * AST/regex decorations. The underlying LaTeX buffer remains 100% untouched.
 *
 * Supported Elements:
 * - \section, \subsection, \subsubsection, \chapter, \paragraph
 * - \textbf{...}, \textit{...}
 * - Cursor-reveal: Dimmed/hidden syntax expands cleanly when the cursor enters the line.
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder, type Extension } from '@codemirror/state';

// ── Types & Matches ──────────────────────────────────────────────────────────

interface HeadingMatch {
  readonly level: 'chapter' | 'h1' | 'h2' | 'h3' | 'paragraph';
  readonly from: number;
  readonly to: number;
  readonly commandFrom: number;
  readonly commandTo: number;
  readonly textFrom: number;
  readonly textTo: number;
}

interface InlineFormatMatch {
  readonly type: 'bold' | 'italic';
  readonly from: number;
  readonly to: number;
  readonly openFrom: number;
  readonly openTo: number;
  readonly textFrom: number;
  readonly textTo: number;
  readonly closeFrom: number;
  readonly closeTo: number;
}

/**
 * Safely finds the matching closing brace '}' for an opening brace '{' at openBraceIndex,
 * accounting for nested braces and escaped braces \{ and \}.
 */
export function findMatchingBrace(text: string, openBraceIndex: number): number | null {
  if (text[openBraceIndex] !== '{') return null;
  let depth = 0;
  for (let i = openBraceIndex; i < text.length; i++) {
    const char = text[i];
    if (char === '\\') {
      i++; // Skip escaped character like \{ or \}
      continue;
    }
    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return null;
}

const HEADING_PREFIX_REGEX = /\\(chapter|section|subsection|subsubsection|paragraph)\*?\{/g;
const BOLD_PREFIX_REGEX = /\\textbf\{/g;
const ITALIC_PREFIX_REGEX = /\\textit\{/g;

const LEVEL_CLASS_MAP = {
  chapter: 'cm-visual-chapter',
  h1: 'cm-visual-h1',
  h2: 'cm-visual-h2',
  h3: 'cm-visual-h3',
  paragraph: 'cm-visual-paragraph',
} as const;

const DECO_LINE_BY_LEVEL: Record<HeadingMatch['level'], Decoration> = {
  chapter: Decoration.line({ class: LEVEL_CLASS_MAP.chapter }),
  h1: Decoration.line({ class: LEVEL_CLASS_MAP.h1 }),
  h2: Decoration.line({ class: LEVEL_CLASS_MAP.h2 }),
  h3: Decoration.line({ class: LEVEL_CLASS_MAP.h3 }),
  paragraph: Decoration.line({ class: LEVEL_CLASS_MAP.paragraph }),
};

const DECO_SYNTAX_DIM = Decoration.mark({ class: 'cm-visual-syntax-dim' });
const DECO_BOLD_TEXT = Decoration.mark({ class: 'cm-visual-bold-text' });
const DECO_ITALIC_TEXT = Decoration.mark({ class: 'cm-visual-italic-text' });

// ── Visual Decorations Theme ──────────────────────────────────────────────────

const visualHeadingsTheme = EditorView.baseTheme({
  '.cm-visual-chapter': {
    fontSize: '1.75rem',
    fontWeight: '800',
    lineHeight: '1.25',
    color: 'var(--foreground, #0f172a)',
  },
  '.cm-visual-h1': {
    fontSize: '1.45rem',
    fontWeight: '700',
    lineHeight: '1.3',
    color: 'var(--foreground, #0f172a)',
  },
  '.cm-visual-h2': {
    fontSize: '1.25rem',
    fontWeight: '600',
    lineHeight: '1.35',
    color: 'var(--foreground, #0f172a)',
  },
  '.cm-visual-h3': {
    fontSize: '1.1rem',
    fontWeight: '600',
    lineHeight: '1.4',
    color: 'var(--foreground, #0f172a)',
  },
  '.cm-visual-paragraph': {
    fontSize: '1.02rem',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  '.cm-visual-syntax-dim': {
    opacity: '0.22',
    fontSize: '0.78em',
    letterSpacing: '-0.02em',
    transition: 'opacity 0.15s ease',
  },
  '.cm-visual-bold-text': {
    fontWeight: '700',
  },
  '.cm-visual-italic-text': {
    fontStyle: 'italic',
  },
});

// ── ViewPlugin ───────────────────────────────────────────────────────────────

class VisualHeadingsPlugin {
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

    // Fast return if document is empty
    if (doc.length === 0) {
      return builder.finish();
    }

    // Collect all decorations in sorted order
    interface PendingDecoration {
      readonly from: number;
      readonly to: number;
      readonly deco: Decoration;
    }
    const pending: PendingDecoration[] = [];

    for (const { from, to } of view.visibleRanges) {
      const startLine = doc.lineAt(from);
      const endLine = doc.lineAt(to);

      for (let l = startLine.number; l <= endLine.number; l++) {
        const line = doc.line(l);
        const lineText = line.text;
        // Fast-path guard: skip regex engines on lines with no LaTeX commands
        if (lineText.indexOf('\\') === -1) continue;

        const isCursorOnLine = selection.from <= line.to && selection.to >= line.from;

        // 1. Scan for Headings with balanced braces
        HEADING_PREFIX_REGEX.lastIndex = 0;
        let headingMatch: RegExpExecArray | null;
        while ((headingMatch = HEADING_PREFIX_REGEX.exec(lineText)) !== null) {
          const openBraceIndex = headingMatch.index + headingMatch[0].length - 1;
          const closeBraceIndex = findMatchingBrace(lineText, openBraceIndex);
          if (closeBraceIndex === null) continue;

          const matchStart = line.from + headingMatch.index;
          const matchEnd = line.from + closeBraceIndex + 1;
          const cmdType = headingMatch[1];

          const level: HeadingMatch['level'] =
            cmdType === 'chapter'
              ? 'chapter'
              : cmdType === 'section'
              ? 'h1'
              : cmdType === 'subsection'
              ? 'h2'
              : cmdType === 'subsubsection'
              ? 'h3'
              : 'paragraph';

          // Apply line style
          pending.push({
            from: line.from,
            to: line.from,
            deco: DECO_LINE_BY_LEVEL[level],
          });

          // If cursor is not on this line, dim the macro syntax `\section{` and `}`
          if (!isCursorOnLine) {
            const openCmdStart = matchStart;
            const openCmdEnd = line.from + openBraceIndex + 1;
            const closeBraceStart = line.from + closeBraceIndex;
            const closeBraceEnd = matchEnd;

            pending.push({
              from: openCmdStart,
              to: openCmdEnd,
              deco: DECO_SYNTAX_DIM,
            });
            pending.push({
              from: closeBraceStart,
              to: closeBraceEnd,
              deco: DECO_SYNTAX_DIM,
            });
          }
        }

        // 2. Scan for \textbf{...} with balanced braces
        BOLD_PREFIX_REGEX.lastIndex = 0;
        let boldMatch: RegExpExecArray | null;
        while ((boldMatch = BOLD_PREFIX_REGEX.exec(lineText)) !== null) {
          const openBraceIndex = boldMatch.index + boldMatch[0].length - 1;
          const closeBraceIndex = findMatchingBrace(lineText, openBraceIndex);
          if (closeBraceIndex === null) continue;

          const matchStart = line.from + boldMatch.index;
          const matchEnd = line.from + closeBraceIndex + 1;
          const isCursorInMatch = selection.from <= matchEnd && selection.to >= matchStart;

          const textStart = line.from + openBraceIndex + 1;
          const textEnd = line.from + closeBraceIndex;

          if (textEnd > textStart) {
            pending.push({
              from: textStart,
              to: textEnd,
              deco: DECO_BOLD_TEXT,
            });
          }

          if (!isCursorInMatch) {
            pending.push({
              from: matchStart,
              to: textStart,
              deco: DECO_SYNTAX_DIM,
            });
            pending.push({
              from: textEnd,
              to: matchEnd,
              deco: DECO_SYNTAX_DIM,
            });
          }
        }

        // 3. Scan for \textit{...} with balanced braces
        ITALIC_PREFIX_REGEX.lastIndex = 0;
        let italicMatch: RegExpExecArray | null;
        while ((italicMatch = ITALIC_PREFIX_REGEX.exec(lineText)) !== null) {
          const openBraceIndex = italicMatch.index + italicMatch[0].length - 1;
          const closeBraceIndex = findMatchingBrace(lineText, openBraceIndex);
          if (closeBraceIndex === null) continue;

          const matchStart = line.from + italicMatch.index;
          const matchEnd = line.from + closeBraceIndex + 1;
          const isCursorInMatch = selection.from <= matchEnd && selection.to >= matchStart;

          const textStart = line.from + openBraceIndex + 1;
          const textEnd = line.from + closeBraceIndex;

          if (textEnd > textStart) {
            pending.push({
              from: textStart,
              to: textEnd,
              deco: DECO_ITALIC_TEXT,
            });
          }

          if (!isCursorInMatch) {
            pending.push({
              from: matchStart,
              to: textStart,
              deco: DECO_SYNTAX_DIM,
            });
            pending.push({
              from: textEnd,
              to: matchEnd,
              deco: DECO_SYNTAX_DIM,
            });
          }
        }
      }
    }

    // Sort pending decorations:
    // 1. start position ascending (from)
    // 2. outer/longer ranges before inner ranges (b.to - a.to)
    pending.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      if (a.deco.startSide !== b.deco.startSide) return a.deco.startSide - b.deco.startSide;
      if (a.to !== b.to) return b.to - a.to;
      return 0;
    });

    for (const item of pending) {
      builder.add(item.from, item.to, item.deco);
    }

    return builder.finish();
  }
}

export const latexVisualHeadings = (): Extension => [
  ViewPlugin.fromClass(VisualHeadingsPlugin, {
    decorations: (v) => v.decorations,
  }),
  visualHeadingsTheme,
];
