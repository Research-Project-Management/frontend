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
  Sigma,
  Image as ImageIcon,
  Link2,
  BookOpen,
  List,
  Search,
  Bookmark,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { SourceVisualSwitcher } from './SourceVisualSwitcher';
import { EditingModeDropdown } from '../shell/topbar/EditingModeDropdown';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { useContainerWidth } from './useContainerWidth';
import { cn } from '@/shared/lib/utils';
import { STYLE_OPTIONS, useEditorToolbarActions } from './useEditorToolbarActions';
import { EditorToolbarOverflowMenu, OmegaIcon } from './EditorToolbarOverflowMenu';
import { InsertTablePopover } from '@/features/editor/subsystems/authoring-wizards/ui/table-wizard/InsertTablePopover';

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
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkText, setLinkText] = React.useState('');
  const [crossRefLabels, setCrossRefLabels] = React.useState<string[]>([]);

  const handleLinkOpenChange = (open: boolean) => {
    if (open) {
      setLinkUrl('');
      setLinkText(actions.getSelectedText());
    }
    setLinkOpen(open);
  };

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    actions.handleInsertLink(linkUrl, linkText);
    setLinkOpen(false);
  };

  const effectiveWidth = containerWidth > 0 ? containerWidth : 600;
  const showMath = effectiveWidth >= 540;
  const showSymbol = effectiveWidth >= 570;
  const showLink = effectiveWidth >= 620;
  const showCrossRef = effectiveWidth >= 660;
  const showCitation = effectiveWidth >= 700;
  const showFigure = effectiveWidth >= 740;
  const showTable = effectiveWidth >= 780;
  const showLists = effectiveWidth >= 820;

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Editor formatting tools"
      className={cn(
        'h-9 min-h-[36px] px-1.5 flex items-center gap-0 border-b border-border bg-surface select-none shrink-0 overflow-x-auto overflow-y-hidden scrollbar-none w-full max-w-full',
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
        <TooltipContent side="bottom" sideOffset={6} className="text-xs">
          <span>Undo</span>
          <span className="ml-1.5 opacity-60">Ctrl+Z</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleRedo} className={iconButtonClass} aria-label="Redo">
            <RotateCw className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="text-xs">
          <span>Redo</span>
          <span className="ml-1.5 opacity-60">Ctrl+Y</span>
        </TooltipContent>
      </Tooltip>

      <ToolbarSeparator />

      {/* ── 2. Paragraph Style Dropdown ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            aria-label="Paragraph style"
            className="h-7 px-2 gap-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-border focus-visible:bg-muted shrink-0"
          >
            <span className="truncate max-w-[80px] text-12">{actions.currentStyle}</span>
            <ChevronDown className="size-3 opacity-60 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
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

      {/* ── 3. Text Formatting (Bold, Italic) ── */}
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInlineFormat('bold')} className={iconButtonClass} aria-label="Bold">
            <Bold className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="text-xs">
          <span>Bold</span>
          <span className="ml-1.5 opacity-60">Ctrl+B</span>
        </TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInlineFormat('italic')} className={iconButtonClass} aria-label="Italic">
            <Italic className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6} className="text-xs">
          <span>Italic</span>
          <span className="ml-1.5 opacity-60">Ctrl+I</span>
        </TooltipContent>
      </Tooltip>

      {(showMath || showSymbol) && <ToolbarSeparator />}

      {/* ── 4. Insert Elements: Math & Symbol ── */}
      {showMath && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertMath} className={iconButtonClass} aria-label="Math formula">
              <Sigma className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            <span>Math</span>
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
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            <span>Symbol</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showLink && <ToolbarSeparator />}

      {/* ── 5. Insert Objects (Dynamic container-based) ── */}
      {showLink && (
        <Popover open={linkOpen} onOpenChange={handleLinkOpenChange}>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" disabled={readOnly} className={iconButtonClass} aria-label="Insert link">
                  <Link2 className="size-3.5" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-xs">
              <span>Link</span>
              <span className="ml-1.5 opacity-60">Ctrl+K</span>
            </TooltipContent>
          </Tooltip>
          <PopoverContent align="start" className="w-72 p-3">
            <form onSubmit={handleLinkSubmit} className="space-y-2.5">
              <div className="space-y-1">
                <label htmlFor="toolbar-link-url" className="text-11 font-medium text-muted-foreground">
                  URL
                </label>
                <Input
                  id="toolbar-link-url"
                  type="text"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  autoFocus
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="toolbar-link-text" className="text-11 font-medium text-muted-foreground">
                  Display text
                </label>
                <Input
                  id="toolbar-link-text"
                  type="text"
                  placeholder="Link text (optional)"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={!linkUrl.trim()} className="h-7 px-3 text-xs">
                  Insert link
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      )}

      {showCrossRef && (
        <DropdownMenu onOpenChange={(open) => { if (open) setCrossRefLabels(actions.getDocumentLabels()); }}>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" disabled={readOnly} className={iconButtonClass} aria-label="Cross reference">
                  <Bookmark className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={6} className="text-xs">
              <span>Cross-reference</span>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-56 text-xs">
            {crossRefLabels.length > 0 ? (
              <div className="max-h-56 overflow-y-auto">
                {crossRefLabels.map((label) => (
                  <DropdownMenuItem
                    key={label}
                    onClick={() => actions.handleInsertCrossRef(label)}
                    className="text-xs font-mono cursor-pointer"
                  >
                    <span className="truncate">{label}</span>
                  </DropdownMenuItem>
                ))}
              </div>
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                No \label{'{}'} found in file
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => actions.handleInsertCrossRef()} className="text-xs cursor-pointer">
              Insert empty \ref{'{}'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {showCitation && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={actions.handleInsertCitation} className={iconButtonClass} aria-label="Cite reference">
              <BookOpen className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            <span>Citation</span>
            <span className="ml-1.5 opacity-60">Ctrl+Shift+K</span>
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
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            <span>Figure</span>
          </TooltipContent>
        </Tooltip>
      )}

      {showTable && (
        <InsertTablePopover disabled={readOnly} triggerClassName={iconButtonClass} />
      )}

      {showLists && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" disabled={readOnly} onClick={() => actions.handleInsertEnvironment('itemize')} className={iconButtonClass} aria-label="Bulleted list">
              <List className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            <span>List</span>
          </TooltipContent>
        </Tooltip>
      )}

      {/* ── 6. Overflow "More actions" Dropdown ── */}
      <EditorToolbarOverflowMenu
        readOnly={readOnly}
        showMath={showMath}
        showSymbol={showSymbol}
        showLink={showLink}
        showCrossRef={showCrossRef}
        showCitation={showCitation}
        showFigure={showFigure}
        showTable={showTable}
        showLists={showLists}
        onInlineFormat={actions.handleInlineFormat}
        onInsertMath={actions.handleInsertMath}
        onInsertSymbol={actions.handleInsertSymbol}
        onInsertLink={() => actions.handleInsertLink()}
        onAddComment={actions.handleAddComment}
        onInsertCrossRef={() => actions.handleInsertCrossRef()}
        onInsertCitation={actions.handleInsertCitation}
        onInsertFigure={actions.handleInsertFigure}
        onInsertTable={actions.handleInsertTable}
        onInsertEnvironment={actions.handleInsertEnvironment}
      />

      {/* ── 7. Right Side Group ── */}
      <div className="ml-auto flex items-center gap-1 shrink-0 pl-1">
        <SourceVisualSwitcher />
        <ToolbarSeparator />
        <EditingModeDropdown />
        <ToolbarSeparator />
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={actions.handleFind} className={iconButtonClass} aria-label="Search in file (Ctrl+F)">
              <Search className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6} className="text-xs">
            <span>Find &amp; replace</span>
            <span className="ml-1.5 opacity-60">Ctrl+F</span>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
