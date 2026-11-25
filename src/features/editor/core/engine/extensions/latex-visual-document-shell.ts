/**
 * latex-visual-document-shell.ts
 *
 * CodeMirror 6 Visual Mode Document Shell Extension (Overleaf Visual Editor Parity).
 * - Collapses the LaTeX preamble (`0 .. \begin{document}`) via a `StateField` multi-line block
 *   widget (`PreambleHeaderWidget`) displaying the clean Document Header (`\title`, `\author`, `\date`).
 * - Hides `\maketitle` and `\end{document}` lines in Visual Mode.
 */

import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
import {
  RangeSetBuilder,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
  type Line,
  type Text,
} from '@codemirror/state';
import { cleanInlineLatexText, findMatchingBrace } from './latex-visual-headings';

const togglePreambleEffect = StateEffect.define<boolean>();

const preambleExpandedField = StateField.define<boolean>({
  create() {
    return false;
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(togglePreambleEffect)) return e.value;
    }
    return value;
  },
});

interface PreambleMetadata {
  title?: string;
  author?: string;
  date?: string;
}

function extractBalancedMacroValue(
  text: string,
  macroName: string,
  preserveLineBreaks = false,
): string | undefined {
  const re = new RegExp(`\\\\${macroName}(?:\\[[^\\]]*\\])?\\{`, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    // Skip matches inside line comments
    const lineStart = text.lastIndexOf('\n', match.index) + 1;
    const prefixOnLine = text.slice(lineStart, match.index);
    if (/(?:^|[^\\])%/.test(prefixOnLine)) continue;

    const openBrace = match.index + match[0].length - 1;
    const closeBrace = findMatchingBrace(text, openBrace);
    if (closeBrace !== null) {
      const rawInner = text.slice(openBrace + 1, closeBrace);
      if (preserveLineBreaks) {
        const lines = rawInner
          .replace(/\\(?:and|AND|And)\b/g, '\n\n')
          .replace(/\\\\(?:\s*\[[^\]]*\])?/g, '\n')
          .split('\n')
          .map((l) => cleanInlineLatexText(l))
          .join('\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        if (lines) return lines;
      } else {
        const value = cleanInlineLatexText(rawInner);
        if (value) return value;
      }
    }
  }
  return undefined;
}

function parsePreambleMetadata(preambleText: string): PreambleMetadata {
  return {
    title: extractBalancedMacroValue(preambleText, 'title', false),
    author: extractBalancedMacroValue(preambleText, 'author', true),
    date: extractBalancedMacroValue(preambleText, 'date', false),
  };
}

class CollapsedPreambleBarWidget extends WidgetType {
  override eq(other: WidgetType): boolean {
    return other instanceof CollapsedPreambleBarWidget;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-visual-preamble-shell';

    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'cm-visual-preamble-bar';
    bar.setAttribute('aria-expanded', 'false');

    const label = document.createElement('span');
    label.textContent = 'Show document preamble';

    const icon = document.createElement('span');
    icon.className = 'cm-visual-preamble-chevron';
    icon.textContent = '⌄';

    bar.append(label, icon);
    bar.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: togglePreambleEffect.of(true) });
    });
    wrapper.appendChild(bar);
    return wrapper;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

class DocumentTitleWidget extends WidgetType {
  constructor(readonly meta: PreambleMetadata) {
    super();
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof DocumentTitleWidget &&
      other.meta.title === this.meta.title &&
      other.meta.author === this.meta.author &&
      other.meta.date === this.meta.date
    );
  }

  toDOM(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'cm-visual-doc-header';

    if (this.meta.title) {
      const h1 = document.createElement('div');
      h1.className = 'cm-visual-doc-title';
      h1.textContent = this.meta.title;
      header.appendChild(h1);
    }

    if (this.meta.author) {
      const authorBlock = document.createElement('div');
      authorBlock.className = 'cm-visual-doc-author';
      authorBlock.textContent = this.meta.author;
      header.appendChild(authorBlock);
    }

    if (this.meta.date) {
      const dateRow = document.createElement('div');
      dateRow.className = 'cm-visual-doc-meta';
      dateRow.textContent = this.meta.date;
      header.appendChild(dateRow);
    }

    return header;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

class CollapsePreambleBarWidget extends WidgetType {
  override eq(other: WidgetType): boolean {
    return other instanceof CollapsePreambleBarWidget;
  }

  toDOM(view: EditorView): HTMLElement {
    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'cm-visual-preamble-bar cm-visual-preamble-bar-expanded';
    bar.setAttribute('aria-expanded', 'true');

    const label = document.createElement('span');
    label.textContent = 'Hide document preamble';

    const icon = document.createElement('span');
    icon.className = 'cm-visual-preamble-chevron';
    icon.textContent = '⌃';

    bar.append(label, icon);
    bar.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: togglePreambleEffect.of(false) });
    });
    return bar;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

