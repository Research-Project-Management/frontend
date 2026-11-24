/**
 * latex-visual-document-shell.ts
 *
 * CodeMirror 6 Visual Mode Document Shell Extension (Overleaf Visual Editor Parity).
 * - Collapses the LaTeX preamble (`0 .. \begin{document}`) via a `StateField` multi-line block
 *   widget (`PreambleHeaderWidget`) displaying package summary + clean Document Header
 *   (`\title`, `\author`, `\date`), with 1-click toggle to inspect/edit raw preamble.
 * - Hides `\maketitle` and `\end{document}` lines when unfocused, revealing them cleanly
 *   when the cursor enters that line.
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
} from '@codemirror/state';
import { findMatchingBrace } from './latex-visual-headings';

export const togglePreambleEffect = StateEffect.define<boolean>();

interface PreambleMetadata {
  docClass: string;
  packageCount: number;
  title?: string;
  author?: string;
  date?: string;
}

function cleanLatexTextValue(raw: string): string {
  return raw
    .replace(/\\thanks\{[^{}]*\}/g, '')
    .replace(/\\and\b/g, ', ')
    .replace(/\\\\/g, ' · ')
    .replace(/\\[a-zA-Z]+\*?\{([^{}]*)\}/g, '$1')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBalancedMacroValue(text: string, macroName: string): string | undefined {
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
      const value = cleanLatexTextValue(text.slice(openBrace + 1, closeBrace));
      if (value) return value;
    }
  }
  return undefined;
}

function parsePreambleMetadata(preambleText: string): PreambleMetadata {
  const classMatch = preambleText.match(/\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}/);
  const docClass = classMatch?.[1]?.trim() || 'article';

  let packageCount = 0;
  const pkgRegex = /\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let pkgMatch: RegExpExecArray | null;
  while ((pkgMatch = pkgRegex.exec(preambleText)) !== null) {
    const lineStart = preambleText.lastIndexOf('\n', pkgMatch.index) + 1;
    if (/(?:^|[^\\])%/.test(preambleText.slice(lineStart, pkgMatch.index))) continue;
    const names = pkgMatch[1]!.split(',').map((s) => s.trim()).filter(Boolean);
    packageCount += Math.max(1, names.length);
  }

  return {
    docClass,
    packageCount,
    title: extractBalancedMacroValue(preambleText, 'title'),
    author: extractBalancedMacroValue(preambleText, 'author'),
    date: extractBalancedMacroValue(preambleText, 'date'),
  };
}

class PreambleHeaderWidget extends WidgetType {
  constructor(readonly meta: PreambleMetadata) {
    super();
  }

  override eq(other: WidgetType): boolean {
    return (
      other instanceof PreambleHeaderWidget &&
      other.meta.docClass === this.meta.docClass &&
      other.meta.packageCount === this.meta.packageCount &&
      other.meta.title === this.meta.title &&
      other.meta.author === this.meta.author &&
      other.meta.date === this.meta.date
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-visual-preamble-shell';

    const bar = document.createElement('button');
    bar.type = 'button';
    bar.className = 'cm-visual-preamble-pill';
    bar.setAttribute('aria-expanded', 'false');
    bar.title = 'Click to view or edit raw LaTeX preamble';

    const pkgLabel =
      this.meta.packageCount === 1
        ? '1 package'
        : `${this.meta.packageCount} packages`;
    const labelText = document.createElement('span');
    labelText.textContent = `Preamble · ${this.meta.docClass} · ${pkgLabel}`;

    const chevron = document.createElement('span');
    chevron.className = 'cm-visual-preamble-chevron';
    chevron.textContent = 'Show';

    bar.append(labelText, chevron);
    bar.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: togglePreambleEffect.of(true) });
    });

    wrapper.appendChild(bar);

    if (this.meta.title || this.meta.author || this.meta.date) {
      const header = document.createElement('div');
      header.className = 'cm-visual-doc-header';

      if (this.meta.title) {
        const h1 = document.createElement('div');
        h1.className = 'cm-visual-doc-title';
        h1.textContent = this.meta.title;
        header.appendChild(h1);
      }

      if (this.meta.author || this.meta.date) {
        const metaRow = document.createElement('div');
        metaRow.className = 'cm-visual-doc-meta';
        const parts: string[] = [];
        if (this.meta.author) parts.push(this.meta.author);
        if (this.meta.date) parts.push(this.meta.date);
        metaRow.textContent = parts.join(' · ');
        header.appendChild(metaRow);
      }

      wrapper.appendChild(header);
    }

    return wrapper;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

class CollapsePreambleWidget extends WidgetType {
  override eq(other: WidgetType): boolean {
    return other instanceof CollapsePreambleWidget;
  }

  toDOM(view: EditorView): HTMLElement {
    const row = document.createElement('div');
    row.className = 'cm-visual-preamble-collapse-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-visual-preamble-pill';
    btn.setAttribute('aria-expanded', 'true');
    btn.textContent = 'Hide Preamble';
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: togglePreambleEffect.of(false) });
    });

    row.appendChild(btn);
    return row;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

const DECO_HIDDEN_LINE = Decoration.line({ class: 'cm-visual-hidden-line' });
const DECO_HIDDEN_INLINE = Decoration.replace({});
const STRUCTURAL_SINGLE_LINE_RE = /^\s*(?:\\maketitle|\\end\{document\})\s*(?:%.*)?$/;
const BEGIN_DOCUMENT_RE = /^[^%]*\\begin\{document\}/;

export const preambleExpandedField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(togglePreambleEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

function computeDocumentShellDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  if (doc.length === 0) return Decoration.none;

  const selection = state.selection.main;
  const expanded = state.field(preambleExpandedField, false) ?? false;

  // Locate \begin{document}
  let beginDocLineNum: number | null = null;
  const maxScanLine = Math.min(doc.lines, 400);
  for (let l = 1; l <= maxScanLine; l++) {
    const line = doc.line(l);
    if (BEGIN_DOCUMENT_RE.test(line.text)) {
      beginDocLineNum = l;
      break;
    }
  }

  interface PendingDeco {
    from: number;
    to: number;
    deco: Decoration;
  }
  const pending: PendingDeco[] = [];

  let bodyStartLine = 1;
  if (beginDocLineNum !== null) {
    const beginLine = doc.line(beginDocLineNum);
    if (!expanded) {
      const preambleText = doc.sliceString(0, beginLine.to);
      const meta = parsePreambleMetadata(preambleText);
      pending.push({
        from: 0,
        to: beginLine.to,
        deco: Decoration.replace({
          widget: new PreambleHeaderWidget(meta),
          block: true,
        }),
      });
    } else {
      pending.push({
        from: 0,
        to: 0,
        deco: Decoration.widget({
          widget: new CollapsePreambleWidget(),
          block: true,
          side: -1,
        }),
      });
    }
    bodyStartLine = beginDocLineNum + 1;
  }

  for (let l = bodyStartLine; l <= doc.lines; l++) {
    const line = doc.line(l);
    if (!STRUCTURAL_SINGLE_LINE_RE.test(line.text)) continue;

    const isCursorOnLine = selection.from <= line.to && selection.to >= line.from;
    if (isCursorOnLine) continue;

    pending.push({ from: line.from, to: line.from, deco: DECO_HIDDEN_LINE });
    if (line.to > line.from) {
      pending.push({ from: line.from, to: line.to, deco: DECO_HIDDEN_INLINE });
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

export const documentShellField = StateField.define<DecorationSet>({
  create(state) {
    return computeDocumentShellDecorations(state);
  },
  update(decorations, tr) {
    if (
      tr.docChanged ||
      tr.selection ||
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
    marginBottom: '18px',
    userSelect: 'none',
  },
  '.cm-visual-preamble-collapse-row': {
    marginBottom: '8px',
    userSelect: 'none',
  },
  '.cm-visual-preamble-pill': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '3px 10px',
    fontSize: '11.5px',
    fontWeight: '500',
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
    color: 'var(--muted-foreground, #64748b)',
    backgroundColor: 'var(--muted, #f1f5f9)',
    border: '1px solid var(--border, #e2e8f0)',
    borderRadius: '9999px',
    cursor: 'pointer',
    transition: 'background-color 120ms ease, color 120ms ease',
  },
  '.cm-visual-preamble-pill:hover': {
    color: 'var(--foreground, #0f172a)',
    backgroundColor: 'var(--accent, #e2e8f0)',
  },
  '.cm-visual-preamble-chevron': {
    fontSize: '10.5px',
    opacity: '0.8',
    paddingLeft: '4px',
    borderLeft: '1px solid var(--border, #cbd5e1)',
  },
  '.cm-visual-doc-header': {
    marginTop: '14px',
    paddingBottom: '14px',
    borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
    fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
  },
  '.cm-visual-doc-title': {
    fontSize: '1.75rem',
    fontWeight: '800',
    lineHeight: '1.22',
    letterSpacing: '-0.025em',
    color: 'var(--foreground, #0f172a)',
  },
  '.cm-visual-doc-meta': {
    marginTop: '6px',
    fontSize: '0.92rem',
    color: 'var(--muted-foreground, #475569)',
  },
  '.cm-visual-hidden-line': {
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
});

export const latexVisualDocumentShell = (): Extension => [
  preambleExpandedField,
  documentShellField,
  visualDocumentShellTheme,
];
