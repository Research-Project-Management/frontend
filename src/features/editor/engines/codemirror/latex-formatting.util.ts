/**
 * latex-formatting.util.ts
 *
 * CodeMirror 6 text transformation utilities for Overleaf LaTeX parity:
 * - Wrap selected text with LaTeX format tags (\textbf, \textit, \underline, etc.)
 * - Auto-close \begin{<env>} on Enter with proper LaTeX indentation
 */

import type { EditorView } from '@codemirror/view';

/**
 * Wraps selection with LaTeX formatting command (Overleaf parity).
 * If selection is non-empty: wraps selection and places cursor at the end.
 * If selection is empty: inserts command with empty braces and places cursor inside.
 */
export function wrapFormatting(view: EditorView, prefix: string, suffix: string): boolean {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  const replacement = `${prefix}${selected}${suffix}`;
  view.dispatch({
    changes: { from, to, insert: replacement },
    selection: {
      anchor: selected ? from + prefix.length + selected.length : from + prefix.length,
    },
    userEvent: 'input.format',
  });
  return true;
}

/**
 * Automatically closes LaTeX environments on Enter (Overleaf parity).
 * E.g. when pressing Enter right after `\begin{equation}`, automatically inserts
 * the indented body and matching `\end{equation}`.
 */
export function handleAutoCloseEnvironment(view: EditorView): boolean {
  const { head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head);
  const textBefore = line.text.slice(0, head - line.from);
  const match = textBefore.match(/\\begin\{([a-zA-Z*]+)\}\s*$/);
  if (match) {
    const envName = match[1];
    const textAfter = line.text.slice(head - line.from);
    if (textAfter.includes(`\\end{${envName}}`)) {
      return false;
    }
    const indent = textBefore.match(/^(\s*)/)?.[1] || '';
    const insertText = `\n${indent}  \n${indent}\\end{${envName}}`;
    view.dispatch({
      changes: { from: head, to: head, insert: insertText },
      selection: { anchor: head + indent.length + 3 },
      userEvent: 'input.complete.environment',
    });
    return true;
  }
  return false;
}
