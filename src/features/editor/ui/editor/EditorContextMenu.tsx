'use client';

/**
 * EditorContextMenu.tsx
 *
 * Tailored Contextual Menu for CodeMirror 6 Source Editor (Overleaf Parity).
 * Location: `features/editor/ui/features/editor/EditorContextMenu.tsx`
 *
 * Implements Overleaf Redesigned Editor Contextual Menu specification:
 * - Common Actions: Cut, Copy, Paste, Delete, Toggle Comment.
 * - Review: Add inline review comment thread on current selection/line.
 * - Navigation: Jump to location in PDF (forward SyncTeX).
 * - LaTeX Formatting: Bold (\textbf), Italic (\textit), Underline (\underline), Math ($), Code (\texttt).
 * - LaTeX Insertion: Insert Figure, Insert Table, Insert Citation.
 * - Shift + Right Click bypasses custom menu to show browser native context menu.
 */

import React, { useState, useCallback } from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@/shared/components/ui/context-menu';
import {
  Scissors,
  Copy,
  ClipboardPaste,
  Trash2,
  ExternalLink,
  MessageSquarePlus,
  MessageSquareCode,
  Bold,
  Italic,
  Underline,
  Code2,
  Pi,
  Table as TableIcon,
  Image as ImageIcon,
  BookMarked,
  CheckSquare,
  FileText,
  FileEdit,
} from 'lucide-react';
import { getActiveEditorEngine, editorCommandBus } from '@/features/editor/core';

export interface EditorContextMenuProps {
  children: React.ReactNode;
  disabled?: boolean;
}

