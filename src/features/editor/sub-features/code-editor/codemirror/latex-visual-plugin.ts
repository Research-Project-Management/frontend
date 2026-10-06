/**
 * latex-visual-plugin.ts
 *
 * CodeMirror 6 Visual Mode Extension (Overleaf Parity):
 * - Live KaTeX Widget Replacement for inline and display math ($ $, \( \), $$ $$, \[ \], equation, align, gather, multline, flalign, aligntat).
 * - Live mhchem Chemical Formula widget (\ce{...}).
 * - Interactive Math & Chem Popover: Click to edit formula in-place with instant preview.
 * - WYSIWYG Figure Widget (\begin{figure}...\end{figure}) with preview, caption, label, delete, and raw code view.
 * - WYSIWYG Table Widget (\begin{table}...\end{table}, \begin{tabular}) with cell editing, booktabs/borders, alignments.
 * - Rich typography marks (\textbf, \textit, \emph, \underline, \texttt, \sout).
 * - Visual document headings (\section, \subsection, \subsubsection, \paragraph).
 * - Interactive chips for citations (\cite), cross-references (\ref, \eqref), footnotes (\footnote), and links (\href, \url).
 * - Smart table paste handler: Pasting HTML/TSV tables from Excel/Google Sheets auto-converts to LaTeX tabular.
 * - 100% LaTeX AST preservation — Zero data loss.
 * - Adheres strictly to Flux Design System (no card-in-card, min 11px floor, theme tokens).
 */

import {
  WidgetType,
  Decoration,
  DecorationSet,
  EditorView,
} from '@codemirror/view';
import { StateField, Extension, EditorState, Range } from '@codemirror/state';
import { toast } from 'sonner';
import { renderMathHtml, renderChemHtml } from '../../../utils/latex-converter.util';
import { TableWidget } from './table-visual-widget';
import { FigureWidget, StandaloneImageWidget } from './figure-visual-widget';
import {
  isTableData,
  parseTableToLatex,
  isRichTextHtml,
  parseHtmlToLatex,
} from '../../../utils/smart-paste.util';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import { EditorEventBus } from '../../../utils/editor.util';

export interface MathPopoverTrigger {
  math: string;
  isDisplay: boolean;
  from: number;
  to: number;
  anchorRect: DOMRect;
}

// Callback invoked when user clicks a Math or Chem widget to open in-place popover editor
export type OnMathEditCallback = (trigger: MathPopoverTrigger) => void;

let globalOnMathEdit: OnMathEditCallback | null = null;

export function setMathEditCallback(cb: OnMathEditCallback | null) {
  globalOnMathEdit = cb;
}

/**
 * Interactive KaTeX Math Widget (Inline & Display)
 */
class MathWidget extends WidgetType {
  constructor(
    public readonly math: string,
    public readonly isDisplay: boolean,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
  }

  override eq(other: MathWidget): boolean {
    return (
      this.math === other.math &&
      this.isDisplay === other.isDisplay &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement(this.isDisplay ? 'div' : 'span');
    wrap.className = this.isDisplay
      ? 'cm-math-widget-display my-3 py-2 px-3 text-center cursor-pointer transition-colors hover:bg-muted/30 rounded-md relative group'
      : 'cm-math-widget-inline px-1.5 py-0.5 mx-0.5 rounded-sm inline-block cursor-pointer transition-colors hover:bg-muted/40';

    wrap.title = 'Click to edit LaTeX math formula in-place (Overleaf style)';
    wrap.innerHTML = renderMathHtml(this.math, this.isDisplay);

    // Badge indicator on hover for display math
    if (this.isDisplay) {
      const badge = document.createElement('span');
      badge.className =
        'absolute top-1 right-2 text-11 font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none';
      badge.textContent = '✎ edit math';
      wrap.appendChild(badge);
    }

    wrap.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (globalOnMathEdit) {
        const rect = wrap.getBoundingClientRect();
        globalOnMathEdit({
          math: this.math,
          isDisplay: this.isDisplay,
          from: this.from,
          to: this.to,
          anchorRect: rect,
        });
      } else {
        view.dispatch({
          selection: { anchor: this.from, head: this.to },
          scrollIntoView: true,
        });
      }
    });

