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
 * - \textbf{...}, \textit{...}, \emph{...}, \underline{...}, \texttt{...}
 * - Cursor-reveal: Dimmed/hidden syntax expands cleanly when the cursor enters the line.
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

/**
 * Normalizes simple inline LaTeX markup (formatting commands, \thanks, \label,
 * escaped punctuation) into clean display text for Visual Mode cards and tooltips.
 */
export function cleanInlineLatexText(raw: string): string {
  let out = raw
    .replace(/\\thanks\{[^{}]*\}/g, '')
    .replace(/\\label\{[^{}]*\}/g, '')
    .replace(/\\color(?:\[[^\]]*\])?\{[^{}]*\}/g, '')
    .replace(/\\textcolor(?:\[[^\]]*\])?\{[^{}]*\}\{([^{}]*)\}/g, '$1')
    .replace(
      /\\(?:tiny|scriptsize|footnotesize|small|normalsize|large|Large|LARGE|huge|Huge|bfseries|itshape|mdseries|rmfamily|sffamily|ttfamily|centering)\b/g,
      '',
    )
    .replace(/\\today\b/g, () => new Date().toLocaleDateString())
    .replace(/\\and\b/g, ', ')
    .replace(/\\\\(?:\s*\[[^\]]*\])?/g, ' · ');

  // Unwrap nested inline formatting commands (e.g. \textbf{\color{...} Title})
  const inlineWrapper =
    /\\(?:textbf|textit|emph|underline|texttt|textrm|textsf|textsc|url|ref)\*?\{([^{}]*)\}/g;
  for (let pass = 0; pass < 4; pass++) {
    const next = out.replace(inlineWrapper, '$1');
    if (next === out) break;
    out = next;
  }

  return out
    .replace(/\\([%&_$#])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEADING_PREFIX_REGEX = /\\(title|chapter|section|subsection|subsubsection|paragraph)\*?\{/g;
const INLINE_CMD_PREFIX_REGEX = /\\(textbf|textit|emph|underline|texttt|textsc)\{/g;
const INLINE_LABEL_REGEX = /\\label\{([^{}]*)\}/g;
const INLINE_INPUT_REGEX = /\\(?:input|include)\{([^{}]*)\}/g;
const INLINE_TEXTCOLOR_PREFIX_REGEX = /\\textcolor(?:\[[^\]]*\])?\{[^{}]*\}\{/g;

class LabelTagWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }
  override eq(other: WidgetType): boolean {
    return other instanceof LabelTagWidget && other.label === this.label;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-visual-label-tag';
    span.title = `\\label{${this.label}}`;
    span.textContent = this.label;
    return span;
  }
}

class InputFileWidget extends WidgetType {
  constructor(readonly filePath: string) {
    super();
  }
  override eq(other: WidgetType): boolean {
    return other instanceof InputFileWidget && other.filePath === this.filePath;
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-visual-input-chip';
    span.title = `\\input{${this.filePath}}`;
    span.textContent = this.filePath;
    return span;
  }
}

const LEVEL_CLASS_MAP = {
  chapter: 'cm-visual-line-chapter',
  h1: 'cm-visual-line-h1',
  h2: 'cm-visual-line-h2',
  h3: 'cm-visual-line-h3',
  paragraph: 'cm-visual-line-paragraph',
} as const;

const HEADING_TEXT_CLASS_MAP = {
  chapter: 'cm-visual-heading-chapter',
  h1: 'cm-visual-heading-h1',
  h2: 'cm-visual-heading-h2',
  h3: 'cm-visual-heading-h3',
  paragraph: 'cm-visual-heading-paragraph',
} as const;

const DECO_LINE_BY_LEVEL: Record<HeadingMatch['level'], Decoration> = {
  chapter: Decoration.line({ class: LEVEL_CLASS_MAP.chapter }),
  h1: Decoration.line({ class: LEVEL_CLASS_MAP.h1 }),
  h2: Decoration.line({ class: LEVEL_CLASS_MAP.h2 }),
  h3: Decoration.line({ class: LEVEL_CLASS_MAP.h3 }),
  paragraph: Decoration.line({ class: LEVEL_CLASS_MAP.paragraph }),
};

const DECO_HEADING_TEXT_BY_LEVEL: Record<HeadingMatch['level'], Decoration> = {
  chapter: Decoration.mark({ class: HEADING_TEXT_CLASS_MAP.chapter }),
  h1: Decoration.mark({ class: HEADING_TEXT_CLASS_MAP.h1 }),
  h2: Decoration.mark({ class: HEADING_TEXT_CLASS_MAP.h2 }),
  h3: Decoration.mark({ class: HEADING_TEXT_CLASS_MAP.h3 }),
  paragraph: Decoration.mark({ class: HEADING_TEXT_CLASS_MAP.paragraph }),
};

const DECO_SYNTAX_HIDE = Decoration.replace({});
const DECO_BOLD_TEXT = Decoration.mark({ class: 'cm-visual-bold-text' });
const DECO_ITALIC_TEXT = Decoration.mark({ class: 'cm-visual-italic-text' });
const DECO_UNDERLINE_TEXT = Decoration.mark({ class: 'cm-visual-underline-text' });
const DECO_CODE_TEXT = Decoration.mark({ class: 'cm-visual-code-text' });
const DECO_SMALLCAPS_TEXT = Decoration.mark({ class: 'cm-visual-smallcaps-text' });

const INLINE_DECO_BY_CMD: Record<string, Decoration> = {
  textbf: DECO_BOLD_TEXT,
  textit: DECO_ITALIC_TEXT,
  emph: DECO_ITALIC_TEXT,
  underline: DECO_UNDERLINE_TEXT,
  texttt: DECO_CODE_TEXT,
  textsc: DECO_SMALLCAPS_TEXT,
};

// ── Visual Decorations Theme ──────────────────────────────────────────────────

const visualHeadingsTheme = EditorView.baseTheme({
  // Line classes: gentle line height and vertical breathing room without altering font metrics
  '.cm-visual-line-chapter, .cm-visual-chapter': {
    lineHeight: '1.3',
    paddingTop: '6px',
    paddingBottom: '2px',
  },
  '.cm-visual-line-h1, .cm-visual-h1': {
    lineHeight: '1.35',
    paddingTop: '5px',
    paddingBottom: '2px',
  },
  '.cm-visual-line-h2, .cm-visual-h2': {
    lineHeight: '1.35',
    paddingTop: '4px',
    paddingBottom: '2px',
  },
  '.cm-visual-line-h3, .cm-visual-h3': {
    lineHeight: '1.4',
    paddingTop: '2px',
    paddingBottom: '1px',
  },
  '.cm-visual-line-paragraph, .cm-visual-paragraph': {
    lineHeight: '1.4',
  },

  // Heading title text formatting: applied strictly to the heading content between braces
  // Strictly respects Flux DESIGN.md 600 weight ceiling & optical gray foreground tokens
  '.cm-visual-heading-chapter': {
    fontSize: '1.5rem',
    fontWeight: '600',
    letterSpacing: '-0.02em',
    color: 'var(--foreground)',
  },
  '.cm-visual-heading-h1': {
    fontSize: '1.3rem',
    fontWeight: '600',
    letterSpacing: '-0.015em',
    color: 'var(--foreground)',
  },
  '.cm-visual-heading-h2': {
    fontSize: '1.15rem',
    fontWeight: '600',
    letterSpacing: '-0.01em',
    color: 'var(--foreground)',
  },
  '.cm-visual-heading-h3': {
    fontSize: '1.05rem',
    fontWeight: '600',
    color: 'var(--foreground)',
  },
  '.cm-visual-heading-paragraph': {
    fontSize: '1rem',
    fontWeight: '600',
    fontStyle: 'italic',
  },

  '.cm-visual-bold-text': {
    fontWeight: '600',
  },
  '.cm-visual-italic-text': {
    fontStyle: 'italic',
  },
  '.cm-visual-underline-text': {
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
  '.cm-visual-code-text': {
    fontFamily:
      'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.9em',
    backgroundColor: 'var(--muted)',
    padding: '0 4px',
    borderRadius: '4px',
  },
  '.cm-visual-smallcaps-text': {
    fontVariant: 'small-caps',
  },
  '.cm-visual-label-tag': {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '6px',
    padding: '0 6px',
    fontSize: '12px',
    fontWeight: '400',
    lineHeight: '1.4',
    fontFamily:
      'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    color: 'var(--muted-foreground)',
    backgroundColor: 'var(--canvas)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    verticalAlign: 'middle',
  },
  '.cm-visual-input-chip': {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    fontSize: '13px',
    fontFamily:
      'var(--font-ibm-plex-mono), "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    color: 'var(--primary)',
    backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)',
    borderRadius: '4px',
  },
});

// ── ViewPlugin ───────────────────────────────────────────────────────────────

class VisualHeadingsPlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.computeDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.computeDecorations(update.view);
    }
  }

  private computeDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const doc = view.state.doc;

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
    const seenLines = new Set<number>();

    for (const { from, to } of view.visibleRanges) {
      const startLine = doc.lineAt(from);
      const endLine = doc.lineAt(to);

      for (let l = startLine.number; l <= endLine.number; l++) {
        if (seenLines.has(l)) continue;
        seenLines.add(l);
        const line = doc.line(l);
        const lineText = line.text;
        // Fast-path guard: skip regex engines on lines with no LaTeX commands
        if (lineText.indexOf('\\') === -1) continue;

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
            cmdType === 'title' || cmdType === 'chapter'
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

          const openCmdStart = matchStart;
          const openCmdEnd = line.from + openBraceIndex + 1;
          const textStart = openCmdEnd;
          const textEnd = line.from + closeBraceIndex;
          const closeBraceStart = textEnd;
          const closeBraceEnd = matchEnd;

          // Keep \section{ and } hidden in Visual Mode so typing inside headings never jumps layout
          pending.push({
            from: openCmdStart,
            to: openCmdEnd,
            deco: DECO_SYNTAX_HIDE,
          });
          pending.push({
            from: closeBraceStart,
            to: closeBraceEnd,
            deco: DECO_SYNTAX_HIDE,
          });

          // Style only the inner heading title text
          if (textEnd > textStart) {
            pending.push({
              from: textStart,
              to: textEnd,
              deco: DECO_HEADING_TEXT_BY_LEVEL[level],
            });
          }
        }

        // 2. Scan for inline formatting commands (\textbf, \textit, \emph, \underline, \texttt)
        INLINE_CMD_PREFIX_REGEX.lastIndex = 0;
        let inlineMatch: RegExpExecArray | null;
        while ((inlineMatch = INLINE_CMD_PREFIX_REGEX.exec(lineText)) !== null) {
          const deco = INLINE_DECO_BY_CMD[inlineMatch[1]];
          if (!deco) continue;

          const openBraceIndex = inlineMatch.index + inlineMatch[0].length - 1;
          const closeBraceIndex = findMatchingBrace(lineText, openBraceIndex);
          if (closeBraceIndex === null) continue;

          const matchStart = line.from + inlineMatch.index;
          const matchEnd = line.from + closeBraceIndex + 1;

          const textStart = line.from + openBraceIndex + 1;
          const textEnd = line.from + closeBraceIndex;

          if (textEnd > textStart) {
            pending.push({
              from: textStart,
              to: textEnd,
              deco,
            });
          }

          // Keep \textbf{, \textit{, etc. hidden in Visual Mode so editing styled text never shifts the line
          pending.push({
            from: matchStart,
            to: textStart,
            deco: DECO_SYNTAX_HIDE,
          });
          pending.push({
            from: textEnd,
            to: matchEnd,
            deco: DECO_SYNTAX_HIDE,
          });
        }

        // 3. Render inline \label{...} as Overleaf-style label tag badge (except inside equation blocks)
        if (!/\\begin\{(?:equation|align|gather|multline)/.test(lineText)) {
          INLINE_LABEL_REGEX.lastIndex = 0;
          let labelMatch: RegExpExecArray | null;
          while ((labelMatch = INLINE_LABEL_REGEX.exec(lineText)) !== null) {
            const labelVal = (labelMatch[1] ?? '').trim();
            if (!labelVal) continue;
            pending.push({
              from: line.from + labelMatch.index,
              to: line.from + labelMatch.index + labelMatch[0].length,
              deco: Decoration.replace({ widget: new LabelTagWidget(labelVal) }),
            });
          }
        }

        // 3b. Render \input{...} / \include{...} as Overleaf-style file chip
        INLINE_INPUT_REGEX.lastIndex = 0;
        let inputMatch: RegExpExecArray | null;
        while ((inputMatch = INLINE_INPUT_REGEX.exec(lineText)) !== null) {
          const targetPath = (inputMatch[1] ?? '').trim();
          if (!targetPath) continue;
          pending.push({
            from: line.from + inputMatch.index,
            to: line.from + inputMatch.index + inputMatch[0].length,
            deco: Decoration.replace({ widget: new InputFileWidget(targetPath) }),
          });
        }

        // 4. Unwrap \textcolor{color}{text}
        INLINE_TEXTCOLOR_PREFIX_REGEX.lastIndex = 0;
        let colorMatch: RegExpExecArray | null;
        while ((colorMatch = INLINE_TEXTCOLOR_PREFIX_REGEX.exec(lineText)) !== null) {
          const openBraceIndex = colorMatch.index + colorMatch[0].length - 1;
          const closeBraceIndex = findMatchingBrace(lineText, openBraceIndex);
          if (closeBraceIndex === null) continue;
          pending.push({
            from: line.from + colorMatch.index,
            to: line.from + openBraceIndex + 1,
            deco: DECO_SYNTAX_HIDE,
          });
          pending.push({
            from: line.from + closeBraceIndex,
            to: line.from + closeBraceIndex + 1,
            deco: DECO_SYNTAX_HIDE,
          });
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

const visualHeadingsPlugin = ViewPlugin.fromClass(VisualHeadingsPlugin, {
  decorations: (v) => v.decorations,
});

export const latexVisualHeadings = (): Extension => [
  visualHeadingsPlugin,
  EditorView.atomicRanges.of((view) => view.plugin(visualHeadingsPlugin)?.decorations ?? Decoration.none),
  visualHeadingsTheme,
];