export function EditorContextMenu({ children, disabled = false }: EditorContextMenuProps) {
  const [shiftBypass, setShiftBypass] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      const engine = getActiveEditorEngine();
      const selected = engine?.getSelectedText?.() || '';
      setHasSelection(selected.trim().length > 0);
    }
  }, []);

  const handleBackToEditing = useCallback(() => {
    const engine = getActiveEditorEngine();
    engine?.focus?.();
  }, []);

  const handleContextMenuCapture = useCallback((e: React.MouseEvent) => {
    // Overleaf specification: Holding Shift while right-clicking triggers native browser context menu
    if (e.shiftKey) {
      setShiftBypass(true);
    } else {
      setShiftBypass(false);
    }
  }, []);

  const handleCut = useCallback(async () => {
    const engine = getActiveEditorEngine();
    if (!engine) return;
    const selected = engine.getSelectedText?.() || '';
    if (selected) {
      try {
        await navigator.clipboard.writeText(selected);
        engine.insertText('');
        engine.focus();
      } catch {
        document.execCommand('cut');
        engine.focus();
      }
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const engine = getActiveEditorEngine();
    if (!engine) return;
    const selected = engine.getSelectedText?.() || '';
    if (selected) {
      try {
        await navigator.clipboard.writeText(selected);
      } catch {
        document.execCommand('copy');
      }
    }
  }, []);

  const handlePaste = useCallback(async () => {
    const engine = getActiveEditorEngine();
    if (!engine) return;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        engine.insertText(text);
        engine.focus();
      }
    } catch {
      document.execCommand('paste');
      engine.focus();
    }
  }, []);

  const handleDelete = useCallback(() => {
    const engine = getActiveEditorEngine();
    if (engine) {
      engine.insertText('');
      engine.focus();
    }
  }, []);

  const handleToggleLineComment = useCallback(() => {
    const engine = getActiveEditorEngine();
    if (engine) {
      engine.toggleComment?.();
      engine.focus();
    }
  }, []);

  const handleAddReviewComment = useCallback(() => {
    editorCommandBus.dispatch({ type: 'review:create-comment' });
  }, []);

  const handleJumpToPdf = useCallback(() => {
    const engine = getActiveEditorEngine();
    if (!engine) return;

    const sel = engine.getSelection?.();
    const cursor = engine.getCursorPosition?.();
    const line = sel?.startLine ?? cursor?.line ?? 1;
    const column = sel?.startColumn ?? cursor?.column ?? 0;
    editorCommandBus.dispatch({
      type: 'synctex:forward',
      line,
      column,
    });
  }, []);

  const handleFormat = useCallback((type: 'bold' | 'italic' | 'underline' | 'code' | 'inlineMath') => {
    const engine = getActiveEditorEngine();
    engine?.format?.(type);
    engine?.focus?.();
  }, []);

  const handleSelectAll = useCallback(() => {
    const engine = getActiveEditorEngine();
    engine?.selectAll?.();
    engine?.focus?.();
  }, []);

  const handleWordCount = useCallback(() => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'word-count' });
  }, []);

  return (
    <div
      onContextMenuCapture={handleContextMenuCapture}
      className="h-full w-full overflow-hidden"
    >
      <ContextMenu onOpenChange={handleOpenChange}>
        <ContextMenuTrigger
          disabled={disabled || shiftBypass}
          className="h-full w-full block overflow-hidden select-text"
        >
          {children}
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 text-xs">
          {/* Back to Editing (Overleaf standard) */}
          <ContextMenuItem onClick={handleBackToEditing} className="gap-2 font-medium">
            <FileEdit className="size-3.5 text-foreground" />
            <span>Back to Editing</span>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Clipboard Group */}
          <ContextMenuItem onClick={handleCut} disabled={!hasSelection} className="gap-2">
            <Scissors className="size-3.5 text-foreground" />
            <span>Cut</span>
            <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleCopy} disabled={!hasSelection} className="gap-2">
            <Copy className="size-3.5 text-foreground" />
            <span>Copy</span>
            <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onClick={handlePaste} className="gap-2">
            <ClipboardPaste className="size-3.5 text-foreground" />
            <span>Paste</span>
            <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleDelete} disabled={!hasSelection} className="gap-2">
            <Trash2 className="size-3.5 text-foreground" />
            <span>Delete</span>
            <ContextMenuShortcut>Del</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* SyncTeX & Comments Group (Overleaf Parity) */}
          <ContextMenuItem onClick={handleJumpToPdf} className="gap-2">
            <ExternalLink className="size-3.5 text-foreground" />
            <span>Go to PDF location</span>
            <ContextMenuShortcut>Ctrl+Alt+J</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleAddReviewComment} className="gap-2">
            <MessageSquarePlus className="size-3.5 text-foreground" />
            <span>Add comment</span>
            <ContextMenuShortcut>Ctrl+Alt+M</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuItem onClick={handleToggleLineComment} className="gap-2">
            <MessageSquareCode className="size-3.5 text-foreground" />
            <span>Toggle comment</span>
            <ContextMenuShortcut>Ctrl+/</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Formatting Submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <Bold className="size-3.5 text-muted-foreground" />
              <span>Format</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48 text-xs">
              <ContextMenuItem onClick={() => handleFormat('bold')} className="gap-2">
                <Bold className="size-3.5" />
                <span>Bold (\textbf)</span>
                <ContextMenuShortcut>Ctrl+B</ContextMenuShortcut>
              </ContextMenuItem>

              <ContextMenuItem onClick={() => handleFormat('italic')} className="gap-2">
                <Italic className="size-3.5" />
                <span>Italic (\textit)</span>
                <ContextMenuShortcut>Ctrl+I</ContextMenuShortcut>
              </ContextMenuItem>

              <ContextMenuItem onClick={() => handleFormat('underline')} className="gap-2">
                <Underline className="size-3.5" />
                <span>Underline (\underline)</span>
                <ContextMenuShortcut>Ctrl+U</ContextMenuShortcut>
              </ContextMenuItem>

              <ContextMenuItem onClick={() => handleFormat('code')} className="gap-2">
                <Code2 className="size-3.5" />
                <span>Monospace (\texttt)</span>
              </ContextMenuItem>

              <ContextMenuItem onClick={() => handleFormat('inlineMath')} className="gap-2">
                <Pi className="size-3.5" />
                <span>Inline Math ($...$)</span>
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          {/* Insert Submenu */}
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <TableIcon className="size-3.5 text-muted-foreground" />
              <span>Insert</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48 text-xs">
              <ContextMenuItem
                onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'figure-wizard' })}
                className="gap-2"
              >
                <ImageIcon className="size-3.5" />
                <span>Figure / Image...</span>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' })}
                className="gap-2"
              >
                <TableIcon className="size-3.5" />
                <span>Table / Matrix...</span>
                <ContextMenuShortcut>Ctrl+Shift+T</ContextMenuShortcut>
              </ContextMenuItem>

              <ContextMenuItem
                onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' })}
                className="gap-2"
              >
                <BookMarked className="size-3.5" />
                <span>Citation...</span>
                <ContextMenuShortcut>Ctrl+Shift+K</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />

          {/* Selection Group */}
          <ContextMenuItem onClick={handleSelectAll} className="gap-2">
            <CheckSquare className="size-3.5 text-muted-foreground" />
            <span>Select All</span>
            <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Document Metrics Group */}
          <ContextMenuItem onClick={handleWordCount} className="gap-2 text-muted-foreground">
            <FileText className="size-3.5" />
            <span>Word Count (TeXcount)</span>
            <ContextMenuShortcut>Ctrl+Shift+W</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

export default EditorContextMenu;
