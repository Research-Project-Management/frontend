'use client';

import React from 'react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from "@/shared/components/ui";
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

export default function InsertMenu() {
  const { engine } = useEditorInstance();

  const insertSnippet = (snippet: string) => {
    engine?.insertText(snippet);
  };


  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm">
        Insert
      </MenubarTrigger>
      <MenubarContent className="min-w-48 text-xs z-[9999]">
        {/* Math > */}
        <MenubarSub>
          <MenubarSubTrigger>Math</MenubarSubTrigger>
          <MenubarSubContent className="text-xs min-w-40">
            <MenubarItem onClick={() => insertSnippet('$E = mc^2$')}>
              Inline math
            </MenubarItem>
            <MenubarItem onClick={() => insertSnippet('\\[\n  \\int_{a}^{b} f(x)\\,dx\n\\]\n')}>
              Display math
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* Symbol Palette */}
        <MenubarItem onClick={() => EditorEventBus.emit('flux:open-symbol-palette')}>
          Symbol (LaTeX Palette)
        </MenubarItem>

        {/* Figure Wizard */}
        <MenubarItem onClick={() => EditorEventBus.emit('flux:open-figure-wizard')}>
          Figure (Image Wizard)
        </MenubarItem>

        {/* Table Wizard */}
        <MenubarItem onClick={() => EditorEventBus.emit('flux:open-table-wizard')}>
          Table (Wizard & Excel Import)
        </MenubarItem>

        {/* Citation / Reference Search */}
        <MenubarItem onClick={() => EditorEventBus.emit('flux:open-citation-picker')} className="flex items-center justify-between gap-2">
          <span>Citation / Reference Search</span>
          <span className="text-10 font-mono text-muted-foreground">Ctrl+Shift+K</span>
        </MenubarItem>

        {/* Link */}
        <MenubarItem onClick={() => insertSnippet('\\href{https://example.com}{Link text}')}>
          Link
        </MenubarItem>

        {/* Cross reference */}
        <MenubarItem onClick={() => insertSnippet('\\ref{fig:figure}')}>
          Cross reference
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