    return wrap;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Chemical formula widget for \ce{...} (mhchem)
 */
class ChemWidget extends WidgetType {
  constructor(
    public readonly formula: string,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
  }

  override eq(other: ChemWidget): boolean {
    return this.formula === other.formula && this.from === other.from && this.to === other.to;
  }

  override toDOM(view: EditorView): HTMLElement {
    const span = document.createElement('span');
    span.className =
      'cm-chem-widget inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-muted/40 hover:bg-muted/70 border border-border/50 text-foreground cursor-pointer transition-colors select-none text-12';
    span.title = `Chemical Formula: \\ce{${this.formula}} (Click to edit)`;

    const content = document.createElement('span');
    content.innerHTML = renderChemHtml(this.formula);
    span.appendChild(content);

    span.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (globalOnMathEdit) {
        const rect = span.getBoundingClientRect();
        globalOnMathEdit({
          math: `\\ce{${this.formula}}`,
          isDisplay: false,
          from: this.from,
          to: this.to,
          anchorRect: rect,
        });
      } else {
        view.dispatch({
          selection: { anchor: this.from, head: this.to },
          scrollIntoView: true,
        });
      }
    });

    return span;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Citation chip widget for \cite{key}, \citep{key}, \citet{key}, \autocite{key}
 */
class CitationWidget extends WidgetType {
  constructor(
    public readonly citeKey: string,
    public readonly prefix: string,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
  }

  override eq(other: CitationWidget): boolean {
    return (
      this.citeKey === other.citeKey &&
      this.prefix === other.prefix &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className =
      'cm-citation-chip inline-flex items-center gap-1.5 px-2 py-0.5 my-0.5 rounded-sm bg-muted text-foreground border border-border text-11 font-mono font-normal hover:bg-muted/80 cursor-pointer select-none transition-colors leading-normal';
    chip.title = `Citation: \\${this.prefix}{${this.citeKey}} (Click to select, Double-click to inspect in Citations panel)`;
    chip.innerHTML = `<span class="opacity-70 text-11">📖</span><span>[${this.citeKey}]</span>`;

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
        scrollIntoView: true,
      });
    });

    chip.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      EditorEventBus.emit('flux:open-panel', { panel: 'Citations', query: this.citeKey });
      toast.info(`Citation [${this.citeKey}]`, {
        description: 'Viewing entry details in Citations tab',
      });
    });

    return chip;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Cross-reference chip widget for \ref{key}, \eqref{key}, \autoref{key}, \pageref{key}
 */
class RefWidget extends WidgetType {
  constructor(
    public readonly refKey: string,
    public readonly isEq: boolean,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
  }

  override eq(other: RefWidget): boolean {
    return (
      this.refKey === other.refKey &&
      this.isEq === other.isEq &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className =
      'cm-ref-chip inline-flex items-center gap-1 px-2 py-0.5 my-0.5 rounded-sm bg-muted text-foreground border border-border text-11 font-sans font-medium hover:bg-muted/80 cursor-pointer select-none transition-colors leading-normal';
    chip.title = `Cross-Reference: ${this.refKey} (Click to jump to \\label{${this.refKey}})`;
    const icon = this.isEq ? 'eq:' : '🏷️';
    const displayText = this.isEq ? `(${this.refKey})` : this.refKey;
    chip.innerHTML = `<span class="opacity-70 text-11">${icon}</span><span>${displayText}</span>`;

    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Overleaf parity: jump to corresponding \label{refKey} in document
      const docText = view.state.doc.toString();
      const escapedKey = this.refKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const labelRegex = new RegExp(`\\\\label\\{${escapedKey}\\}`, 'm');
      const match = labelRegex.exec(docText);

      if (match) {
        const line = view.state.doc.lineAt(match.index).number;
        editorCommandBus.dispatch({ type: 'editor:jump-to-line', line, highlight: 'synctex' });
        toast.info(`Jumped to \\label{${this.refKey}} at line ${line}`);
      } else {
        view.dispatch({
          selection: { anchor: this.from, head: this.to },
          scrollIntoView: true,
        });
        toast.info(`Reference "${this.refKey}"`, {
          description: `No \\label{${this.refKey}} found in this document.`,
        });
      }
    });

