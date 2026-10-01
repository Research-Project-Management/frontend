'use client';

/**
 * FormatToolbar.tsx
 *
 * Dedicated formatting toolbar for the Code Editor workspace:
 * - Mode Switcher: [ Source | Visual ]
 * - Core actions: AI Assistant, Undo, Redo, Find & Replace
 * - Text styling: Bold, Italic, Strikethrough, Code, Underline
 * - Headings & Alignment dropdowns
 * - Math formula insertions (Inline, Display, Equation)
 * - Table, Figure, and Citation wizard triggers
 */

import React, { useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Code as CodeIcon,
  BookOpen,
  ImagePlus,
  Table2,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui';
import { editorCommandBus } from '../../../core/command-bus/editor-command-bus';
import { EditorEventBus } from '../../../utils/editor.util';
import { convertLatexTableToHtml } from '../../../utils/latex-converter.util';
import { MathSymbolPalette } from '../../../components/editor/subcomponents/MathSymbolPalette';
import { InsertTableModal } from '../../../components/editor/subcomponents/InsertTableModal';
import { InsertImageModal } from '../../../components/editor/subcomponents/InsertImageModal';
import { useSettingsStore } from '../../../store';
import type { LatexFormatType } from '../../../ports/editor-engine.port';

interface ToolbarButtonProps {
  onClick: () => void;
  icon?: React.ElementType;
  label?: string;
  tooltip: string;
  kbd?: string;
  active?: boolean;
  className?: string;
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
            'flex size-7 items-center justify-center rounded-sm text-xs font-medium transition-colors cursor-pointer shrink-0 outline-none select-none',
            active
              ? 'bg-muted text-primary font-semibold'
              : 'text-foreground/80 hover:text-foreground hover:bg-muted active:scale-95',
            className,
          )}
        >
          {Icon && <Icon className="size-3.5 shrink-0" />}
          {label && <span className="truncate">{label}</span>}
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <div className="flex items-center gap-1.5">
          <span>{tooltip}</span>
          {kbd && (
            <kbd className="px-1 py-0.5 text-10 rounded bg-muted text-muted-foreground font-mono">
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

  return (
    <div className="h-9 px-1.5 flex items-center min-w-0 w-full select-none bg-background text-foreground overflow-hidden">
      <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
        {/* Text styling buttons */}
        <ToolbarButton
          onClick={() => handleFormat('bold')}
          icon={Bold}
          tooltip="Bold"
          kbd="Ctrl+B"
        />
        <ToolbarButton
          onClick={() => handleFormat('italic')}
          icon={Italic}
          tooltip="Italic"
          kbd="Ctrl+I"
        />
        <ToolbarButton
          onClick={() => handleFormat('code')}
          icon={CodeIcon}
          tooltip="Inline Code"
        />

        <div className="h-4 w-px bg-border/80 mx-1 shrink-0" />

        {/* Citations & References */}
        <ToolbarButton
          onClick={() => EditorEventBus.emit('flux:open-citation-picker')}
          icon={BookOpen}
          tooltip="Insert Citation"
          kbd="Ctrl+Shift+K"
        />

        {/* Insert Table */}
        <ToolbarButton
          onClick={() => setTableModalOpen(true)}
          icon={Table2}
          tooltip="Insert Table"
        />

        {/* Insert Image */}
        <ToolbarButton
          onClick={() => setImageModalOpen(true)}
          icon={ImagePlus}
          tooltip="Insert Figure"
        />

        {/* Math Symbol Palette */}
        <MathSymbolPalette onInsert={handleInsert} />
      </div>

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
