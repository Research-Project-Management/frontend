/**
 * latex-auto-close.ts
 *
 * Overleaf-parity auto-closing for LaTeX environments:
 * - When typing '}' after '\begin{env}', or pressing Enter on '\begin{env}',
 *   automatically inserts matching '\end{env}' and positions cursor on the indented body line.
 * - Respects document indentation and guards against duplicate '\end{env}'.
 */

import { EditorView, KeyBinding, keymap, Command } from '@codemirror/view';
import { Extension, Prec, EditorSelection } from '@codemirror/state';

const BEGIN_ENV_REGEX = /^(\s*)\\begin\{([a-zA-Z0-9*_-]+)\}(?:\[[^\]]*\])?(?:\s*\{[^}]*\})*\s*$/;
const BEGIN_INCOMPLETE_REGEX = /^(\s*)\\begin\{([a-zA-Z0-9*_-]+)$/;

/**
 * Checks if a matching \end{env} exists within the next few lines
 */
function hasMatchingEnd(view: EditorView, envName: string, startLineNum: number, maxLookahead = 30): boolean {
  const totalLines = view.state.doc.lines;
  const endLimit = Math.min(totalLines, startLineNum + maxLookahead);
  const escapedEnv = envName.replace(/[*_]/g, '\\$&');
  const endPattern = new RegExp(`\\\\end\\{${escapedEnv}\\}`);
  const beginPattern = new RegExp(`\\\\begin\\{${escapedEnv}\\}`);

  let depth = 1;
  for (let i = startLineNum + 1; i <= endLimit; i++) {
    const text = view.state.doc.line(i).text;
    if (beginPattern.test(text)) {
      depth++;
    }
    if (endPattern.test(text)) {
      depth--;
      if (depth === 0) return true;
    }
  }
  return false;
}

/**
 * Command executed on Enter key after \begin{env}
 */
export const handleEnterEnvironment: Command = (view: EditorView) => {
  const { state } = view;
  if (state.selection.ranges.length !== 1 || !state.selection.main.empty) {
    return false;
  }

  const pos = state.selection.main.from;
  const line = state.doc.lineAt(pos);
  const lineTextUptoCursor = line.text.slice(0, pos - line.from);
  const match = lineTextUptoCursor.match(BEGIN_ENV_REGEX);

  if (!match) return false;

  const indent = match[1] || '';
  const envName = match[2];

  // If already followed by matching \end{env}, do standard enter
  if (hasMatchingEnd(view, envName, line.number)) {
    return false;
  }

  const bodyIndent = indent + '  ';
  const insertText = `\n${bodyIndent}\n${indent}\\end{${envName}}`;
  const targetCursorPos = pos + 1 + bodyIndent.length;

  view.dispatch({
    changes: { from: pos, to: pos, insert: insertText },
    selection: EditorSelection.cursor(targetCursorPos),
    scrollIntoView: true,
  });

  return true;
};

/**
 * DOM event handler for typing '}'
 */
const autoCloseOnBrace = EditorView.domEventHandlers({
  beforeinput(event: InputEvent, view: EditorView): boolean {
    if (event.data !== '}') return false;
    const { state } = view;
    if (state.selection.ranges.length !== 1 || !state.selection.main.empty) {
      return false;
    }

    const pos = state.selection.main.from;
    const line = state.doc.lineAt(pos);
    const beforeCursor = line.text.slice(0, pos - line.from);
    const match = beforeCursor.match(BEGIN_INCOMPLETE_REGEX);

    if (!match) return false;

    const indent = match[1] || '';
    const envName = match[2];

    // Check if there is already a matching \end{env}
    if (hasMatchingEnd(view, envName, line.number)) {
      return false;
    }

    // Check if after cursor there is already '}'
    const afterCursor = line.text.slice(pos - line.from);
    if (afterCursor.startsWith('}')) {
      return false;
    }

    event.preventDefault();
    const bodyIndent = indent + '  ';
    const insertText = `}\n${bodyIndent}\n${indent}\\end{${envName}}`;
    const targetCursorPos = pos + 1 + 1 + bodyIndent.length;

    view.dispatch({
      changes: { from: pos, to: pos, insert: insertText },
      selection: EditorSelection.cursor(targetCursorPos),
      scrollIntoView: true,
    });

    return true;
  },
});

const autoCloseKeymap: KeyBinding[] = [
  {
    key: 'Enter',
    run: handleEnterEnvironment,
  },
];

export const latexAutoCloseExtension: Extension = [
  Prec.high(keymap.of(autoCloseKeymap)),
  autoCloseOnBrace,
];
