/**
 * latex-visual-plugin.ts
 *
 * CodeMirror 6 Visual Mode Extension (Overleaf Secret Sauce):
 * - Live KaTeX Widget Replacement for inline and display math.
 * - Interactive Math Widget: Click to edit formula in-place.
 * - Rich typography decorations for \section, \textbf, \textit.
 * - WYSIWYG Table & Figure preview widgets.
 * - 100% LaTeX fidelity underneath — Zero parsing loss.
 */

import {
  WidgetType,
  Decoration,
  DecorationSet,
  EditorView,
} from '@codemirror/view';
import { StateField, Extension, EditorState, Range } from '@codemirror/state';
import { renderMathHtml } from '../../../utils/latex-converter.util';
import { TableWidget } from './table-visual-widget';

export interface MathPopoverTrigger {
  math: string;
  isDisplay: boolean;
  from: number;
  to: number;
  anchorRect: DOMRect;
}

// Callback invoked when user clicks a Math widget to open in-place editor
export type OnMathEditCallback = (trigger: MathPopoverTrigger) => void;

let globalOnMathEdit: OnMathEditCallback | null = null;

export function setMathEditCallback(cb: OnMathEditCallback | null) {
  globalOnMathEdit = cb;
}

/**
 * Interactive KaTeX Math Widget
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
      ? 'cm-math-widget-display my-3 p-3 bg-muted/40 hover:bg-muted/70 rounded-md border border-border/60 text-center cursor-pointer transition-all hover:border-primary/50 relative group'
      : 'cm-math-widget-inline px-1.5 py-0.5 mx-0.5 bg-muted/30 hover:bg-muted/60 rounded-sm inline-block cursor-pointer transition-all hover:border-primary/50 border border-transparent hover:border-border';

    wrap.title = 'Click to edit LaTeX math formula in-place (Overleaf style)';
    wrap.innerHTML = renderMathHtml(this.math, this.isDisplay);

    // Badge indicator on hover
    const badge = document.createElement('span');
    badge.className =
      'absolute top-1 right-2 text-10 font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none select-none';
    badge.textContent = '✎ edit math';
    if (this.isDisplay) {
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
        // Fallback: select the LaTeX source code
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
 * Image preview widget for \includegraphics{filename}
 */
class ImageWidget extends WidgetType {
  constructor(public readonly src: string, public readonly from: number, public readonly to: number) {
    super();
  }

  override eq(other: ImageWidget): boolean {
    return this.src === other.src && this.from === other.from && this.to === other.to;
  }

  override toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className =
      'cm-image-widget my-3 p-2 bg-muted/20 border border-border/60 rounded-md flex flex-col items-center justify-center';

    const img = document.createElement('img');
    img.src = this.src.startsWith('http') || this.src.startsWith('/') ? this.src : `/${this.src}`;
    img.alt = this.src;
    img.className = 'max-h-64 object-contain rounded-sm shadow-xs';
    img.onerror = () => {
      wrap.innerHTML = `<div class="p-3 text-xs text-muted-foreground flex items-center gap-2"><span>🖼</span><span>Figure: ${this.src}</span></div>`;
    };

    const caption = document.createElement('span');
    caption.className = 'text-xs text-muted-foreground mt-1.5 font-mono';
    caption.textContent = this.src;

    wrap.appendChild(img);
    wrap.appendChild(caption);
    return wrap;
  }
}

/**
 * Citation chip widget for \cite{key}
 */
class CitationWidget extends WidgetType {
  constructor(public readonly citeKey: string, public readonly from: number, public readonly to: number) {
    super();
  }

  override eq(other: CitationWidget): boolean {
    return this.citeKey === other.citeKey && this.from === other.from && this.to === other.to;
  }

  override toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className =
      'cm-citation-chip inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-sm bg-muted text-foreground border border-border text-xs font-mono font-normal hover:bg-muted/80 cursor-pointer select-none transition-colors';
    chip.title = `Citation: ${this.citeKey} (Click to select)`;
    chip.innerHTML = `<span class="opacity-70 text-[10px]">📖</span><span>[${this.citeKey}]</span>`;
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
}

/**
 * Cross-reference chip widget for \ref{key}
 */
class RefWidget extends WidgetType {
  constructor(public readonly refKey: string, public readonly from: number, public readonly to: number) {
    super();
  }

  override eq(other: RefWidget): boolean {
    return this.refKey === other.refKey && this.from === other.from && this.to === other.to;
  }

