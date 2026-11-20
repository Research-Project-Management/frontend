/**
 * EditorToolbar.tsx
 *
 * Scoped Format Toolbar for LaTeX Editor (Block 4: UI Features Layer).
 * Location: `features/editor/core/surface/EditorToolbar.tsx`
 *
 * Fully dynamic responsive toolbar based on actual container width:
 * As the user resizes the split pane between Editor and PDF Preview,
 * items dynamically collapse into the "•••" (More actions) menu so they never
 * overflow or push into the PDF preview split pane!
 */

'use client';

import React from 'react';
import {
  RotateCcw,
  RotateCw,
  ChevronDown,
  Bold,
  Italic,
  Underline,
  Sigma,
  Table as TableIcon,
  Image as ImageIcon,
  Link2,
  BookOpen,
  List,
  ListOrdered,
  Quote,
  Code,
  MessageSquarePlus,
  Search,
  Bookmark,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { SourceVisualSwitcher } from './SourceVisualSwitcher';
import { EditingModeDropdown } from '../shell/topbar/EditingModeDropdown';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/shared/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useContainerWidth } from './useContainerWidth';
import { cn } from '@/shared/lib/utils';
import { STYLE_OPTIONS, useEditorToolbarActions } from './useEditorToolbarActions';
import { EditorToolbarOverflowMenu, OmegaIcon } from './EditorToolbarOverflowMenu';

export interface EditorToolbarProps {
  className?: string;
  readOnly?: boolean;
}

function ToolbarSeparator({ className }: { className?: string }) {
  return <div className={cn('h-4 w-px bg-border/60 mx-1 shrink-0 select-none', className)} aria-hidden="true" />;
}

const iconButtonClass =
  'size-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:bg-muted shrink-0';

