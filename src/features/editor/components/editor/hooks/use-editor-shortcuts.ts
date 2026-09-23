'use client';

import { useMemo } from 'react';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import {
  Bold,
  BookOpen,
  Braces,
  ChevronRight,
  Clipboard,
  Code,
  Copy,
  Hash,
  Italic,
  List,
  MessageSquarePlus,
  Pencil,
  Scissors,
  Search,
  Sigma,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
  Zap,
  FileCheck,
} from 'lucide-react';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useActionsStore } from '@/features/editor/store';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';

export interface MenuAction {
  icon?: React.ElementType;
  label: string;
  kbd?: string;
  action: () => void;
  disabled?: boolean;
}

export interface UseEditorShortcutsOptions {
  editorRef?: React.MutableRefObject<any>;
  closeMenu: () => void;
  openRenameDialog: () => void;
  openCitationModal: () => void;
  openSuggestModal: (opts: {
    originalText: string;
    suggestedText: string;
    fromLine: number;
    toLine: number;
    type: 'replace' | 'insert' | 'delete';
    description: string;
  }) => void;
  ctxStartLine: number | null;
  ctxEndLine: number | null;
  ctxSelText: string;
}

export function useEditorShortcuts({
  editorRef,
  closeMenu,
  openRenameDialog,
  openCitationModal,
  openSuggestModal,
  ctxStartLine,
  ctxEndLine,
  ctxSelText,
}: UseEditorShortcutsOptions) {
  const { engine } = useEditorInstance();
  const setPendingComment = useActionsStore((s) => s.setPendingComment);

  const trigger = (action: string) => {
    if (action === 'undo') {
      engine?.undo();
    } else if (action === 'redo') {
      engine?.redo();
    }
    closeMenu();
  };

  const wrapSel = (before: string, after: string) => {
    if (engine) {
      engine.wrapSelection(before, after);
    }
    closeMenu();
  };

  const insertAt = (text: string) => {
    if (engine) {
      engine.insertText(text);
    }
    closeMenu();
  };

  const applyRename = (word: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === word || !engine) return;
    const content = engine.getContent();
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    engine.setContent(content.replace(regex, trimmed));
  };

  const menuGroups: MenuAction[][] = useMemo(() => [
    [
      {
        icon: Scissors,
        label: 'Cut',
        kbd: 'Ctrl+X',
        action: () => trigger('editor.action.clipboardCutAction'),
      },
      {
        icon: Copy,
        label: 'Copy',
        kbd: 'Ctrl+C',
        action: () => trigger('editor.action.clipboardCopyAction'),
      },
      {
        icon: Clipboard,
        label: 'Paste',
        kbd: 'Ctrl+V',
        action: () => trigger('editor.action.clipboardPasteAction'),
      },
    ],
    [
      { label: 'Undo', kbd: 'Ctrl+Z', action: () => trigger('undo') },
      { label: 'Redo', kbd: 'Ctrl+Y', action: () => trigger('redo') },
    ],
    [
      { icon: Bold, label: 'Bold', action: () => wrapSel('\\textbf{', '}') },
      {
        icon: Italic,
        label: 'Italic',
        action: () => wrapSel('\\textit{', '}'),
      },
      {
        icon: Underline,
        label: 'Underline',
        action: () => wrapSel('\\underline{', '}'),
      },
      {
        icon: Code,
        label: 'Typewriter',
        action: () => wrapSel('\\texttt{', '}'),
      },
      {
        icon: Strikethrough,
        label: 'Strikethrough',
        action: () => wrapSel('\\sout{', '}'),
      },
      {
        icon: Superscript,
        label: 'Superscript',
        action: () => wrapSel('^{', '}'),
      },
      { icon: Subscript, label: 'Subscript', action: () => wrapSel('_{', '}') },
    ],
    [
      {
        icon: Sigma,
        label: 'Inline Math',
        kbd: '$…$',
        action: () => wrapSel('$', '$'),
      },
      {
        icon: Braces,
        label: 'Display Math',
        action: () => wrapSel('\\[\n  ', '\n\\]'),
      },
      {
        label: 'Equation env',
        action: () => wrapSel('\\begin{equation}\n  ', '\n\\end{equation}'),
      },
      {
        label: 'Align env',
        action: () => wrapSel('\\begin{align}\n  ', '\n\\end{align}'),
      },
    ],
    [
      { icon: Hash, label: 'Section', action: () => insertAt('\\section{}') },
      {
        icon: ChevronRight,
        label: 'Subsection',
        action: () => insertAt('\\subsection{}'),
      },
      { icon: List, label: 'List item', action: () => insertAt('\\item ') },
      {
        icon: BookOpen,
        label: 'Insert Citation...',
        action: () => {
          closeMenu();
          openCitationModal();
        },
      },
    ],
    [
      {
        icon: Search,
        label: 'Find / Replace',
        kbd: 'Ctrl+F',
        action: () => trigger('actions.find'),
      },
      {
        icon: Search,
        label: 'Search in Project',
        kbd: 'Ctrl+Shift+F',
        action: () => {
          EditorEventBus.emit('flux:open-panel', { panel: 'Search', query: ctxSelText || undefined });
          closeMenu();
        },
      },
      {
        icon: Pencil,
        label: 'Rename Occurrences',
        kbd: 'F2',
        action: openRenameDialog,
      },
      {
        icon: Zap,
        label: 'Compile',
        kbd: 'Ctrl+↵',
        action: () => {
          editorCommandBus.dispatch({ type: 'compiler:trigger' });
          closeMenu();
        },
      },
    ],
    [
      {
        icon: MessageSquarePlus,
        label: 'Add Comment',
        action: () => {
          setPendingComment({
            startLine: ctxStartLine ?? 1,
            endLine: ctxEndLine ?? ctxStartLine ?? 1,
            selectedText: ctxSelText,
          });
          EditorEventBus.emit('flux:open-panel', 'Review');
          closeMenu();
        },
      },
      {
        icon: FileCheck,
        label: 'Suggest Edit (Track Changes)',
        action: () => {
          openSuggestModal({
            originalText: ctxSelText,
            suggestedText: ctxSelText,
            fromLine: ctxStartLine ?? 1,
            toLine: ctxEndLine ?? ctxStartLine ?? 1,
            type: ctxSelText ? 'replace' : 'insert',
            description: '',
          });
          closeMenu();
        },
      },
    ],
  ], [
    ctxStartLine,
    ctxEndLine,
    ctxSelText,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    menuGroups,
    wrapSel,
    insertAt,
    applyRename,
  };
}
