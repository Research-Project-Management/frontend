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
  Bot,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Strikethrough,
  Code as CodeIcon,
  BookOpen,
  ImagePlus,
  Table2,
  List,
  ListOrdered,
  Quote,
  Search,
  ChevronDown,
  Sigma,
  RemoveFormatting,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { useEditorInstance } from '../../../core/context/editor-instance.context';
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
  const setEditorMode = useSettingsStore((s) => s.setEditorMode);
  const { engine } = useEditorInstance();

  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  const handleSwitchMode = useCallback(
    (mode: 'code' | 'visual') => {
      if (editorMode === mode) return;
      setEditorMode(mode);
      toast.info(
        mode === 'visual'
          ? 'Switched to Visual (Rich Text) mode'
          : 'Switched to Source (Code) mode',
        { duration: 1500 },
      );
    },
    [editorMode, setEditorMode],
  );

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

  const handleVisualCommand = useCallback(
    (command: any, level?: 1 | 2 | 3) => {
      EditorEventBus.emit('flux:visual-command', { command, level });
    },
    [],
  );

  const handleUndo = useCallback(() => {
    if (editorMode === 'visual') {
      handleVisualCommand('undo');
    } else {
      editorCommandBus.dispatch({ type: 'editor:undo' });
    }
  }, [editorMode, handleVisualCommand]);

  const handleRedo = useCallback(() => {
    if (editorMode === 'visual') {
      handleVisualCommand('redo');
    } else {
      editorCommandBus.dispatch({ type: 'editor:redo' });
    }
  }, [editorMode, handleVisualCommand]);

  const handleFind = useCallback(() => {
    if (editorMode === 'code') {
      engine?.openFind();
    } else {
      EditorEventBus.emit('flux:open-panel', 'Search');
    }
  }, [editorMode, engine]);

  const handleOpenAi = useCallback(() => {
    const selectedText = (editorMode === 'code' ? engine?.getSelectedText() : undefined) || undefined;
    EditorEventBus.emit('flux:open-ai-panel', { selectedText });
  }, [editorMode, engine]);

  return (
    <div className="h-9 px-1.5 flex items-center min-w-0 w-full select-none bg-background text-foreground overflow-hidden">
      <div className="flex items-center gap-0.5 min-w-0 overflow-hidden">
        {/* Source vs Visual Switcher */}
        <div className="inline-flex items-center rounded-md bg-muted p-0.5 border border-border select-none shrink-0 shadow-2xs mr-0.5">
          <button
            type="button"
            onClick={() => handleSwitchMode('code')}
            className={cn(
              'px-2 py-0.5 rounded-sm text-xs font-medium transition-all duration-150 cursor-pointer select-none leading-none',
              editorMode === 'code'
                ? 'bg-background text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="Switch to LaTeX Source Editor (Ctrl+Shift+V)"
          >
            Source
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('visual')}
            className={cn(
              'px-2 py-0.5 rounded-sm text-xs font-medium transition-all duration-150 cursor-pointer select-none leading-none',
              editorMode === 'visual'
                ? 'bg-background text-foreground font-semibold shadow-2xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
            title="Switch to Visual Rich-Text Editor (Ctrl+Shift+V)"
          >
            Visual
          </button>
        </div>

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

        {/* AI Assistant */}
        <ToolbarButton
          onClick={handleOpenAi}
          icon={Bot}
          tooltip="AI Research Assistant (LaTeX Copilot)"
        />

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

        {/* Undo & Redo */}
        <ToolbarButton onClick={handleUndo} icon={Undo2} tooltip="Undo" kbd="Ctrl+Z" />
        <ToolbarButton onClick={handleRedo} icon={Redo2} tooltip="Redo" kbd="Ctrl+Y" />

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

        {/* Find & Replace */}
        <ToolbarButton onClick={handleFind} icon={Search} tooltip="Find and Replace" kbd="Ctrl+F" />

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

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
          onClick={() => handleFormat('strikethrough')}
          icon={Strikethrough}
          tooltip="Strikethrough"
        />
        <ToolbarButton
          onClick={() => handleFormat('code')}
          icon={CodeIcon}
          tooltip="Inline Code"
        />

        <div className="h-4 w-px bg-border/80 mx-0.5 shrink-0" />

        {/* Citations & References */}
        <ToolbarButton
          onClick={() => EditorEventBus.emit('flux:open-citation-picker')}
          icon={BookOpen}
          tooltip="Insert Citation (\\cite)"
          kbd="Ctrl+Shift+C"
        />

        {/* Insert Table */}
        <ToolbarButton
          onClick={() => setTableModalOpen(true)}
          icon={Table2}
          tooltip="Insert LaTeX Table"
        />

        {/* Insert Image */}
        <ToolbarButton
          onClick={() => setImageModalOpen(true)}
          icon={ImagePlus}
          tooltip="Insert Figure / Image"
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
