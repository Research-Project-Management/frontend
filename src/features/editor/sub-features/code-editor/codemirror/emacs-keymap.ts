/**
 * emacs-keymap.ts
 *
 * CodeMirror 6 Emacs Keymap Provider (Overleaf Parity):
 * Implements standard Emacs motion, editing, kill-ring, and file chords.
 */

import { type KeyBinding } from '@codemirror/view';
import {
  cursorLineStart,
  cursorLineEnd,
  cursorCharLeft,
  cursorCharRight,
  cursorLineUp,
  cursorLineDown,
  cursorPageUp,
  cursorPageDown,
  cursorDocStart,
  cursorDocEnd,
  cursorGroupLeft,
  cursorGroupRight,
  deleteCharBackward,
  deleteCharForward,
  deleteGroupBackward,
  deleteGroupForward,
  deleteToLineEnd,
  undo,
  redo,
  selectAll,
} from '@codemirror/commands';
import { openSearchPanel, closeSearchPanel } from '@codemirror/search';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';

export const emacsKeymap: readonly KeyBinding[] = [
  // Navigation
  { key: 'Ctrl-a', run: cursorLineStart },
  { key: 'Ctrl-e', run: cursorLineEnd },
  { key: 'Ctrl-f', run: cursorCharRight },
  { key: 'Ctrl-b', run: cursorCharLeft },
  { key: 'Ctrl-p', run: cursorLineUp },
  { key: 'Ctrl-n', run: cursorLineDown },
  { key: 'Ctrl-v', run: cursorPageDown },
  { key: 'Alt-v', run: cursorPageUp },
  { key: 'Alt-f', run: cursorGroupRight },
  { key: 'Alt-b', run: cursorGroupLeft },
  { key: 'Alt-<', run: cursorDocStart },
  { key: 'Alt->', run: cursorDocEnd },

  // Deletion & Kill
  { key: 'Ctrl-d', run: deleteCharForward },
  { key: 'Ctrl-h', run: deleteCharBackward },
  { key: 'Ctrl-k', run: deleteToLineEnd },
  { key: 'Alt-d', run: deleteGroupForward },
  { key: 'Alt-Backspace', run: deleteGroupBackward },

  // History & Undo
  { key: 'Ctrl-/', run: undo },
  { key: 'Ctrl-_', run: undo },
  { key: 'Ctrl-x u', run: undo },
  { key: 'Ctrl-g', run: (view) => { closeSearchPanel(view); return true; } },

  // Search
  { key: 'Ctrl-s', run: openSearchPanel },
  { key: 'Ctrl-r', run: openSearchPanel },

  // Selection & Actions
  { key: 'Ctrl-x h', run: selectAll },

  // Overleaf compilation & file save chord: C-x C-s
  {
    key: 'Ctrl-x Ctrl-s',
    run: () => {
      editorCommandBus.dispatch({ type: 'compiler:trigger' });
      return true;
    },
  },
];
