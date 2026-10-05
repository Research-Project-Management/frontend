'use client';

/**
 * FormatToolbar.tsx
 *
 * Full Overleaf-parity Formatting Toolbar:
 * - AI Assistant (Bot)
 * - History: Undo (Ctrl+Z), Redo (Ctrl+Y)
 * - Headings dropdown: [TT ⌵] (Section, Subsection, Subsubsection, Paragraph)
 * - Text styling: Bold (Ctrl+B), Italic (Ctrl+I)
 * - Math tools: Formula dropdown [+ - * /], Symbol Palette [Ω]
 * - Insertions: Link [🔗], Comment [💬+], Label/Ref [🏷️], Citation [📖], Figure [🖼️], Table [▦]
 * - Lists dropdown: [:≡ ⌵] (Bullet List, Numbered List)
 * - Responsive 3-dots overflow dropdown: When sidebar/panels compress available toolbar width,
 *   overflowed features seamlessly collapse into a horizontal 3-dots menu with full parity.
 * Styled using project's theme design tokens (bg-primary, border-border, bg-popover).
 */

import React, { useState, useCallback, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import {
  ListOrdered,
  Upload,
  Folder,
  Globe,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import {
  OverleafBotIcon,
  OverleafUndoIcon,
  OverleafRedoIcon,
  OverleafHeadingsIcon,
  OverleafBoldIcon,
  OverleafItalicIcon,
  OverleafMathFormulaIcon,
  OverleafOmegaIcon,
  OverleafLinkIcon,
  OverleafCommentIcon,
  OverleafTagIcon,
  OverleafBookIcon,
  OverleafFigureIcon,
  OverleafTableIcon,
  OverleafListIcon,
  OverleafMoreHorizontalIcon,
} from './OverleafToolbarIcons';
import { toast } from 'sonner';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuShortcut,
} from '@/shared/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import { EditorEventBus } from '../../../utils/editor.util';
import { convertLatexTableToHtml } from '../../../utils/latex-converter.util';
import { useSettingsStore } from '../../../store';
import type { LatexFormatType } from '../../../ports/editor-engine.port';
import { MathSymbolPalette } from '@/features/editor/components/editor/subcomponents/MathSymbolPalette';
import { InsertTableModal } from '@/features/editor/components/editor/subcomponents/InsertTableModal';
import { InsertImageModal } from '@/features/editor/components/editor/subcomponents/InsertImageModal';

interface ToolbarButtonProps {
  onClick: () => void;
  icon?: React.ElementType;
  label?: string;
  tooltip: string;
  kbd?: string;
  active?: boolean;
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
}

const ToolbarButton = React.memo(function ToolbarButton({
  onClick,
  icon: Icon,
  label,
  tooltip,
  kbd,
  active,
  className,
  iconClassName,
  children,
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={tooltip}
          className={cn(
            'relative flex size-7 items-center justify-center rounded-md text-xs font-medium transition-colors cursor-pointer shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-primary select-none after:absolute after:-inset-1 after:content-[\'\']',
            active
              ? 'bg-muted text-foreground font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 motion-reduce:transform-none',
            className,
          )}
        >
          {Icon && <Icon className={cn('size-3.5 shrink-0', iconClassName)} />}
          {label && <span className="truncate">{label}</span>}
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="flex items-center gap-1.5">
          <span>{tooltip}</span>
          {kbd && (
            <kbd className="px-1 py-0.5 text-11 rounded-sm bg-muted text-muted-foreground font-mono">
              {kbd}
            </kbd>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

export const FormatToolbar = React.memo(function FormatToolbar() {
  const editorMode = useSettingsStore((s) => s.editorMode);

  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (containerRef.current && containerRef.current.clientWidth > 0) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        if (w > 0) {
          setContainerWidth(w);
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Responsive collapse tiers based on measured container width:
  // - level 0 (>= 540px): All 13 tools visible inline. No 3-dots button.
  // - level 1 (460 - 539px): Collapse Citation, Figure, Table, Lists into 3-dots.
  // - level 2 (380 - 459px): Collapse Link, Comment, Tag, Citation, Figure, Table, Lists.
  // - level 3 (300 - 379px): Collapse Math, Omega, Link, Comment, Tag, Citation, Figure, Table, Lists.
  // - level 4 (220 - 299px): Collapse Bold, Italic, Math, Omega, Link, Comment, Tag, Citation, Figure, Table, Lists.
  // - level 5 (< 220px): Collapse Headings, Bold, Italic, Math, Omega, Link, Comment, Tag, Citation, Figure, Table, Lists.
  const level = useMemo(() => {
    if (containerWidth === null) return 0;
    if (containerWidth >= 540) return 0;
    if (containerWidth >= 460) return 1;
    if (containerWidth >= 380) return 2;
    if (containerWidth >= 300) return 3;
    if (containerWidth >= 220) return 4;
    return 5;
  }, [containerWidth]);

  const handleFormat = useCallback(
    (format: LatexFormatType) => {
      if (editorMode === 'visual') {
        EditorEventBus.emit('flux:visual-command', { command: format as any });
      } else {
        editorCommandBus.dispatch({ type: 'editor:format', format });
      }
    },
    [editorMode],
  );

  const handleInsert = useCallback(
    (snippet: string) => {
      if (editorMode === 'visual') {
        const htmlTable = convertLatexTableToHtml(snippet);
        EditorEventBus.emit('flux:visual-command', {
          command: 'insertTable',
          contentHtml: htmlTable || `<p>${snippet}</p>`,
        });
        return;
      }
      editorCommandBus.dispatch({ type: 'editor:insert-text', text: snippet });
    },
    [editorMode],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const cleanName = file.name.replace(/\s+/g, '_');
      handleInsert(
        `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{figures/${cleanName}}\n  \\caption{Figure Caption}\n  \\label{fig:${cleanName.split('.')[0] || 'figure'}}\n\\end{figure}`,
      );
      toast.success(`Inserted figure for ${file.name}`);
      e.target.value = '';
    },
    [handleInsert],
  );

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="LaTeX formatting toolbar"
      className="h-9 px-1 flex items-center min-w-0 w-full select-none bg-transparent text-foreground overflow-hidden"
    >
      <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
        {/* 1. AI Assistant */}
        <ToolbarButton
          onClick={() => {
            editorCommandBus.dispatch({ type: 'sidebar:toggle-panel', panel: 'AI' });
            EditorEventBus.emit('flux:toggle-ai-panel');
          }}
          icon={OverleafBotIcon}
          iconClassName="size-4"
          tooltip="AI Assistant"
        />

        <div className="h-4 w-px bg-border/60 mx-1.5 shrink-0" />

        {/* 2. Undo / Redo */}
        <ToolbarButton
          onClick={() => editorCommandBus.dispatch({ type: 'editor:undo' })}
          icon={OverleafUndoIcon}
          iconClassName="size-3.5"
          tooltip="Undo"
          kbd="Ctrl+Z"
        />
        <ToolbarButton
          onClick={() => editorCommandBus.dispatch({ type: 'editor:redo' })}
          icon={OverleafRedoIcon}
          iconClassName="size-3.5"
          tooltip="Redo"
          kbd="Ctrl+Y"
        />

        {level < 5 && <div className="h-4 w-px bg-border/60 mx-1.5 shrink-0" />}

        {/* 3. Headings Dropdown [TT ⌵] (visible if level < 5) */}
        {level < 5 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-7 px-1.5 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none data-[state=open]:bg-muted data-[state=open]:text-foreground"
                    aria-label="Headings"
                  >
                    <OverleafHeadingsIcon className="h-3.5 w-auto shrink-0" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Headings</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="w-48 min-w-[170px] p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 select-none"
            >
              <DropdownMenuItem
                onClick={() => handleFormat('normal')}
                className="px-2.5 py-1.5 cursor-pointer text-xs font-normal text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors"
              >
                Normal text
              </DropdownMenuItem>

              <DropdownMenuSeparator className="-mx-1 my-1 bg-border/60" />

              <DropdownMenuItem
                onClick={() => handleFormat('section')}
                className="px-2.5 py-1.5 cursor-pointer text-14 font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-tight"
              >
                Section
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleFormat('subsection')}
                className="px-2.5 py-1.5 cursor-pointer text-13 font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-tight"
              >
                Subsection
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleFormat('subsubsection')}
                className="px-2.5 py-1.5 cursor-pointer text-12 font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-tight"
              >
                Subsubsection
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleFormat('paragraph')}
                className="px-2.5 py-1.5 cursor-pointer text-12 font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-normal"
              >
                Paragraph
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleFormat('subparagraph')}
                className="px-2.5 py-1.5 cursor-pointer text-12 font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-normal"
              >
                Subparagraph
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {level < 4 && <div className="h-4 w-px bg-border/60 mx-1.5 shrink-0" />}

        {/* 4. Text styling buttons: Bold, Italic (visible if level < 4) */}
        {level < 4 && (
          <>
            <ToolbarButton
              onClick={() => handleFormat('bold')}
              icon={OverleafBoldIcon}
              iconClassName="size-3.5"
              tooltip="Bold"
              kbd="Ctrl+B"
            />
            <ToolbarButton
              onClick={() => handleFormat('italic')}
              icon={OverleafItalicIcon}
              iconClassName="size-3.5"
              tooltip="Italic"
              kbd="Ctrl+I"
            />
          </>
        )}

        {level < 3 && <div className="h-4 w-px bg-border/60 mx-1.5 shrink-0" />}

        {/* 5. Math Formula insertion [+ - * /] (visible if level < 3) */}
        {level < 3 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none data-[state=open]:bg-muted data-[state=open]:text-foreground"
                    aria-label="Insert Math Formula"
                  >
                    <OverleafMathFormulaIcon className="size-4 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Insert Math Formula</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-48 p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-xl">
              <DropdownMenuItem onClick={() => handleFormat('inlineMath')} className="cursor-pointer text-xs py-1.5">
                Inline Math ($...$)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('displayMath')} className="cursor-pointer text-xs py-1.5">
                Display Math ($$...$$)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFormat('equation')} className="cursor-pointer text-xs py-1.5">
                Equation Environment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 6. Math Symbol Palette [Ω] (visible if level < 3) */}
        {level < 3 && <MathSymbolPalette onInsert={handleInsert} />}

        {level < 2 && <div className="h-4 w-px bg-border/60 mx-1.5 shrink-0" />}

        {/* 7. Link [🔗] (visible if level < 2) */}
        {level < 2 && (
          <ToolbarButton
            onClick={() => editorCommandBus.dispatch({
              type: 'editor:wrap-selection',
              prefix: '\\href{https://}{',
              suffix: '}',
              placeholder: 'link text',
            })}
            icon={OverleafLinkIcon}
            iconClassName="size-4"
            tooltip="Insert Link"
            kbd="Ctrl+K"
          />
        )}

        {/* 8. Add Comment [💬+] (visible if level < 2) */}
        {level < 2 && (
          <ToolbarButton
            onClick={() => {
              editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
              EditorEventBus.emit('flux:open-panel', 'Review');
            }}
            icon={OverleafCommentIcon}
            iconClassName="size-3.5"
            tooltip="Add Comment / Review"
            kbd="Ctrl+Alt+M"
          />
        )}

        {/* 9. Label / Reference [🏷️] (visible if level < 2) */}
        {level < 2 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none data-[state=open]:bg-muted data-[state=open]:text-foreground"
                    aria-label="Insert Label or Reference"
                  >
                    <OverleafTagIcon className="size-3.5 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Insert Label / Reference</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-40 p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-xl">
              <DropdownMenuItem
                onClick={() => editorCommandBus.dispatch({
                  type: 'editor:wrap-selection',
                  prefix: '\\label{',
                  suffix: '}',
                  placeholder: 'sec:label_name',
                })}
                className="cursor-pointer text-xs py-1.5"
              >
                Insert \label
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => editorCommandBus.dispatch({
                  type: 'editor:wrap-selection',
                  prefix: '\\ref{',
                  suffix: '}',
                  placeholder: 'sec:label_name',
                })}
                className="cursor-pointer text-xs py-1.5"
              >
                Insert \ref
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 10. Citation [📖] (visible if level < 1) */}
        {level < 1 && (
          <ToolbarButton
            onClick={() => handleFormat('cite')}
            icon={OverleafBookIcon}
            iconClassName="size-3.5"
            tooltip="Insert Citation"
            kbd="Ctrl+Shift+K"
          />
        )}

        {/* 11. Insert Figure [🖼️] (visible if level < 1) */}
        {level < 1 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none data-[state=open]:bg-muted data-[state=open]:text-foreground"
                    aria-label="Insert Figure"
                  >
                    <OverleafFigureIcon className="size-4 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Insert Figure</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="w-56 p-1.5 z-[9999] rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-200"
            >
              <DropdownMenuItem
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-3 transition-colors outline-none"
              >
                <Upload className="size-4 text-muted-foreground shrink-0" />
                <span>Upload from computer</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setImageModalOpen(true)}
                className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-3 transition-colors outline-none"
              >
                <ImageIcon className="size-4 text-muted-foreground shrink-0" />
                <span>From project files</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setImageModalOpen(true)}
                className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-3 transition-colors outline-none"
              >
                <Folder className="size-4 text-muted-foreground shrink-0" />
                <span>From another project</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const url = window.prompt('Enter image URL:');
                  if (url) {
                    handleInsert(
                      `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${url}}\n  \\caption{Figure Caption}\n  \\label{fig:my_figure}\n\\end{figure}`,
                    );
                  }
                }}
                className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-3 transition-colors outline-none"
              >
                <Globe className="size-4 text-muted-foreground shrink-0" />
                <span>From URL</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 12. Insert Table [▦] (visible if level < 1) */}
        {level < 1 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none data-[state=open]:bg-muted data-[state=open]:text-foreground"
                    aria-label="Insert Table"
                  >
                    <OverleafTableIcon className="size-3.5 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Insert Table</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="w-52 p-1.5 z-[9999] rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-200"
            >
              <div className="px-2.5 py-1 text-xs font-semibold text-muted-foreground select-none">
                Insert table
              </div>
              <DropdownMenuItem
                onClick={() => {
                  editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'AI' });
                  EditorEventBus.emit('flux:open-panel', 'AI');
                  toast.info('Ask AI to generate a table from text or image');
                }}
                className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-2.5 transition-colors outline-none"
              >
                <Sparkles className="size-4 text-ai shrink-0" />
                <span>From text or image</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                onClick={() => setTableModalOpen(true)}
                className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground transition-colors outline-none"
              >
                <span>Select size</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {level < 1 && <div className="h-4 w-px bg-border/60 mx-1.5 shrink-0" />}

        {/* 13. Lists Dropdown [:≡] (visible if level < 1) */}
        {level < 1 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none data-[state=open]:bg-muted data-[state=open]:text-foreground"
                    aria-label="Lists"
                  >
                    <OverleafListIcon className="size-3.5 shrink-0" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Lists</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="start"
              sideOffset={4}
              className="flex items-center gap-1.5 p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 min-w-0"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleFormat('itemize')}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none"
                    aria-label="Bullet list"
                  >
                    <OverleafListIcon className="size-3.5 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Bullet list</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleFormat('enumerate')}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none"
                    aria-label="Numbered list"
                  >
                    <ListOrdered className="size-4 shrink-0" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Numbered list</TooltipContent>
              </Tooltip>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* 14. Responsive Overflow: Horizontal 3-dots [...] with pure Overleaf icon tools (no text lines) */}
        {level > 0 && (
          <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
            <Tooltip open={overflowOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none data-[state=open]:bg-muted data-[state=open]:text-foreground shrink-0"
                    aria-label="More actions"
                  >
                    <OverleafMoreHorizontalIcon className="size-4 shrink-0" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                More actions
              </TooltipContent>
            </Tooltip>
            <PopoverContent
              align="start"
              sideOffset={4}
              className="flex items-center gap-0.5 p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 select-none min-w-0 w-auto"
            >
              {/* Headings (if collapsed at level >= 5) */}
              {level >= 5 && (
                <>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-7 px-1.5 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none"
                            aria-label="Headings"
                          >
                            <OverleafHeadingsIcon className="h-3.5 w-auto shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Headings</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={4}
                      className="w-48 min-w-[170px] p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 select-none"
                    >
                      <DropdownMenuItem
                        onClick={() => { handleFormat('normal'); setOverflowOpen(false); }}
                        className="px-2.5 py-1.5 cursor-pointer text-xs font-normal text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors"
                      >
                        Normal text
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="-mx-1 my-1 bg-border/60" />
                      <DropdownMenuItem
                        onClick={() => { handleFormat('section'); setOverflowOpen(false); }}
                        className="px-2.5 py-1.5 cursor-pointer text-14 font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-tight"
                      >
                        Section
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { handleFormat('subsection'); setOverflowOpen(false); }}
                        className="px-2.5 py-1.5 cursor-pointer text-13 font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-tight"
                      >
                        Subsection
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { handleFormat('subsubsection'); setOverflowOpen(false); }}
                        className="px-2.5 py-1.5 cursor-pointer text-12 font-semibold text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-tight"
                      >
                        Subsubsection
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { handleFormat('paragraph'); setOverflowOpen(false); }}
                        className="px-2.5 py-1.5 cursor-pointer text-12 font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-normal"
                      >
                        Paragraph
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { handleFormat('subparagraph'); setOverflowOpen(false); }}
                        className="px-2.5 py-1.5 cursor-pointer text-12 font-medium text-foreground hover:bg-accent hover:text-accent-foreground rounded-sm outline-none transition-colors leading-normal"
                      >
                        Subparagraph
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />
                </>
              )}

              {/* Bold, Italic (if collapsed at level >= 4) */}
              {level >= 4 && (
                <>
                  <ToolbarButton
                    onClick={() => { handleFormat('bold'); setOverflowOpen(false); }}
                    icon={OverleafBoldIcon}
                    iconClassName="size-3.5"
                    tooltip="Bold"
                    kbd="Ctrl+B"
                  />
                  <ToolbarButton
                    onClick={() => { handleFormat('italic'); setOverflowOpen(false); }}
                    icon={OverleafItalicIcon}
                    iconClassName="size-3.5"
                    tooltip="Italic"
                    kbd="Ctrl+I"
                  />
                  <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />
                </>
              )}

              {/* Math Tools (if collapsed at level >= 3) */}
              {level >= 3 && (
                <>
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none"
                            aria-label="Insert Math Formula"
                          >
                            <OverleafMathFormulaIcon className="size-4 shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Insert Math Formula</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={4}
                      className="w-48 p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-xl"
                    >
                      <DropdownMenuItem
                        onClick={() => { handleFormat('inlineMath'); setOverflowOpen(false); }}
                        className="cursor-pointer text-xs py-1.5"
                      >
                        Inline Math ($...$)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { handleFormat('displayMath'); setOverflowOpen(false); }}
                        className="cursor-pointer text-xs py-1.5"
                      >
                        Display Math ($$...$$)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => { handleFormat('equation'); setOverflowOpen(false); }}
                        className="cursor-pointer text-xs py-1.5"
                      >
                        Equation Environment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ToolbarButton
                    onClick={() => {
                      EditorEventBus.emit('flux:open-symbol-palette');
                      setOverflowOpen(false);
                    }}
                    icon={OverleafOmegaIcon}
                    iconClassName="size-3.5"
                    tooltip="Math Symbol Palette"
                  />
                  <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />
                </>
              )}

              {/* Link, Comment, Label/Ref (if collapsed at level >= 2) */}
              {level >= 2 && (
                <>
                  <ToolbarButton
                    onClick={() => {
                      editorCommandBus.dispatch({
                        type: 'editor:wrap-selection',
                        prefix: '\\href{https://}{',
                        suffix: '}',
                        placeholder: 'link text',
                      });
                      setOverflowOpen(false);
                    }}
                    icon={OverleafLinkIcon}
                    iconClassName="size-3.5"
                    tooltip="Insert Link"
                    kbd="Ctrl+K"
                  />
                  <ToolbarButton
                    onClick={() => {
                      editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
                      EditorEventBus.emit('flux:open-panel', 'Review');
                      setOverflowOpen(false);
                    }}
                    icon={OverleafCommentIcon}
                    iconClassName="size-3.5"
                    tooltip="Add Comment / Review"
                    kbd="Ctrl+Alt+M"
                  />
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none"
                            aria-label="Insert Label or Ref"
                          >
                            <OverleafTagIcon className="size-3.5 shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Insert Label / Ref</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={4}
                      className="w-40 p-1 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-xl"
                    >
                      <DropdownMenuItem
                        onClick={() => {
                          editorCommandBus.dispatch({
                            type: 'editor:wrap-selection',
                            prefix: '\\label{',
                            suffix: '}',
                            placeholder: 'sec:label_name',
                          });
                          setOverflowOpen(false);
                        }}
                        className="cursor-pointer text-xs py-1.5"
                      >
                        Insert \label
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          editorCommandBus.dispatch({
                            type: 'editor:wrap-selection',
                            prefix: '\\ref{',
                            suffix: '}',
                            placeholder: 'sec:label_name',
                          });
                          setOverflowOpen(false);
                        }}
                        className="cursor-pointer text-xs py-1.5"
                      >
                        Insert \ref
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="h-4 w-px bg-border/60 mx-1 shrink-0" />
                </>
              )}

              {/* Citation, Figure, Table, Lists (always in 3-dots when level >= 1) */}
              {level >= 1 && (
                <>
                  <ToolbarButton
                    onClick={() => {
                      handleFormat('cite');
                      setOverflowOpen(false);
                    }}
                    icon={OverleafBookIcon}
                    iconClassName="size-3.5"
                    tooltip="Insert Citation"
                    kbd="Ctrl+Shift+K"
                  />

                  {/* Figure */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none"
                            aria-label="Insert Figure"
                          >
                            <OverleafFigureIcon className="size-3.5 shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Insert Figure</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={4}
                      className="w-56 p-1.5 z-[9999] rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-200"
                    >
                      <DropdownMenuItem
                        onClick={() => {
                          fileInputRef.current?.click();
                          setOverflowOpen(false);
                        }}
                        className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-3 transition-colors outline-none"
                      >
                        <Upload className="size-4 text-muted-foreground shrink-0" />
                        <span>Upload from computer</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setImageModalOpen(true);
                          setOverflowOpen(false);
                        }}
                        className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-3 transition-colors outline-none"
                      >
                        <ImageIcon className="size-4 text-muted-foreground shrink-0" />
                        <span>From project files</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setImageModalOpen(true);
                          setOverflowOpen(false);
                        }}
                        className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-3 transition-colors outline-none"
                      >
                        <Folder className="size-4 text-muted-foreground shrink-0" />
                        <span>From another project</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const url = window.prompt('Enter image URL:');
                          if (url) {
                            handleInsert(
                              `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${url}}\n  \\caption{Figure Caption}\n  \\label{fig:my_figure}\n\\end{figure}`,
                            );
                          }
                          setOverflowOpen(false);
                        }}
                        className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-3 transition-colors outline-none"
                      >
                        <Globe className="size-4 text-muted-foreground shrink-0" />
                        <span>From URL</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Table */}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex size-7 items-center justify-center rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary select-none"
                            aria-label="Insert Table"
                          >
                            <OverleafTableIcon className="size-3.5 shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Insert Table</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={4}
                      className="w-52 p-1.5 z-[9999] rounded-lg border border-border bg-popover text-popover-foreground shadow-raised-200"
                    >
                      <div className="px-2.5 py-1 text-xs font-semibold text-muted-foreground select-none">
                        Insert table
                      </div>
                      <DropdownMenuItem
                        onClick={() => {
                          editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'AI' });
                          EditorEventBus.emit('flux:open-panel', 'AI');
                          toast.info('Ask AI to generate a table from text or image');
                          setOverflowOpen(false);
                        }}
                        className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground flex items-center gap-2.5 transition-colors outline-none"
                      >
                        <Sparkles className="size-4 text-ai shrink-0" />
                        <span>From text or image</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1" />
                      <DropdownMenuItem
                        onClick={() => {
                          setTableModalOpen(true);
                          setOverflowOpen(false);
                        }}
                        className="cursor-pointer text-xs py-2 px-2.5 rounded-md hover:bg-muted hover:text-foreground transition-colors outline-none"
                      >
                        <span>Select size</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Lists */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          handleFormat('itemize');
                          setOverflowOpen(false);
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        aria-label="Bullet list"
                      >
                        <OverleafListIcon className="size-3.5 shrink-0" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Bullet list</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          handleFormat('enumerate');
                          setOverflowOpen(false);
                        }}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                        aria-label="Numbered list"
                      >
                        <ListOrdered className="size-4 shrink-0" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">Numbered list</TooltipContent>
                  </Tooltip>
                </>
              )}
            </PopoverContent>
          </Popover>
        )}
      </div>

      <input
        id="format-toolbar-image-upload"
        name="imageUpload"
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      <InsertTableModal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onInsert={handleInsert}
      />
      <InsertImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onInsert={handleInsert}
      />
    </div>
  );
});