    return chip;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Footnote chip widget for \footnote{text}
 */
class FootnoteWidget extends WidgetType {
  constructor(
    public readonly noteText: string,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
  }

  override eq(other: FootnoteWidget): boolean {
    return this.noteText === other.noteText && this.from === other.from && this.to === other.to;
  }

  override toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('sup');
    chip.className =
      'cm-footnote-chip inline-flex items-center px-1 py-0.5 mx-0.5 rounded bg-muted/60 hover:bg-muted text-primary border border-border/50 text-11 font-mono font-medium cursor-pointer select-none transition-colors';
    chip.title = `Footnote: ${this.noteText}`;
    chip.textContent = '[fn]';
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
        scrollIntoView: true,
      });
    });
    return chip;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Hyperlink chip widget for \href{url}{text} and \url{url}
 */
class LinkWidget extends WidgetType {
  constructor(
    public readonly url: string,
    public readonly label: string,
    public readonly from: number,
    public readonly to: number
  ) {
    super();
  }

  override eq(other: LinkWidget): boolean {
    return (
      this.url === other.url &&
      this.label === other.label &&
      this.from === other.from &&
      this.to === other.to
    );
  }

  override toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('a');
    chip.className =
      'cm-link-chip inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-sm bg-muted/40 hover:bg-muted text-primary border border-border/50 text-11 font-sans cursor-pointer select-none transition-colors underline-offset-2 hover:underline';
    chip.href =
      this.url.startsWith('http') || this.url.startsWith('mailto:') ? this.url : `https://${this.url}`;
    chip.target = '_blank';
    chip.rel = 'noopener noreferrer';
    chip.title = `Link: ${this.url} (Click to open, Ctrl+Click to select LaTeX code)`;
    chip.innerHTML = `<span>${this.label || this.url}</span><span class="text-11 opacity-60">↗</span>`;
    chip.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch({
          selection: { anchor: this.from, head: this.to },
          scrollIntoView: true,
        });
      }
    });
    return chip;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Builds the visual decoration set by scanning the visible document.
 */
function buildVisualDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  const fullText = doc.toString();

  interface ReplaceItem {
    from: number;
    to: number;
    deco: Decoration;
  }

  const replaceItems: ReplaceItem[] = [];
  const lineRanges: Range<Decoration>[] = [];
  const markRanges: Range<Decoration>[] = [];

  // ── 1. Display Math: $$ ... $$ ─────────────────────────────────────────────
  const displayMathRegex = /\$\$([\s\S]*?)\$\$/g;
  let dMatch: RegExpExecArray | null;
  while ((dMatch = displayMathRegex.exec(fullText)) !== null) {
    const from = dMatch.index;
    const to = from + dMatch[0].length;
    const mathCode = dMatch[1].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new MathWidget(mathCode, true, from, to),
        block: true,
      }),
    });
  }

  // ── 2. Display Math: \[ ... \] ─────────────────────────────────────────────
  const bracketDisplayMathRegex = /\\\[([\s\S]*?)\\\]/g;
  let bMatch: RegExpExecArray | null;
  while ((bMatch = bracketDisplayMathRegex.exec(fullText)) !== null) {
    const from = bMatch.index;
    const to = from + bMatch[0].length;
    const mathCode = bMatch[1].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new MathWidget(mathCode, true, from, to),
        block: true,
      }),
    });
  }

  // ── 3. Math Environments: equation, align, gather, multline, flalign, alignat
  const eqEnvRegex =
    /\\begin\{(?:equation|align|gather|multline|flalign|alignat)\*?\}([\s\S]*?)\\end\{(?:equation|align|gather|multline|flalign|alignat)\*?\}/g;
  let eqMatch: RegExpExecArray | null;
  while ((eqMatch = eqEnvRegex.exec(fullText)) !== null) {
    const from = eqMatch.index;
    const to = from + eqMatch[0].length;
    const mathCode = eqMatch[1].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new MathWidget(mathCode, true, from, to),
        block: true,
      }),
    });
  }

  // ── 4. Inline Math: $ ... $ (excluding $$) ─────────────────────────────────
  const inlineMathRegex = /(?<!\$)\$(?!\$)([^$\n]+?)(?<!\$)\$(?!\$)/g;
  let iMatch: RegExpExecArray | null;
  while ((iMatch = inlineMathRegex.exec(fullText)) !== null) {
    const from = iMatch.index;
    const to = from + iMatch[0].length;
    const mathCode = iMatch[1];
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new MathWidget(mathCode, false, from, to),
      }),
    });
  }

  // ── 5. Inline Math: \( ... \) ──────────────────────────────────────────────
  const parenInlineMathRegex = /\\\(([\s\S]*?)\\\)/g;
  let piMatch: RegExpExecArray | null;
  while ((piMatch = parenInlineMathRegex.exec(fullText)) !== null) {
    const from = piMatch.index;
    const to = from + piMatch[0].length;
    const mathCode = piMatch[1].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new MathWidget(mathCode, false, from, to),
      }),
    });
  }

  // ── 6. Chemical Formulas: \ce{...} (mhchem) ────────────────────────────────
  const chemRegex = /\\ce\{([^}]+)\}/g;
  let chMatch: RegExpExecArray | null;
  while ((chMatch = chemRegex.exec(fullText)) !== null) {
    const from = chMatch.index;
    const to = from + chMatch[0].length;
    const formula = chMatch[1].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new ChemWidget(formula, from, to),
      }),
    });
  }

  // ── 7. Figures: \begin{figure}...\end{figure} ──────────────────────────────
  const figureRegex = /\\begin\{figure\*?\}(?:\[[^\]]*\])?[\s\S]*?\\end\{figure\*?\}/g;
  let figMatch: RegExpExecArray | null;
  while ((figMatch = figureRegex.exec(fullText)) !== null) {
    const from = figMatch.index;
    const to = from + figMatch[0].length;
    const figureCode = figMatch[0];
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new FigureWidget(figureCode, from, to),
        block: true,
      }),
    });
  }

  // ── 8. Standalone \includegraphics outside figures ─────────────────────────
  const imgRegex = /\\includegraphics(?:\[([^\]]*)\])?\{([^}]+)\}/g;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(fullText)) !== null) {
    const from = imgMatch.index;
    const to = from + imgMatch[0].length;
    const options = imgMatch[1] ? imgMatch[1].trim() : '';
    const src = imgMatch[2].trim();

    // Only render if not already inside a figure environment
    const isInsideFigure = replaceItems.some((item) => from >= item.from && to <= item.to);
    if (!isInsideFigure) {
      replaceItems.push({
        from,
        to,
        deco: Decoration.replace({
          widget: new StandaloneImageWidget(src, options, from, to),
          block: true,
        }),
      });
    }
  }

  // ── 9. Tables: \begin{table}... \end{table} ────────────────────────────────
  const tableRegex = /\\begin\{table\*?\}(?:\[[^\]]*\])?[\s\S]*?\\end\{table\*?\}/g;
  let tMatch: RegExpExecArray | null;
  while ((tMatch = tableRegex.exec(fullText)) !== null) {
    const from = tMatch.index;
    const to = from + tMatch[0].length;
    const tableCode = tMatch[0];
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new TableWidget(tableCode, from, to),
        block: true,
      }),
    });
  }

  // ── 10. Standalone \begin{tabular}...\end{tabular} ──────────────────────────
  const tabularRegex =
    /\\begin\{tabular\*?\}(?:\[[^\]]*\])?\{[^}]*\}[\s\S]*?\\end\{tabular\*?\}/g;
  let tabMatch: RegExpExecArray | null;
  while ((tabMatch = tabularRegex.exec(fullText)) !== null) {
    const from = tabMatch.index;
    const to = from + tabMatch[0].length;
    const tabularCode = tabMatch[0];
    const isInsideTable = replaceItems.some((item) => from >= item.from && to <= item.to);
    if (!isInsideTable) {
      replaceItems.push({
        from,
        to,
        deco: Decoration.replace({
          widget: new TableWidget(tabularCode, from, to),
          block: true,
        }),
      });
    }
  }

  // ── 11. Citations: \cite{...}, \citep{...}, \citet{...}, \autocite{...} ────
  const citeRegex = /\\(cite|citep|citet|autocite|nocite)\{([^}]+)\}/g;
  let cMatch: RegExpExecArray | null;
  while ((cMatch = citeRegex.exec(fullText)) !== null) {
    const from = cMatch.index;
    const to = from + cMatch[0].length;
    const prefix = cMatch[1];
    const citeKey = cMatch[2].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new CitationWidget(citeKey, prefix, from, to),
      }),
    });
  }

  // ── 12. References: \ref{...}, \eqref{...}, \autoref{...}, \pageref{...} ───
  const refRegex = /\\(ref|eqref|autoref|pageref)\{([^}]+)\}/g;
  let rMatch: RegExpExecArray | null;
  while ((rMatch = refRegex.exec(fullText)) !== null) {
    const from = rMatch.index;
    const to = from + rMatch[0].length;
    const cmd = rMatch[1];
    const refKey = rMatch[2].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new RefWidget(refKey, cmd === 'eqref', from, to),
      }),
    });
  }

  // ── 13. Footnotes: \footnote{...} ──────────────────────────────────────────
  const fnRegex = /\\footnote\{([^}]+)\}/g;
  let fnMatch: RegExpExecArray | null;
  while ((fnMatch = fnRegex.exec(fullText)) !== null) {
    const from = fnMatch.index;
    const to = from + fnMatch[0].length;
    const noteText = fnMatch[1].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new FootnoteWidget(noteText, from, to),
      }),
    });
  }

  // ── 14. Hyperlinks: \href{url}{text} and \url{url} ─────────────────────────
  const hrefRegex = /\\href\{([^}]+)\}\{([^}]+)\}/g;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = hrefRegex.exec(fullText)) !== null) {
    const from = hrefMatch.index;
    const to = from + hrefMatch[0].length;
    const url = hrefMatch[1].trim();
    const label = hrefMatch[2].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new LinkWidget(url, label, from, to),
      }),
    });
  }

  const urlRegex = /\\url\{([^}]+)\}/g;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(fullText)) !== null) {
    const from = urlMatch.index;
    const to = from + urlMatch[0].length;
    const url = urlMatch[1].trim();
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new LinkWidget(url, url, from, to),
      }),
    });
  }

  // ── 15. Headings: \section, \subsection, \subsubsection, \paragraph ────────
  const secRegex = /\\section\*?\{([^}]+)\}/g;
  let secMatch: RegExpExecArray | null;
  while ((secMatch = secRegex.exec(fullText)) !== null) {
    const from = secMatch.index;
    const lineObj = doc.lineAt(from);
    lineRanges.push(
      Decoration.line({
        attributes: {
          class:
            'cm-visual-heading text-xl font-semibold text-foreground border-b border-border/40 pb-1 mb-2 mt-3',
        },
      }).range(lineObj.from)
    );
  }

  const subsecRegex = /\\subsection\*?\{([^}]+)\}/g;
  let subMatch: RegExpExecArray | null;
  while ((subMatch = subsecRegex.exec(fullText)) !== null) {
    const from = subMatch.index;
    const lineObj = doc.lineAt(from);
    lineRanges.push(
      Decoration.line({
        attributes: {
          class:
            'cm-visual-subheading text-lg font-semibold text-foreground/90 pb-0.5 mb-1.5 mt-2',
        },
      }).range(lineObj.from)
    );
  }

  const subsubsecRegex = /\\subsubsection\*?\{([^}]+)\}/g;
  let subsubMatch: RegExpExecArray | null;
  while ((subsubMatch = subsubsecRegex.exec(fullText)) !== null) {
    const from = subsubMatch.index;
    const lineObj = doc.lineAt(from);
    lineRanges.push(
      Decoration.line({
        attributes: {
          class:
            'cm-visual-subsubheading text-base font-medium text-foreground/80 mb-1 mt-1.5',
        },
      }).range(lineObj.from)
    );
  }

  const paraRegex = /\\paragraph\*?\{([^}]+)\}/g;
  let paraMatch: RegExpExecArray | null;
  while ((paraMatch = paraRegex.exec(fullText)) !== null) {
    const from = paraMatch.index;
    const lineObj = doc.lineAt(from);
    lineRanges.push(
      Decoration.line({
        attributes: {
          class: 'cm-visual-paragraph font-semibold text-foreground/85 mr-2',
        },
      }).range(lineObj.from)
    );
  }

  // ── 16. Filter non-overlapping Replace Decorations strictly ────────────────
  replaceItems.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - b.to;
  });

  const validReplaceRanges: Range<Decoration>[] = [];
  let lastTo = -1;
  for (const item of replaceItems) {
    if (item.from >= lastTo) {
      validReplaceRanges.push(item.deco.range(item.from, item.to));
      lastTo = Math.max(item.to, item.from);
    }
  }

  // ── 17. Typography Marks (\textbf, \textit, \emph, \underline, \texttt) ────
  // Applied only to ranges that do NOT overlap with any active replacement widget using O(log N) binary search
  const isInsideReplace = (from: number, to: number): boolean => {
    let low = 0;
    let high = validReplaceRanges.length - 1;
    let candidate = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (validReplaceRanges[mid].to > from) {
        candidate = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    if (candidate === -1) return false;
    return validReplaceRanges[candidate].from < to;
  };

  const boldRegex = /\\textbf\{([^}]+)\}/g;
  let boldMatch: RegExpExecArray | null;
  while ((boldMatch = boldRegex.exec(fullText)) !== null) {
    const fullFrom = boldMatch.index;
    const fullTo = fullFrom + boldMatch[0].length;
    if (!isInsideReplace(fullFrom, fullTo)) {
      const textFrom = fullFrom + '\\textbf{'.length;
      const textTo = fullTo - 1;
      markRanges.push(
        Decoration.mark({ class: 'cm-visual-bold font-semibold text-foreground' }).range(
          textFrom,
          textTo
        )
      );
    }
  }

  const italicRegex = /\\(?:textit|emph)\{([^}]+)\}/g;
  let itMatch: RegExpExecArray | null;
  while ((itMatch = italicRegex.exec(fullText)) !== null) {
    const fullFrom = itMatch.index;
    const fullTo = fullFrom + itMatch[0].length;
    if (!isInsideReplace(fullFrom, fullTo)) {
      const braceIndex = fullText.indexOf('{', fullFrom);
      const textFrom = braceIndex + 1;
      const textTo = fullTo - 1;
      markRanges.push(
        Decoration.mark({ class: 'cm-visual-italic italic text-foreground' }).range(
          textFrom,
          textTo
        )
      );
    }
  }

  const underlineRegex = /\\underline\{([^}]+)\}/g;
  let uMatch: RegExpExecArray | null;
  while ((uMatch = underlineRegex.exec(fullText)) !== null) {
    const fullFrom = uMatch.index;
    const fullTo = fullFrom + uMatch[0].length;
    if (!isInsideReplace(fullFrom, fullTo)) {
      const textFrom = fullFrom + '\\underline{'.length;
      const textTo = fullTo - 1;
      markRanges.push(
        Decoration.mark({
          class: 'cm-visual-underline underline underline-offset-2',
        }).range(textFrom, textTo)
      );
    }
  }

  const codeRegex = /\\texttt\{([^}]+)\}/g;
  let cdMatch: RegExpExecArray | null;
  while ((cdMatch = codeRegex.exec(fullText)) !== null) {
    const fullFrom = cdMatch.index;
    const fullTo = fullFrom + cdMatch[0].length;
    if (!isInsideReplace(fullFrom, fullTo)) {
      const textFrom = fullFrom + '\\texttt{'.length;
      const textTo = fullTo - 1;
      markRanges.push(
        Decoration.mark({
          class:
            'cm-visual-mono font-mono text-[0.9em] bg-muted/60 px-1 py-0.5 rounded text-foreground',
        }).range(textFrom, textTo)
      );
    }
  }

  const soutRegex = /\\sout\{([^}]+)\}/g;
  let sMatch: RegExpExecArray | null;
  while ((sMatch = soutRegex.exec(fullText)) !== null) {
    const fullFrom = sMatch.index;
    const fullTo = fullFrom + sMatch[0].length;
    if (!isInsideReplace(fullFrom, fullTo)) {
      const textFrom = fullFrom + '\\sout{'.length;
      const textTo = fullTo - 1;
      markRanges.push(
        Decoration.mark({
          class: 'cm-visual-sout line-through opacity-70',
        }).range(textFrom, textTo)
      );
    }
  }

  // Combine and sort all ranges strictly by position
  const allRanges = [...lineRanges, ...validReplaceRanges, ...markRanges];
  allRanges.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - b.to;
  });

  try {
    return Decoration.set(allRanges);
  } catch (err) {
    console.warn('[latexVisualPlugin] Failed to build visual decorations set:', err);
    return Decoration.none;
  }
}