  override toDOM(view: EditorView): HTMLElement {
    const chip = document.createElement('span');
    chip.className =
      'cm-ref-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-sm bg-muted text-foreground border border-border text-xs font-sans font-medium hover:bg-muted/80 cursor-pointer select-none transition-colors';
    chip.title = `Cross-Reference: ${this.refKey}`;
    chip.innerHTML = `<span class="opacity-70 text-[10px]">🏷️</span><span>${this.refKey}</span>`;
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
}

/**
 * Builds the visual decoration set by scanning the visible document.
 */
function buildVisualDecorations(state: EditorState): DecorationSet {
  const doc = state.doc;
  const fullText = doc.toString();

  interface MatchItem {
    from: number;
    to: number;
    deco: Decoration;
  }

  const replaceItems: MatchItem[] = [];
  const lineRanges: Range<Decoration>[] = [];

  // 1. Display math: $$ ... $$
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

  // 2. Equation environments: \begin{equation}...\end{equation}
  const eqEnvRegex = /\\begin\{(?:equation|align|gather)\*?\}([\s\S]*?)\\end\{(?:equation|align|gather)\*?\}/g;
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

  // 3. Inline math: $ ... $ (excluding $$)
  const inlineMathRegex = /(?<!\$)\$([^$\n]+)\$(?!\$)/g;
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

  // 4. \includegraphics[...]{filename}
  const imgRegex = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(fullText)) !== null) {
    const from = imgMatch.index;
    const to = from + imgMatch[0].length;
    const src = imgMatch[1];
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new ImageWidget(src, from, to),
        block: true,
      }),
    });
  }

  // 5. Tables: \begin{table}... \end{table}
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

  // Standalone \begin{tabular}...\end{tabular} (if not already matched inside a table environment)
  const tabularRegex = /\\begin\{tabular\*?\}(?:\[[^\]]*\])?\{[^}]*\}[\s\S]*?\\end\{tabular\*?\}/g;
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

  // 6. Citations: \cite{...}, \citep{...}, \citet{...}
  const citeRegex = /\\(?:cite|citep|citet|autocite)\{([^}]+)\}/g;
  let cMatch: RegExpExecArray | null;
  while ((cMatch = citeRegex.exec(fullText)) !== null) {
    const from = cMatch.index;
    const to = from + cMatch[0].length;
    const citeKey = cMatch[1];
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new CitationWidget(citeKey, from, to),
      }),
    });
  }

  // 7. References: \ref{...}, \eqref{...}
  const refRegex = /\\(?:ref|eqref|autoref)\{([^}]+)\}/g;
  let rMatch: RegExpExecArray | null;
  while ((rMatch = refRegex.exec(fullText)) !== null) {
    const from = rMatch.index;
    const to = from + rMatch[0].length;
    const refKey = rMatch[1];
    replaceItems.push({
      from,
      to,
      deco: Decoration.replace({
        widget: new RefWidget(refKey, from, to),
      }),
    });
  }

  // 8. Headings: \section, \subsection, \subsubsection
  const secRegex = /\\section\*?\{([^}]+)\}/g;
  let secMatch: RegExpExecArray | null;
  while ((secMatch = secRegex.exec(fullText)) !== null) {
    const from = secMatch.index;
    const lineObj = doc.lineAt(from);
    lineRanges.push(
      Decoration.line({
        attributes: {
          class:
            'cm-visual-heading text-xl font-bold text-foreground border-b border-border/40 pb-1 mb-2',
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
          class: 'cm-visual-subheading text-lg font-semibold text-foreground/90 pb-0.5 mb-1.5',
        },
      }).range(lineObj.from)
    );
  }

  // Sort replace items strictly by position (from ascending, then to ascending)
  replaceItems.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - b.to;
  });

  // Filter out any overlapping replace ranges to avoid collision
  const validReplaceRanges: Range<Decoration>[] = [];
  let lastTo = -1;
  for (const item of replaceItems) {
    if (item.from >= lastTo) {
      validReplaceRanges.push(item.deco.range(item.from, item.to));
      lastTo = Math.max(item.to, item.from);
    }
  }

  // Combine line decorations and replace decorations; Decoration.set sorts and handles layers
  return Decoration.set([...lineRanges, ...validReplaceRanges], true);
}

/**
 * StateField powering Overleaf's Visual Mode on CodeMirror 6.
 * Using StateField + EditorView.decorations.from is the ONLY supported way in CM6
 * to provide block decorations without throwing RangeError: Block decorations may not be specified via plugins.
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

export const latexVisualPlugin: Extension = [latexVisualField];
