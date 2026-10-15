/**
 * latex-folding.ts
 *
 * CodeMirror 6 Intelligent LaTeX Code Folding Service (Block 4: Engines Layer).
 * Location: `features/editor/engines/extensions/latex-folding.ts`
 *
 * Capabilities:
 * 1. Environment Folding: Folds \begin{env} ... \end{env} with nested environment awareness.
 * 2. Section Hierarchy Folding: Folds \section, \chapter, \subsection, etc. up to the
 *    next heading of equal or higher level.
 * 3. Seamlessly integrates into CodeMirror 6 foldGutter.
 */

import { foldService } from '@codemirror/language';
import type { EditorState, Extension } from '@codemirror/state';

const SECTION_WEIGHTS: Record<string, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
};

const SECTION_REGEX = /^\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\{/;
const BEGIN_ENV_REGEX = /\\begin\{([a-zA-Z*]+)\}/;

function stripUnescapedComment(line: string): string {
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '%') {
      let bs = 0;
      for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) bs++;
      if (bs % 2 === 0) return line.slice(0, i);
    }
  }
  return line;
}

export function computeLatexFoldRange(
  state: EditorState,
  lineStart: number,
  _lineEnd?: number,
): { from: number; to: number } | null {
  const line = state.doc.lineAt(lineStart);
  const text = stripUnescapedComment(line.text).trim();
  if (!text) return null;

  // 1. Environment Folding: \begin{env} ... \end{env}
  const envMatch = BEGIN_ENV_REGEX.exec(text);
  if (envMatch) {
    const envName = envMatch[1];
    const beginPattern = `\\begin{${envName}}`;
    const endPattern = `\\end{${envName}}`;

    // Check if the environment already closes on the same line
    let depth = 0;
    let searchIdx = 0;
    while (searchIdx < text.length) {
      const nextBegin = text.indexOf(beginPattern, searchIdx);
      const nextEnd = text.indexOf(endPattern, searchIdx);
      if (nextBegin !== -1 && (nextEnd === -1 || nextBegin < nextEnd)) {
        depth++;
        searchIdx = nextBegin + beginPattern.length;
      } else if (nextEnd !== -1) {
        depth--;
        searchIdx = nextEnd + endPattern.length;
      } else {
        break;
      }
    }

    if (depth > 0) {
      for (let l = line.number + 1; l <= state.doc.lines; l++) {
        const nextLine = state.doc.line(l);
        const nextText = stripUnescapedComment(nextLine.text);

        let idx = 0;
        while (idx < nextText.length) {
          const nb = nextText.indexOf(beginPattern, idx);
          const ne = nextText.indexOf(endPattern, idx);
          if (nb !== -1 && (ne === -1 || nb < ne)) {
            depth++;
            idx = nb + beginPattern.length;
          } else if (ne !== -1) {
            depth--;
            idx = ne + endPattern.length;
            if (depth === 0) {
              const from = line.to;
              const to = nextLine.to;
              if (to > from) {
                return { from, to };
              }
            }
          } else {
            break;
          }
        }
      }
    }
  }

  // 2. Section Hierarchy Folding: \section ... next \section
  const secMatch = SECTION_REGEX.exec(text);
  if (secMatch) {
    const secType = secMatch[1];
    const curWeight = SECTION_WEIGHTS[secType] ?? 99;
    let foldEndLine = state.doc.lines;

    for (let l = line.number + 1; l <= state.doc.lines; l++) {
      const nextLine = state.doc.line(l);
      const nextTrimmed = stripUnescapedComment(nextLine.text).trim();

      if (nextTrimmed.startsWith('\\end{document}')) {
        foldEndLine = l - 1;
        break;
      }

      const nextSecMatch = SECTION_REGEX.exec(nextTrimmed);
      if (nextSecMatch) {
        const nextWeight = SECTION_WEIGHTS[nextSecMatch[1]] ?? 99;
        if (nextWeight <= curWeight) {
          foldEndLine = l - 1;
          break;
        }
      }
    }

    if (foldEndLine > line.number) {
      const targetLine = state.doc.line(foldEndLine);
      const from = line.to;
      const to = targetLine.to;
      if (to > from) {
        return { from, to };
      }
    }
  }

  return null;
}

export const latexFoldService = foldService.of(computeLatexFoldRange);

/**
 * Creates the CodeMirror 6 LaTeX Folding Extension
 */
export function createLatexFoldExtension(): Extension {
  return [latexFoldService];
}
