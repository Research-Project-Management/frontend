'use client';

/**
 * FormatMenu.tsx
 *
 * Overleaf-parity Topbar Format Menu (Block 7: UI Shell Layer):
 * - Bold (Ctrl B)
 * - Italics (Ctrl I)
 * --- Separator ---
 * - Bullet list
 * - Numbered list
 * - Increase indentation
 * - Decrease indentation
 * --- Separator ---
 * - Paragraph styles (Header label)
 * - Normal
 * - Section
 * - Subsection
 * - Subsubsection
 * - Paragraph
 * - Subparagraph
 * Location: `features/editor/ui/shell/topbar/FormatMenu.tsx`
 */

import React, { useMemo, useCallback } from 'react';
import { Bot } from 'lucide-react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarSeparator,
  MenubarShortcut,
} from '@/shared/components/ui/menubar';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import type { LatexFormatType } from '@/features/editor/domain/types/ports/editor-engine.port';

export function FormatMenu({ value = 'format' }: { value?: string } = {}) {
  const { engine } = useEditorInstance();
  const editorMode = useSettingsStore((s) => s.editorMode);

  // Platform-aware modifier label
  const isMac = useMemo(
    () => typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform),
    [],
  );
  const modLabel = isMac ? '⌘' : 'Ctrl ';

  const handleFormat = useCallback(
    (format: LatexFormatType) => {
      if (editorMode === 'visual') {
        editorCommandBus.dispatch({ type: 'editor:visual-command', command: format });
      } else {
        editorCommandBus.dispatch({ type: 'editor:format', format });
      }
      engine?.focus();
    },
    [editorMode, engine],
  );

  const handleList = useCallback(
    (env: 'itemize' | 'enumerate') => {
      if (editorMode === 'visual') {
        editorCommandBus.dispatch({
          type: 'editor:visual-command',
          command: env === 'itemize' ? 'bulletList' : 'orderedList',
        });
      } else if (engine) {
        const selected = engine.getSelectedText();
        if (selected) {
          const lines = selected.split('\n');
          const indented = lines.map((l: string) => `  \\item ${l}`).join('\n');
          engine.insertText(`\\begin{${env}}\n${indented}\n\\end{${env}}\n`);
        } else {
          engine.insertText(`\\begin{${env}}\n  \\item \n\\end{${env}}\n`);
        }
      }
      engine?.focus();
    },
    [editorMode, engine],
  );

  const handleIndent = useCallback(() => {
    engine?.indent();
    engine?.focus();
  }, [engine]);

  const handleOutdent = useCallback(() => {
    engine?.outdent();
    engine?.focus();
  }, [engine]);

  return (
    <MenubarMenu value={value}>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary select-none transition-colors">
        Format
      </MenubarTrigger>

      <MenubarContent
        align="start"
        className="w-72 min-w-[280px] p-1 rounded-md border border-border bg-popover text-popover-foreground shadow-raised-200 text-xs select-none"
      >
        {/* 1. Basic Inline Formatting */}
        <MenubarItem
          onClick={() => handleFormat('bold')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
        >
          <span className="whitespace-nowrap">Bold</span>
          <MenubarShortcut className="text-11 text-muted-foreground/80 font-mono tracking-tight ml-auto whitespace-nowrap shrink-0">
            {modLabel}B
          </MenubarShortcut>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('italic')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
        >
          <span className="whitespace-nowrap">Italics</span>
          <MenubarShortcut className="text-11 text-muted-foreground/80 font-mono tracking-tight ml-auto whitespace-nowrap shrink-0">
            {modLabel}I
          </MenubarShortcut>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('underline')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
        >
          <span className="whitespace-nowrap">Underline</span>
          <MenubarShortcut className="text-11 text-muted-foreground/80 font-mono tracking-tight ml-auto whitespace-nowrap shrink-0">
            {modLabel}U
          </MenubarShortcut>
        </MenubarItem>

        <MenubarSeparator />

        {/* 2. Lists & Indentation */}
        <MenubarItem
          onClick={() => handleList('itemize')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Bullet list</span>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleList('enumerate')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Numbered list</span>
        </MenubarItem>

        <MenubarItem
          onClick={handleIndent}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Increase indentation</span>
        </MenubarItem>

        <MenubarItem
          onClick={handleOutdent}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Decrease indentation</span>
        </MenubarItem>

        <MenubarSeparator />

        {/* 3. Paragraph styles Section */}
        <MenubarLabel className="px-2.5 pt-1.5 pb-1 text-11 font-medium text-muted-foreground/80 select-none pointer-events-none tracking-tight whitespace-nowrap">
          Paragraph styles
        </MenubarLabel>

        <MenubarItem
          onClick={() => handleFormat('normal')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Normal</span>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('section')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Section</span>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('subsection')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Subsection</span>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('subsubsection')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Subsubsection</span>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('paragraph')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Paragraph</span>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('subparagraph')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="whitespace-nowrap">Subparagraph</span>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem
          onClick={() => editorCommandBus.dispatch({ type: 'editor:autofix' })}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
        >
          <span className="flex items-center gap-2 whitespace-nowrap">
            <Bot className="size-3.5 text-foreground shrink-0" />
            <span>Format Document</span>
          </span>
          <MenubarShortcut className="text-11 text-muted-foreground/80 font-mono tracking-tight ml-auto whitespace-nowrap shrink-0">
            Alt Shift F
          </MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

export default FormatMenu;