/**
 * StateField powering Overleaf's Visual Mode on CodeMirror 6.
 * Using StateField + EditorView.decorations.from is the ONLY supported way in CM6
 * to provide block decorations without throwing RangeError.
 */
export const latexVisualField = StateField.define<DecorationSet>({
  create(state: EditorState): DecorationSet {
    return buildVisualDecorations(state);
  },
  update(decorations: DecorationSet, tr): DecorationSet {
    if (tr.docChanged) {
      return buildVisualDecorations(tr.state);
    }
    return decorations.map(tr.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

/**
 * Smart Paste DOM Event Handler for Visual Mode:
 * Intercepts pasting HTML/TSV tables from Excel/Google Docs/Word and auto-converts to LaTeX table.
 */
export const visualPasteHandler = EditorView.domEventHandlers({
  paste(event: ClipboardEvent, view: EditorView): boolean {
    if (!event.clipboardData) return false;

    if (isTableData(event.clipboardData)) {
      event.preventDefault();
      const latexTable = parseTableToLatex(event.clipboardData, {
        booktabs: true,
        caption: 'Pasted Table',
        label: 'tab:table-pasted',
      });

      if (latexTable) {
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: latexTable },
          scrollIntoView: true,
        });
        toast.success('Pasted table converted to LaTeX format', {
          description: 'Converted tabular data into \\begin{table}...\\end{table}',
        });
        return true;
      }
    }

    if (isRichTextHtml(event.clipboardData)) {
      const html = event.clipboardData.getData('text/html');
      const latexContent = parseHtmlToLatex(html);
      if (latexContent) {
        event.preventDefault();
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: latexContent },
          scrollIntoView: true,
        });
        toast.success('Pasted formatted text converted to LaTeX', {
          description: 'Preserved typography, headings, and lists in LaTeX markup',
        });
        return true;
      }
    }

    return false;
  },
});

/**
 * Full Visual Mode extension for CodeMirror 6
 */
export const latexVisualPlugin: Extension = [latexVisualField, visualPasteHandler];
