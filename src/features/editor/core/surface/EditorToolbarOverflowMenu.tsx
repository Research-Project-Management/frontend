/**
 * EditorToolbarOverflowMenu.tsx
 *
 * Overflow "More actions" dropdown menu for EditorToolbar when the pane
 * width hides secondary formatting/insert controls.
 */

'use client';

import React from 'react';
import {
  Underline,
  Sigma,
  Omega,
  Table as TableIcon,
  Image as ImageIcon,
  Link2,
  BookOpen,
  List,
  ListOrdered,
  Quote,
  Code,
  MessageSquarePlus,
  Bookmark,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

export function OmegaIcon({ className }: { className?: string }) {
  return <Omega className={cn('size-3.5', className)} />;
}

export interface EditorToolbarOverflowMenuProps {
  readOnly: boolean;
  showMath: boolean;
  showSymbol: boolean;
  showCitation: boolean;
  showFigure: boolean;
  showTable: boolean;
  showLists: boolean;
  onInlineFormat: (format: 'underline') => void;
  onInsertMath: () => void;
  onInsertSymbol: () => void;
  onInsertLink: () => void;
  onAddComment: () => void;
  onInsertCrossRef: () => void;
  onInsertCitation: () => void;
  onInsertFigure: () => void;
  onInsertTable: () => void;
  onInsertEnvironment: (env: 'itemize' | 'enumerate' | 'quote' | 'code') => void;
}

export function EditorToolbarOverflowMenu({
  readOnly,
  showMath,
  showSymbol,
  showCitation,
  showFigure,
  showTable,
  showLists,
  onInlineFormat,
  onInsertMath,
  onInsertSymbol,
  onInsertLink,
  onAddComment,
  onInsertCrossRef,
  onInsertCitation,
  onInsertFigure,
  onInsertTable,
  onInsertEnvironment,
}: EditorToolbarOverflowMenuProps) {
  const hasHiddenMainItems =
    !showMath ||
    !showSymbol ||
    !showCitation ||
    !showFigure ||
    !showTable ||
    !showLists;

  return (
    <DropdownMenu>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              className="size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
              aria-label="More formatting options"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>More actions</span>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-56 text-xs z-50">
        {!showMath && (
          <DropdownMenuItem onClick={onInsertMath} className="flex items-center gap-2 cursor-pointer">
            <Sigma className="size-3.5 text-muted-foreground" />
            <span>Math formula</span>
          </DropdownMenuItem>
        )}
        {!showSymbol && (
          <DropdownMenuItem onClick={onInsertSymbol} className="flex items-center gap-2 cursor-pointer">
            <OmegaIcon />
            <span>Symbol</span>
          </DropdownMenuItem>
        )}
        {!showCitation && (
          <DropdownMenuItem onClick={onInsertCitation} className="flex items-center gap-2 cursor-pointer">
            <BookOpen className="size-3.5 text-muted-foreground" />
            <span>Cite reference</span>
            <span className="ml-auto text-11 text-muted-foreground">Ctrl+Shift+K</span>
          </DropdownMenuItem>
        )}
        {!showFigure && (
          <DropdownMenuItem onClick={onInsertFigure} className="flex items-center gap-2 cursor-pointer">
            <ImageIcon className="size-3.5 text-muted-foreground" />
            <span>Insert figure</span>
          </DropdownMenuItem>
        )}
        {!showTable && (
          <DropdownMenuItem onClick={onInsertTable} className="flex items-center gap-2 cursor-pointer">
            <TableIcon className="size-3.5 text-muted-foreground" />
            <span>Insert table</span>
          </DropdownMenuItem>
        )}
        {!showLists && (
          <>
            <DropdownMenuItem onClick={() => onInsertEnvironment('itemize')} className="flex items-center gap-2 cursor-pointer">
              <List className="size-3.5 text-muted-foreground" />
              <span>Bulleted list</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onInsertEnvironment('enumerate')} className="flex items-center gap-2 cursor-pointer">
              <ListOrdered className="size-3.5 text-muted-foreground" />
              <span>Numbered list</span>
            </DropdownMenuItem>
          </>
        )}

        {hasHiddenMainItems && <DropdownMenuSeparator />}

        <DropdownMenuItem onClick={onInsertLink} className="flex items-center gap-2 cursor-pointer">
          <Link2 className="size-3.5 text-muted-foreground" />
          <span>Insert link</span>
          <span className="ml-auto text-11 text-muted-foreground">Ctrl+K</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onInsertCrossRef} className="flex items-center gap-2 cursor-pointer">
          <Bookmark className="size-3.5 text-muted-foreground" />
          <span>Cross-reference</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onInlineFormat('underline')} className="flex items-center gap-2 cursor-pointer">
          <Underline className="size-3.5 text-muted-foreground" />
          <span>Underline</span>
          <span className="ml-auto text-11 text-muted-foreground">Ctrl+U</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onInsertEnvironment('quote')} className="flex items-center gap-2 cursor-pointer">
          <Quote className="size-3.5 text-muted-foreground" />
          <span>Quote</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onInsertEnvironment('code')} className="flex items-center gap-2 cursor-pointer">
          <Code className="size-3.5 text-muted-foreground" />
          <span>Code block</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddComment} className="flex items-center gap-2 cursor-pointer">
          <MessageSquarePlus className="size-3.5 text-muted-foreground" />
          <span>Add comment</span>
          <span className="ml-auto text-11 text-muted-foreground">Ctrl+Alt+M</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
