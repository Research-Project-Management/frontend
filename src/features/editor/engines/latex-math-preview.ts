/**
 * latex-math-preview.ts
 *
 * CodeMirror 6 KaTeX Math Hover Preview (Block 4: Engines Layer).
 * Location: `features/editor/engines/latex-math-preview.ts`
 *
 * Inspects hovered text for LaTeX math delimiters ($...$, $$...$$, \begin{equation}...)
 * and renders high-fidelity KaTeX rendered math directly inside a popover tooltip.
 */

import { hoverTooltip, type Tooltip } from '@codemirror/view';
import katex from 'katex';

export const latexMathHoverTooltip = hoverTooltip((view, pos, side): Tooltip | null => {
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const col = pos - line.from;

  // Check for inline or display math on the line
  // 1. Double dollar $$ ... $$
  const displayDollarRegex = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = displayDollarRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end) {
      const mathContent = match[1].trim();
      return renderMathTooltip(line.from + start, line.from + end, mathContent, true);
    }
  }

  // 2. Single dollar $ ... $
  const singleDollarRegex = /\$([^\$]+)\$/g;
  while ((match = singleDollarRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end) {
      const mathContent = match[1].trim();
      return renderMathTooltip(line.from + start, line.from + end, mathContent, false);
    }
  }

  // 3. LaTeX Environment \begin{equation|align|gather}...
  const envRegex = /\\begin\{(equation\*?|align\*?|gather\*?|matrix|pmatrix|bmatrix)\}([\s\S]*?)\\end\{\1\}/g;
  while ((match = envRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end) {
      return renderMathTooltip(line.from + start, line.from + end, match[0], true);
    }
  }

  return null;
});

function renderMathTooltip(
  from: number,
  to: number,
  mathSource: string,
  displayMode: boolean
): Tooltip {
  return {
    pos: from,
    end: to,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className =
        'cm-math-preview-tooltip px-3 py-2 bg-popover text-popover-foreground border border-border rounded-md shadow-md text-sm max-w-md overflow-x-auto select-none';

      try {
        katex.render(mathSource, dom, {
          displayMode,
          throwOnError: false,
        });
      } catch (err) {
        dom.textContent = mathSource;
      }

      return { dom };
    },
  };
}
