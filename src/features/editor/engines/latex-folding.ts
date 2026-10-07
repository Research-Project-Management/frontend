/**
 * latex-folding.ts
 *
 * CodeMirror 6 Intelligent LaTeX Code Folding Service (Block 4: Engines Layer).
 * Location: `features/editor/engines/latex-folding.ts`
 *
 * Capabilities:
 * 1. Environment Folding: Folds \begin{env} ... \end{env} with nested environment awareness.
 * 2. Section Hierarchy Folding: Folds \section, \chapter, \subsection, etc. up to the
 *    next heading of equal or higher level.
 * 3. Seamlessly integrates into CodeMirror 6 foldGutter.
 */

import { foldService, type Extension } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

const SECTION_WEIGHTS: Record<string, number> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
  subparagraph: 6,
};

const SECTION_REGEX = /^\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?\{/;
const BEGIN_ENV_REGEX = /\\begin\{([a-zA-Z*]+)\}/;

export const latexFoldService = foldService.of(
  (state: EditorState, lineStart: number, lineEnd: number): { from: number; to: number } | null => {
    const line = state.doc.lineAt(lineStart);
    const text = line.text.trim();

    // 1. Environment Folding: \begin{env} ... \end{env}
    const envMatch = BEGIN_ENV_REGEX.exec(text);
    if (envMatch) {
      const envName = envMatch[1];
      const endPattern = `\\end{${envName}}`;
      let depth = 1;

      for (let l = line.number + 1; l <= state.doc.lines; l++) {
        const nextLine = state.doc.line(l);
        const nextText = nextLine.text;

        if (nextText.includes(`\\begin{${envName}}`)) {
          depth++;
        }
        if (nextText.includes(endPattern)) {
          depth--;
          if (depth === 0) {
            // Fold from the end of \begin{env} line to just before \end{env} line ends
            const from = line.to;
            const to = nextLine.to;
            if (to > from) {
              return { from, to };
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
        const nextTrimmed = nextLine.text.trim();

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
);

/**
 * Creates the CodeMirror 6 LaTeX Folding Extension
 */
export function createLatexFoldExtension(): Extension {
  return [latexFoldService];
}
