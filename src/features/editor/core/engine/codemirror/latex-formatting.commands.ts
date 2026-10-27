/**
 * latex-formatting.commands.ts
 *
 * CodeMirror 6 text transformation commands and Overleaf-parity keybindings:
 * - Wrap selected text with LaTeX format tags (\textbf, \textit, \underline, etc.)
 * - Auto-close \begin{<env>} on Enter with proper LaTeX indentation
 * - Auto-close inline math ($...$) and Backspace between $$
 * - Case conversion (Mod-u / Mod-Shift-u) and Overleaf keymap bindings
 */

import { EditorSelection } from '@codemirror/state';
import { type EditorView, type KeyBinding } from '@codemirror/view';
import {
  toggleComment,
  addCursorAbove,
  addCursorBelow,
  deleteLine,
} from '@codemirror/commands';
import {
  foldCode,
  unfoldCode,
  foldAll,
  unfoldAll,
} from '@codemirror/language';
import { gotoLine, selectNextOccurrence } from '@codemirror/search';
import { editorCommandBus } from '../../bus/command-bus';
import { useDocumentCollaborationStore } from '../../store/collaboration.store';
import { useSettingsStore } from '../../store/settings.store';

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
 * Converts selected text to uppercase or lowercase across all selection ranges.
 */
export function changeCase(view: EditorView, toUpper: boolean): boolean {
  const { state } = view;
  const tr = state.changeByRange((range) => {
    if (range.empty) return { range };
    const text = state.sliceDoc(range.from, range.to);
    const newText = toUpper ? text.toUpperCase() : text.toLowerCase();
    return {
      changes: { from: range.from, to: range.to, insert: newText },
      range: EditorSelection.range(range.from, range.from + newText.length),
    };
  });
  if (tr.changes.empty) return false;
  view.dispatch(tr);
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
  const match = textBefore.match(/\\begin\{([a-zA-Z*]+)\}(?:\[[^\]]*\]|\{[^{}]*\}|\{@\{\}[^{}]*@\{\}\})*\s*$/);
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

/**
 * Automatically handles LaTeX inline math ($...$) typing (Overleaf parity).
 * - If text is selected: wraps selection in $...$
 * - If cursor is immediately after an unescaped '\': lets normal '$' insert for literal '\$'
 * - If cursor is immediately before a '$': skips past it without inserting duplicate
 * - Otherwise: inserts '$$' and places cursor between them
 */
export function handleAutoCloseMath(view: EditorView): boolean {
  if (!useSettingsStore.getState().autoCloseBrackets) {
    return false;
  }
  const { from, to } = view.state.selection.main;
  if (from !== to) {
    const selected = view.state.sliceDoc(from, to);
    view.dispatch({
      changes: { from, to, insert: `$${selected}$` },
      selection: { anchor: to + 2 },
      userEvent: 'input.format.math',
    });
    return true;
  }

  // If preceded by an odd number of backslashes, user is typing escaped '\$'
  if (from > 0) {
    const line = view.state.doc.lineAt(from);
    const col = from - line.from;
    let backslashes = 0;
    for (let i = col - 1; i >= 0 && line.text[i] === '\\'; i--) {
      backslashes++;
    }
    if (backslashes % 2 === 1) {
      return false;
    }
  }

  // Check character immediately following cursor
  const nextChar = view.state.sliceDoc(from, from + 1);
  if (nextChar === '$') {
    // Skip over the existing closing '$'
    view.dispatch({
      selection: { anchor: from + 1 },
      userEvent: 'select',
    });
    return true;
  }

  // Insert pair '$$' and place cursor inside
  view.dispatch({
    changes: { from, to, insert: '$$' },
    selection: { anchor: from + 1 },
    userEvent: 'input.complete.math',
  });
  return true;
}

/**
 * Handles Backspace when cursor is directly between a '$' and '$' (Overleaf parity).
 * Deletes both '$' characters simultaneously.
 */
export function handleBackspaceBetweenMath(view: EditorView): boolean {
  if (!useSettingsStore.getState().autoCloseBrackets) {
    return false;
  }
  const { from, to } = view.state.selection.main;
  if (from === to && from > 0) {
    const prevChar = view.state.sliceDoc(from - 1, from);
    const nextChar = view.state.sliceDoc(from, from + 1);
    if (prevChar === '$' && nextChar === '$') {
      view.dispatch({
        changes: { from: from - 1, to: from + 1, insert: '' },
        selection: { anchor: from - 1 },
        userEvent: 'delete.backward',
      });
      return true;
    }
  }
  return false;
}

/**
 * Overleaf-parity LaTeX formatting and editor navigation keybindings.
 */
