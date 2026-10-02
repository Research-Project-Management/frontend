'use client';

/**
 * FormatMenu.tsx
 *
 * Overleaf-parity Topbar Format Menu:
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
 */

import React, { useCallback, useMemo } from 'react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarSeparator,
  MenubarShortcut,
} from '@/shared/components/ui/menubar';
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { useSettingsStore } from '@/features/editor/store';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import type { LatexFormatType } from '@/features/editor/ports/editor-engine.port';

export default function FormatMenu() {
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
        EditorEventBus.emit('flux:visual-command', { command: format as any });
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
        EditorEventBus.emit('flux:visual-command', {
          command: env === 'itemize' ? ('bulletList' as any) : ('orderedList' as any),
        });
      } else if (engine) {
        const selected = engine.getSelectedText();
        if (selected) {
          const lines = selected.split('\n');
          const indented = lines.map((l) => `  \\item ${l}`).join('\n');
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
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm outline-none select-none transition-colors">
        Format
      </MenubarTrigger>

      <MenubarContent
        align="start"
        className="w-56 min-w-[210px] p-1.5 z-[9999] rounded-md border border-border bg-popover text-popover-foreground shadow-2xl text-xs select-none"
      >
        {/* 1. Basic Inline Formatting */}
        <MenubarItem
          onClick={() => handleFormat('bold')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
        >
          <span>Bold</span>
          <MenubarShortcut className="text-[11px] text-muted-foreground/80 font-mono tracking-tight ml-auto">
            {modLabel}B
          </MenubarShortcut>
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('italic')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
        >
          <span>Italics</span>
          <MenubarShortcut className="text-[11px] text-muted-foreground/80 font-mono tracking-tight ml-auto">
            {modLabel}I
          </MenubarShortcut>
        </MenubarItem>

        <MenubarSeparator className="my-1 h-px bg-border/70" />

        {/* 2. Lists & Indentation */}
        <MenubarItem
          onClick={() => handleList('itemize')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Bullet list
        </MenubarItem>

        <MenubarItem
          onClick={() => handleList('enumerate')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Numbered list
        </MenubarItem>

        <MenubarItem
          onClick={handleIndent}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Increase indentation
        </MenubarItem>

        <MenubarItem
          onClick={handleOutdent}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Decrease indentation
        </MenubarItem>

        <MenubarSeparator className="my-1 h-px bg-border/70" />

        {/* 3. Paragraph styles Section */}
        <MenubarLabel className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground/80 select-none pointer-events-none tracking-tight">
          Paragraph styles
        </MenubarLabel>

        <MenubarItem
          onClick={() => handleFormat('normal')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Normal
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('section')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Section
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('subsection')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Subsection
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('subsubsection')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Subsubsection
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('paragraph')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Paragraph
        </MenubarItem>

        <MenubarItem
          onClick={() => handleFormat('subparagraph')}
          className="px-2.5 py-1.5 cursor-pointer text-xs rounded-sm hover:bg-accent hover:text-accent-foreground"
        >
          Subparagraph
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