export function EditorToolbar({ className, readOnly = false }: EditorToolbarProps) {
  const [containerRef, containerWidth] = useContainerWidth<HTMLDivElement>();
  const actions = useEditorToolbarActions(readOnly);

  const effectiveWidth = containerWidth > 0 ? containerWidth : 600;
  const showUnderline = effectiveWidth >= 560;
  const showMath = effectiveWidth >= 600;
  const showSymbol = effectiveWidth >= 580;
  const showLink = effectiveWidth >= 680;
  const showCrossRef = effectiveWidth >= 730;
  const showCitation = effectiveWidth >= 780;
  const showFigure = effectiveWidth >= 830;
  const showTable = effectiveWidth >= 880;
  const showLists = effectiveWidth >= 940;
  const showCodeEnvs = effectiveWidth >= 1000;
  const showComment = effectiveWidth >= 580;

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Editor formatting tools"
      className={cn(
        'h-9 min-h-[36px] px-2 flex items-center gap-0.5 border-b border-border bg-surface select-none shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none w-full max-w-full',
        className,
      )}
    >
      {/* ── 1. History Group (Undo / Redo) ── */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleUndo} className={iconButtonClass} aria-label="Undo">
            <RotateCcw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Undo</span>
          <span className="ml-1.5 opacity-60">(Mod-z)</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleRedo} className={iconButtonClass} aria-label="Redo">
            <RotateCw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Redo</span>
          <span className="ml-1.5 opacity-60">(Mod-y)</span>
        </TooltipContent>
      </Tooltip>

      <ToolbarSeparator />

      {/* ── 2. Paragraph Style Dropdown ── */}
      <DropdownMenu>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={readOnly}
                className="h-7 px-2 gap-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
              >
                <span className="truncate max-w-[80px] text-12">{actions.currentStyle}</span>
                <ChevronDown className="size-3 opacity-60 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Paragraph style</span>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="start" className="w-36">
          {STYLE_OPTIONS.map((opt) => (
            <DropdownMenuItem
              key={opt.id}
              onClick={() => actions.handleSelectStyle(opt)}
              className="text-xs cursor-pointer"
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarSeparator />

      {/* ── 3. Text Formatting (Bold, Italic, Underline) ── */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInlineFormat('bold')} className={iconButtonClass} aria-label="Bold">
            <Bold className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Bold</span>
          <span className="ml-1.5 opacity-60">(Mod-b)</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInlineFormat('italic')} className={iconButtonClass} aria-label="Italic">
            <Italic className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <span>Italic</span>
          <span className="ml-1.5 opacity-60">(Mod-i)</span>
        </TooltipContent>
      </Tooltip>

      {showUnderline && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInlineFormat('underline')} className={iconButtonClass} aria-label="Underline">
              <Underline className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Underline</span>
            <span className="ml-1.5 opacity-60">(Mod-u)</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showMath && <ToolbarSeparator />}

      {/* ── 4. Insert Elements: Math & Symbol ── */}
      {showMath && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertMath} className={iconButtonClass} aria-label="Math formula">
              <Sigma className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Math formula</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showSymbol && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertSymbol} className={iconButtonClass} aria-label="Insert Symbol (Ω)">
              <OmegaIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Insert Symbol (Ω)</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showLink && <ToolbarSeparator />}

      {/* ── 5. Insert Objects (Dynamic container-based) ── */}
      {showLink && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertLink} className={iconButtonClass} aria-label="Insert link">
              <Link2 className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Insert link</span>
            <span className="ml-1.5 opacity-60">(Mod-k)</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showCrossRef && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertCrossRef} className={iconButtonClass} aria-label="Cross reference">
              <Bookmark className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Cross-reference</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showCitation && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertCitation} className={iconButtonClass} aria-label="Cite reference">
              <BookOpen className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Cite reference</span>
            <span className="ml-1.5 opacity-60">(Mod-Shift-k)</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showFigure && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertFigure} className={iconButtonClass} aria-label="Insert figure">
              <ImageIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Insert figure</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showTable && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertTable} className={iconButtonClass} aria-label="Insert table">
              <TableIcon className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Insert table</span>
            <span className="ml-1.5 opacity-60">(Mod-Shift-t)</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showLists && <ToolbarSeparator />}

      {/* ── 6. Lists & Environments ── */}
      {showLists && (
        <>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInsertEnvironment('itemize')} className={iconButtonClass} aria-label="Bulleted list">
                <List className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Bulleted list</span>
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInsertEnvironment('enumerate')} className={iconButtonClass} aria-label="Numbered list">
                <ListOrdered className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Numbered list</span>
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {showCodeEnvs && (
        <>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInsertEnvironment('quote')} className={iconButtonClass} aria-label="Quote environment">
                <Quote className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Quote environment</span>
            </TooltipContent>
          </Tooltip>

          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInsertEnvironment('code')} className={iconButtonClass} aria-label="Code block">
                <Code className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Code block</span>
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {/* ── 7. Overflow "More actions" Dropdown ── */}
      <EditorToolbarOverflowMenu
        readOnly={readOnly}
        showUnderline={showUnderline}
        showMath={showMath}
        showSymbol={showSymbol}
        showLink={showLink}
        showComment={showComment}
        showCrossRef={showCrossRef}
        showCitation={showCitation}
        showFigure={showFigure}
        showTable={showTable}
        showLists={showLists}
        showCodeEnvs={showCodeEnvs}
        onInlineFormat={actions.handleInlineFormat}
        onInsertMath={actions.handleInsertMath}
        onInsertSymbol={actions.handleInsertSymbol}
        onInsertLink={actions.handleInsertLink}
        onAddComment={actions.handleAddComment}
        onInsertCrossRef={actions.handleInsertCrossRef}
        onInsertCitation={actions.handleInsertCitation}
        onInsertFigure={actions.handleInsertFigure}
        onInsertTable={actions.handleInsertTable}
        onInsertEnvironment={actions.handleInsertEnvironment}
      />

      {/* ── 8. Right Side Group ── */}
      <div className="ml-auto flex items-center gap-1 shrink-0 pl-1">
        {showComment && (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleAddComment} className={iconButtonClass} aria-label="Add Comment">
                <MessageSquarePlus className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <span>Add Comment</span>
              <span className="ml-1.5 opacity-60">(Mod-Alt-m)</span>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={actions.handleFind} className={iconButtonClass} aria-label="Search in file (Ctrl+F)">
              <Search className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <span>Search in file</span>
            <span className="ml-1.5 opacity-60">(Mod-f)</span>
          </TooltipContent>
        </Tooltip>

        <ToolbarSeparator />
        <EditingModeDropdown />
        <ToolbarSeparator />
        <SourceVisualSwitcher />
      </div>
    </div>
  );
}