export const latexFormattingKeymap: readonly KeyBinding[] = [
  {
    key: 'Mod-Enter',
    run: () => {
      editorCommandBus.dispatch({ type: 'compiler:trigger', reason: 'shortcut' });
      return true;
    },
  },
  {
    key: 'Mod-b',
    run: (view) => wrapFormatting(view, '\\textbf{', '}'),
  },
  {
    key: 'Mod-i',
    run: (view) => wrapFormatting(view, '\\textit{', '}'),
  },
  {
    key: 'Mod-u',
    run: (view) => {
      const hasSelection = view.state.selection.ranges.some((r) => !r.empty);
      if (hasSelection) {
        return changeCase(view, true);
      }
      return wrapFormatting(view, '\\underline{', '}');
    },
  },
  {
    key: 'Mod-Shift-u',
    run: (view) => changeCase(view, false),
  },
  {
    key: 'Enter',
    run: (view) => handleAutoCloseEnvironment(view),
  },
  {
    key: '$',
    run: (view) => handleAutoCloseMath(view),
  },
  {
    key: 'Backspace',
    run: (view) => handleBackspaceBetweenMath(view),
  },
  {
    key: 'Mod-Shift-t',
    run: () => {
      editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' });
      return true;
    },
  },
  {
    key: 'Mod-Shift-v',
    run: () => {
      useSettingsStore.getState().toggleEditorMode();
      return true;
    },
  },
  {
    key: 'Mod-Shift-w',
    run: () => {
      editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
      return true;
    },
  },
  {
    key: 'F1',
    run: () => {
      editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
      return true;
    },
    preventDefault: true,
  },
  {
    key: 'F8',
    run: () => {
      editorCommandBus.dispatch({ type: 'navigation:next-error' });
      return true;
    },
  },
  {
    key: 'Shift-F8',
    run: () => {
      editorCommandBus.dispatch({ type: 'navigation:prev-error' });
      return true;
    },
  },
  {
    key: 'Mod-Shift-f',
    run: (view) => {
      const { from, to } = view.state.selection.main;
      const selectedText = from < to ? view.state.sliceDoc(from, to) : undefined;
      editorCommandBus.dispatch({
        type: 'sidebar:open-panel',
        panel: 'Search',
        query: selectedText,
      });
      return true;
    },
  },
  {
    key: 'Mod-Shift-h',
    run: (view) => {
      const { from, to } = view.state.selection.main;
      const selectedText = from < to ? view.state.sliceDoc(from, to) : undefined;
      editorCommandBus.dispatch({
        type: 'sidebar:open-panel',
        panel: 'Search',
        query: selectedText,
        showReplace: true,
      });
      return true;
    },
  },
  {
    key: 'Mod-Alt-m',
    run: (view) => {
      const { from, to } = view.state.selection.main;
      const selectedText = view.state.sliceDoc(from, to);
      const startLine = view.state.doc.lineAt(from).number;
      const endLine = view.state.doc.lineAt(to).number;

      useDocumentCollaborationStore.getState().setPendingComment({
        startLine,
        endLine,
        selectedText: selectedText || '',
      });

      editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
      return true;
    },
  },
  { key: 'Mod-/', run: toggleComment },
  { key: 'Mod-Shift-l', run: gotoLine },
  { key: 'Mod-g', run: gotoLine },
  { key: 'Mod-Alt-[', run: foldCode },
  { key: 'Mod-Alt-]', run: unfoldCode },
  { key: 'Mod-Alt-Shift-[', run: foldAll },
  { key: 'Mod-Alt-Shift-]', run: unfoldAll },
  {
    key: 'Mod-Shift-k',
    run: () => {
      editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
      return true;
    },
  },
  {
    key: 'Mod-Alt-j',
    run: (view) => {
      const pos = view.state.selection.main.from;
      const lineObj = view.state.doc.lineAt(pos);
      editorCommandBus.dispatch({
        type: 'synctex:forward',
        line: lineObj.number,
        column: pos - lineObj.from,
      });
      return true;
    },
  },
  {
    key: 'Ctrl-Alt-j',
    run: (view) => {
      const pos = view.state.selection.main.from;
      const lineObj = view.state.doc.lineAt(pos);
      editorCommandBus.dispatch({
        type: 'synctex:forward',
        line: lineObj.number,
        column: pos - lineObj.from,
      });
      return true;
    },
  },
  {
    key: 'Mod-d',
    run: deleteLine,
    preventDefault: true,
  },
  {
    key: 'Alt-d',
    run: selectNextOccurrence,
    preventDefault: true,
  },
  {
    key: 'Alt-Shift-ArrowUp',
    run: addCursorAbove,
  },
  {
    key: 'Alt-Shift-ArrowDown',
    run: addCursorBelow,
  },
  {
    key: 'Ctrl-Alt-ArrowUp',
    run: addCursorAbove,
  },
  {
    key: 'Ctrl-Alt-ArrowDown',
    run: addCursorBelow,
  },
];
