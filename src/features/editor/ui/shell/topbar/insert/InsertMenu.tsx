'use client';

/**
 * InsertMenu.tsx
 *
 * Topbar Insert Dropdown Menu (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/insert/InsertMenu.tsx`
 */

import React from 'react';
import { AlignLeft, Tag, Heading } from 'lucide-react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarSeparator,
} from "@/shared/components/ui";
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { useSettingsStore } from '@/features/editor/store';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';

export function InsertMenu() {
  const { engine } = useEditorInstance();

  const insertSnippet = (snippet: string) => {
    engine?.insertText(snippet);
  };

  const handleInsertFigureUrl = () => {
    insertSnippet(
      '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{https://example.com/image.png}\n  \\caption{Figure caption}\n  \\label{fig:my_figure}\n\\end{figure}\n'
    );
  };

  const handleComment = () => {
    editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Review' });
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md">
        Insert
      </MenubarTrigger>

      <MenubarContent className="min-w-48 text-xs">
        {/* 1. Math > */}
        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            <span>Math</span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-36 text-xs">
            <MenubarItem
              onClick={() => insertSnippet('$E = mc^2$')}
              className="cursor-pointer"
            >
              Inline math
            </MenubarItem>
            <MenubarItem
              onClick={() => insertSnippet('\\[\n  \\int_{a}^{b} f(x)\\,dx\n\\]\n')}
              className="cursor-pointer"
            >
              Display math
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* 2. Symbol */}
        <MenubarItem
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'symbol-palette' })}
          className="cursor-pointer"
        >
          Symbol
        </MenubarItem>

        {/* 3. Figure > */}
        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            <span>Figure</span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-48 text-xs">
            <MenubarItem
              onClick={() => {
                useSettingsStore.getState().setActiveSidebarPanel('Files');
                editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'upload' } });
              }}
              className="cursor-pointer"
            >
              Upload from computer
            </MenubarItem>
            <MenubarItem
              onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'figure-wizard' })}
              className="cursor-pointer"
            >
              From project files
            </MenubarItem>
            <MenubarItem
              onClick={() => {
                useSettingsStore.getState().setActiveSidebarPanel('Files');
                editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'project' } });
              }}
              className="cursor-pointer"
            >
              From another project
            </MenubarItem>
            <MenubarItem
              onClick={handleInsertFigureUrl}
              className="cursor-pointer"
            >
              From URL
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* 4. Table */}
        <MenubarItem
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' })}
          className="cursor-pointer"
        >
          Table
        </MenubarItem>

        {/* 5. Citation */}
        <MenubarItem
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' })}
          className="cursor-pointer"
        >
          Citation
        </MenubarItem>

        {/* 6. Link */}
        <MenubarItem
          onClick={() => insertSnippet('\\href{https://example.com}{Link text}')}
          className="cursor-pointer"
        >
          Link
        </MenubarItem>

        {/* 7. Cross reference */}
        <MenubarItem
          onClick={() => insertSnippet('\\ref{fig:figure}')}
          className="cursor-pointer"
        >
          Cross reference
        </MenubarItem>

        {/* Divider */}
        <MenubarSeparator />

        {/* 8. Comment */}
        <MenubarItem
          onClick={handleComment}
          className="cursor-pointer"
        >
          Comment
        </MenubarItem>

        {/* Divider */}
        <MenubarSeparator />

        {/* 9. Abstract */}
        <MenubarItem
          onClick={() => insertSnippet('\\begin{abstract}\n  \n\\end{abstract}\n')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <AlignLeft className="size-3.5 text-foreground shrink-0" />
          <span>Abstract</span>
        </MenubarItem>

        {/* 10. Keywords */}
        <MenubarItem
          onClick={() => insertSnippet('\\begin{IEEEkeywords}\n  \n\\end{IEEEkeywords}\n')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Tag className="size-3.5 text-foreground shrink-0" />
          <span>Keywords</span>
        </MenubarItem>

        {/* 11. Title */}
        <MenubarItem
          onClick={() => insertSnippet('\\title{Document Title}\n')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Heading className="size-3.5 text-foreground shrink-0" />
          <span>Title</span>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

export default InsertMenu;
