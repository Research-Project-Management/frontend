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
  ArrowRightToLine,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { editorCommandBus } from '../../../coordinators/command-bus';
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
  { id: 'cite', label: 'Cite Reference (\\cite)', icon: BookOpen, snippet: { prefix: '\\cite{', suffix: '}' }, shortcut: 'Mod-Shift-k' },
  { id: 'quote', label: 'Quote Environment', icon: Quote, snippet: { prefix: '\\begin{quote}\n', suffix: '\n\\end{quote}' } },
  { id: 'code', label: 'Listing / Verbatim', icon: Code, snippet: { prefix: '\\begin{verbatim}\n', suffix: '\n\\end{verbatim}' } },
  { id: 'itemize', label: 'Bulleted List', icon: List, snippet: { prefix: '\\begin{itemize}\n  \\item ', suffix: '\n\\end{itemize}' } },
  { id: 'enumerate', label: 'Numbered List', icon: ListOrdered, snippet: { prefix: '\\begin{enumerate}\n  \\item ', suffix: '\n\\end{enumerate}' } },
];

export function EditorToolbar({ className, readOnly = false }: EditorToolbarProps) {
  const handleInsert = (action: ToolbarAction) => {
    if (readOnly) return;

    if (action.id === 'cite') {
      editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
      return;
    }

    editorCommandBus.dispatch({
      type: 'editor:insert',
      text: `${action.snippet.prefix}${action.snippet.suffix}`,
    });
  };

  return (
    <div
      className={cn(
        'h-9 px-2 flex items-center gap-0.5 border-b border-border bg-surface select-none shrink-0 overflow-x-auto scrollbar-none',
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

      <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => editorCommandBus.dispatch({ type: 'synctex:forward' })}
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
    </div>
  );
}

export default EditorToolbar;
