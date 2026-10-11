/**
 * latex-math-preview.ts
 *
 * CodeMirror 6 KaTeX Math Hover Preview (Block 4: Engines Layer).
 * Location: `features/editor/engines/extensions/latex-math-preview.ts`
 *
 * Inspects hovered text for LaTeX math delimiters ($...$, $$...$$, \begin{equation}...)
 * and renders high-fidelity KaTeX rendered math directly inside a popover tooltip.
 */

import { hoverTooltip, type Tooltip } from '@codemirror/view';
import katex from 'katex';

export interface MathMatchResult {
  type: 'inline' | 'display' | 'bracket' | 'environment';
  formula: string;
  from: number;
  to: number;
}

export function detectMathAtPosition(lineText: string, col: number): MathMatchResult | null {
  // 1. Double dollar $$ ... $$
  const displayDollarRegex = /\$\$([\s\S]*?)\$\$/g;
  let match: RegExpExecArray | null;

  while ((match = displayDollarRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end) {
      return {
        type: 'display',
        formula: match[1].trim(),
        from: start,
        to: end,
      };
    }
  }

  // 2. Bracket math \[ ... \]
  const bracketRegex = /\\\[([\s\S]*?)\\\]/g;
  while ((match = bracketRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end) {
      return {
        type: 'bracket',
        formula: match[1].trim(),
        from: start,
        to: end,
      };
    }
  }

  // 3. Single dollar $ ... $
  const singleDollarRegex = /\$([^\$]+)\$/g;
  while ((match = singleDollarRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end) {
      return {
        type: 'inline',
        formula: match[1].trim(),
        from: start,
        to: end,
      };
    }
  }

  // 4. Closed LaTeX Environment \begin{...}...\end{...}
  const envRegex = /\\begin\{(equation\*?|align\*?|gather\*?|matrix|pmatrix|bmatrix)\}([\s\S]*?)\\end\{\1\}/g;
  while ((match = envRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end) {
      return {
        type: 'environment',
        formula: match[0],
        from: start,
        to: end,
      };
    }
  }

  // 5. Unclosed \begin{equation...} on line
  const beginEnvRegex = /\\begin\{(equation\*?|align\*?|gather\*?|matrix|pmatrix|bmatrix)\}/g;
  while ((match = beginEnvRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (col >= start && col <= end) {
      return {
        type: 'environment',
        formula: match[0],
        from: start,
        to: end,
      };
    }
  }

  return null;
}

export const latexMathHoverTooltip = hoverTooltip((view, pos): Tooltip | null => {
  const doc = view.state.doc;
  const line = doc.lineAt(pos);
  const col = pos - line.from;
  const match = detectMathAtPosition(line.text, col);

  if (match) {
    return renderMathTooltip(
      line.from + match.from,
      line.from + match.to,
      match.formula,
      match.type !== 'inline'
    );
  }

  // Multiline environment fallback (equation, align, gather, etc.)
  const MATH_ENVS = ['equation', 'equation*', 'align', 'align*', 'gather', 'gather*', 'multline', 'multline*', 'matrix', 'pmatrix', 'bmatrix'];
  const maxScan = 35;
  const startLine = Math.max(1, line.number - maxScan);
  const endLine = Math.min(doc.lines, line.number + maxScan);

  for (const env of MATH_ENVS) {
    const beginTag = `\\begin{${env}}`;
    const endTag = `\\end{${env}}`;
    let beginPos = -1;
    let endPos = -1;

    for (let l = line.number; l >= startLine; l--) {
      const text = doc.line(l).text;
      const idx = text.indexOf(beginTag);
      if (idx !== -1) {
        beginPos = doc.line(l).from + idx;
        break;
      }
      if (l < line.number && text.includes(endTag)) break;
    }

    if (beginPos !== -1) {
      for (let l = line.number; l <= endLine; l++) {
        const text = doc.line(l).text;
        const idx = text.indexOf(endTag);
        if (idx !== -1) {
          endPos = doc.line(l).from + idx + endTag.length;
          break;
        }
        if (l > line.number && text.includes(beginTag)) break;
      }

      if (endPos !== -1 && pos >= beginPos && pos <= endPos) {
        const formula = doc.sliceString(beginPos, endPos);
        return renderMathTooltip(beginPos, endPos, formula, true);
      }
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