const DECO_HIDDEN_LINE = Decoration.line({ class: 'cm-visual-hidden-line' });
const DECO_HIDDEN_INLINE = Decoration.replace({});
const STRUCTURAL_SINGLE_LINE_RE =
  /^\s*(?:\\maketitle|\\tableofcontents|\\listoffigures|\\listoftables|\\newpage|\\clearpage|\\cleardoublepage|\\pagebreak|\\thispagestyle\{[^}]*\}|\\pagestyle\{[^}]*\}|\\end\{document\})\s*(?:%.*)?$/;
const BEGIN_DOCUMENT_RE = /^[^%]*\\begin\{document\}/;

export function findBeginDocumentLine(doc: Text): Line | null {
  const maxScanLine = Math.min(doc.lines, 400);
  for (let l = 1; l <= maxScanLine; l++) {
    const line = doc.line(l);
    if (BEGIN_DOCUMENT_RE.test(line.text)) {
      return line;
    }
  }
  return null;
}

function computeDocumentShellDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  if (doc.length === 0) return Decoration.none;

  const beginLine = findBeginDocumentLine(doc);

  interface PendingDeco {
    from: number;
    to: number;
    deco: Decoration;
  }
  const pending: PendingDeco[] = [];

  const expanded = state.field(preambleExpandedField, false) ?? false;
  let bodyStartLine = 1;
  let meta: PreambleMetadata = {};
  if (beginLine !== null) {
    const preambleText = doc.sliceString(0, beginLine.to);
    meta = parsePreambleMetadata(preambleText);
    if (!expanded) {
      pending.push({
        from: 0,
        to: beginLine.to,
        deco: Decoration.replace({
          widget: new CollapsedPreambleBarWidget(),
          block: true,
        }),
      });
    } else {
      pending.push({
        from: 0,
        to: 0,
        deco: Decoration.widget({
          widget: new CollapsePreambleBarWidget(),
          block: true,
          side: -1,
        }),
      });
    }
    bodyStartLine = beginLine.number + 1;
  }

  const hasTitleMeta = Boolean(meta.title || meta.author || meta.date);
  let renderedTitleAtMaketitle = false;

  for (let l = bodyStartLine; l <= doc.lines; l++) {
    const line = doc.line(l);
    if (!STRUCTURAL_SINGLE_LINE_RE.test(line.text)) continue;

    if (/^\s*\\maketitle\b/.test(line.text) && hasTitleMeta && !renderedTitleAtMaketitle) {
      renderedTitleAtMaketitle = true;
      pending.push({
        from: line.from,
        to: line.to,
        deco: Decoration.replace({
          widget: new DocumentTitleWidget(meta),
          block: true,
        }),
      });
      continue;
    }

    pending.push({ from: line.from, to: line.from, deco: DECO_HIDDEN_LINE });
    if (line.to > line.from) {
      pending.push({ from: line.from, to: line.to, deco: DECO_HIDDEN_INLINE });
    }
  }

  if (beginLine !== null && hasTitleMeta && !renderedTitleAtMaketitle) {
    pending.push({
      from: beginLine.to,
      to: beginLine.to,
      deco: Decoration.widget({
        widget: new DocumentTitleWidget(meta),
        block: true,
        side: 1,
      }),
    });
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

export const documentShellField = StateField.define<DecorationSet>({
  create(state) {
    return computeDocumentShellDecorations(state);
  },
  update(decorations, tr) {
    if (
      tr.docChanged ||
      tr.effects.some((e) => e.is(togglePreambleEffect))
    ) {
      return computeDocumentShellDecorations(tr.state);
    }
    return decorations;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const visualDocumentShellTheme = EditorView.baseTheme({
  '.cm-visual-preamble-shell': {
    paddingTop: '8px',
    marginBottom: '20px',
    userSelect: 'none',
  },
  '.cm-visual-preamble-bar': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '7px 14px',
    marginBottom: '20px',
    fontSize: '12.5px',
    fontWeight: '500',
    fontFamily: 'var(--font-sans)',
    color: 'var(--muted-foreground)',
    backgroundColor: 'var(--muted)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  '.cm-visual-preamble-bar:hover': {
    color: 'var(--foreground)',
    borderColor: 'var(--border)',
  },
  '.cm-visual-preamble-chevron': {
    fontSize: '14px',
    lineHeight: '1',
    color: 'var(--muted-foreground)',
  },
  '.cm-visual-doc-header': {
    marginTop: '8px',
    paddingBottom: '18px',
    textAlign: 'center',
    fontFamily: 'var(--font-serif), Georgia, Cambria, "Times New Roman", Times, serif',
  },
  '.cm-visual-doc-title': {
    fontSize: '1.85rem',
    fontWeight: '400',
    lineHeight: '1.3',
    color: 'var(--foreground)',
  },
  '.cm-visual-doc-author': {
    marginTop: '14px',
    fontSize: '0.98rem',
    lineHeight: '1.6',
    color: 'var(--foreground)',
    whiteSpace: 'pre-line',
  },
  '.cm-visual-doc-meta': {
    marginTop: '6px',
    fontSize: '0.92rem',
    color: 'var(--muted-foreground)',
  },
});

export const latexVisualDocumentShell = (): Extension => [
  preambleExpandedField,
  documentShellField,
  EditorView.atomicRanges.of((view) => view.state.field(documentShellField, false) ?? Decoration.none),
  visualDocumentShellTheme,
];
