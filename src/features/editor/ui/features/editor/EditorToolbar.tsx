/**
 * EditorToolbar.tsx
 *
 * Scoped Format Toolbar for CodeMirror 6 Editor (Block 6: UI Features Layer).
 * Location: `features/editor/ui/features/editor/EditorToolbar.tsx`
 *
 * Follows Rule 1: Scoped strictly to the Editor Slot.
 * Dispatches LaTeX snippet insertions via `editorCommandBus`.
 */

'use client';

import React from 'react';
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Quote,
  Code,
  List,
  ListOrdered,
  BookOpen,
  Sigma,
  Table as TableIcon,
  ArrowRightToLine,
  MessageSquarePlus,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { editorCommandBus, getActiveEditorEngine } from '../../../coordinators/command-bus';
import { EditorEventBus } from '@/features/editor/domain/latex/latex-structure';
import { useSettingsStore } from '../../../store/settings.store';
import { useDocumentCollaborationStore } from '../../../store/collaboration.store';
import { useLayoutStore } from '../../../store/layout.store';
import { SourceVisualSwitcher } from './SourceVisualSwitcher';
import { cn } from '@/shared/lib/utils';

export interface EditorToolbarProps {
  className?: string;
  readOnly?: boolean;
}

interface ToolbarAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  snippet: { prefix: string; suffix: string };
  shortcut?: string;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { id: 'bold', label: 'Bold (\\textbf)', icon: Bold, snippet: { prefix: '\\textbf{', suffix: '}' }, shortcut: 'Mod-b' },
  { id: 'italic', label: 'Italic (\\textit)', icon: Italic, snippet: { prefix: '\\textit{', suffix: '}' }, shortcut: 'Mod-i' },
  { id: 'underline', label: 'Underline (\\underline)', icon: Underline, snippet: { prefix: '\\underline{', suffix: '}' }, shortcut: 'Mod-u' },
  { id: 'section', label: 'Section (\\section)', icon: Heading1, snippet: { prefix: '\\section{', suffix: '}' } },
  { id: 'subsection', label: 'Subsection (\\subsection)', icon: Heading2, snippet: { prefix: '\\subsection{', suffix: '}' } },
  { id: 'math', label: 'Inline Math ($...$)', icon: Sigma, snippet: { prefix: '$', suffix: '$' } },
  { id: 'table', label: 'Table / Matrix Wizard', icon: TableIcon, snippet: { prefix: '', suffix: '' }, shortcut: 'Mod-Shift-t' },
  { id: 'cite', label: 'Cite Reference (\\cite)', icon: BookOpen, snippet: { prefix: '\\cite{', suffix: '}' }, shortcut: 'Mod-Shift-k' },
  { id: 'quote', label: 'Quote Environment', icon: Quote, snippet: { prefix: '\\begin{quote}\n', suffix: '\n\\end{quote}' } },
  { id: 'code', label: 'Listing / Verbatim', icon: Code, snippet: { prefix: '\\begin{verbatim}\n', suffix: '\n\\end{verbatim}' } },
  { id: 'itemize', label: 'Bulleted List', icon: List, snippet: { prefix: '\\begin{itemize}\n  \\item ', suffix: '\n\\end{itemize}' } },
  { id: 'enumerate', label: 'Numbered List', icon: ListOrdered, snippet: { prefix: '\\begin{enumerate}\n  \\item ', suffix: '\n\\end{enumerate}' } },
];

export function EditorToolbar({ className, readOnly = false }: EditorToolbarProps) {
  const editorMode = useSettingsStore((s) => s.editorMode);

  const handleInsert = (action: ToolbarAction) => {
    if (readOnly) return;

    if (action.id === 'cite') {
      editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
      return;
    }

    if (action.id === 'table') {
      editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' });
      return;
    }

    if (editorMode === 'visual') {
      const visualMap: Record<string, { cmd: string; level?: 1 | 2 | 3 }> = {
        bold: { cmd: 'bold' },
        italic: { cmd: 'italic' },
        underline: { cmd: 'underline' },
        section: { cmd: 'heading', level: 1 },
        subsection: { cmd: 'heading', level: 2 },
        math: { cmd: 'insertMath' },
        quote: { cmd: 'quote' },
        code: { cmd: 'code' },
        itemize: { cmd: 'bulletList' },
        enumerate: { cmd: 'orderedList' },
      };

      const match = visualMap[action.id];
      if (match) {
        EditorEventBus.emit('flux:visual-command', { command: match.cmd, level: match.level });
        editorCommandBus.dispatch({
          type: 'editor:visual-command',
          command: match.cmd,
          level: match.level,
        });
        return;
      }
    }

    editorCommandBus.dispatch({
      type: 'editor:wrap-selection',
      prefix: action.snippet.prefix,
      suffix: action.snippet.suffix,
    });
  };

  const handleAddComment = React.useCallback(() => {
    if (readOnly) return;
    const engine = getActiveEditorEngine();
    const sel = engine?.getSelection?.();
    const cursor = engine?.getCursorPosition?.();

    const startLine = sel?.fromLine ?? cursor?.line ?? 1;
    const endLine = sel?.toLine ?? cursor?.line ?? 1;
    const selectedText = engine?.getSelectedText?.() || '';

    useDocumentCollaborationStore.getState().setPendingComment({
      startLine,
      endLine,
      selectedText,
    });
    useLayoutStore.getState().setActiveSidebarTab('review');
    useLayoutStore.getState().setSidebarLeftOpen(true);
  }, [readOnly]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+Alt+M or Cmd+Alt+M -> Add Comment / Open Review
      if (modKey && e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        handleAddComment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAddComment]);

  return (
    <div
      className={cn(
        'h-9 px-2 flex items-center gap-0.5 border-b border-border bg-surface select-none shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none',
        className
      )}
    >
      {TOOLBAR_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Tooltip key={action.id} delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                onClick={() => handleInsert(action)}
                className="size-7 p-0 text-text-muted hover:text-text-primary hover:bg-muted rounded cursor-pointer"
                aria-label={action.label}
              >
                <Icon className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>{action.label}</span>
              {action.shortcut && <span className="ml-1.5 opacity-60">({action.shortcut})</span>}
            </TooltipContent>
          </Tooltip>
        );
      })}

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={handleAddComment}
            className="size-7 p-0 text-text-muted hover:text-text-primary hover:bg-muted rounded cursor-pointer"
            aria-label="Add Comment (Ctrl+Alt+M)"
          >
            <MessageSquarePlus className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Add Comment</span>
          <span className="ml-1.5 opacity-60">(Mod-Alt-m)</span>
        </TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => {
              const engine = getActiveEditorEngine();
              const pos = engine?.getCursorPosition?.();
              editorCommandBus.dispatch({
                type: 'synctex:forward',
                line: pos?.line ?? 1,
                column: pos?.column ?? 1,
              });
            }}
            className="size-7 p-0 text-text-muted hover:text-text-primary hover:bg-muted rounded cursor-pointer"
            aria-label="View in PDF (SyncTeX)"
          >
            <ArrowRightToLine className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>View in PDF (SyncTeX)</span>
          <span className="ml-1.5 opacity-60">(Mod-Alt-j)</span>
        </TooltipContent>
      </Tooltip>

      {/* ── Right side: Source / Visual Switcher ── */}
      <div className="ml-auto flex items-center shrink-0 pl-2">
        <SourceVisualSwitcher />
      </div>
    </div>
  );
}

export default EditorToolbar;
