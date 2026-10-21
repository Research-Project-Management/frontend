'use client';

/**
 * HelpMenu.tsx
 *
 * Topbar Help Dropdown Menu (Overleaf Parity).
 * Location: `features/editor/core/shell/topbar/HelpMenu.tsx`
 */

import React from 'react';
import { HelpCircle, Keyboard, BookOpen, ExternalLink } from 'lucide-react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from '@/shared/components/ui/menubar';
import { editorCommandBus } from '@/features/editor/core';

export function HelpMenu({ value = 'help' }: { value?: string } = {}) {
  const handleOpenShortcuts = () => {
    editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'shortcuts' });
  };

  const handleOpenDocumentation = () => {
    window.open('https://www.overleaf.com/learn', '_blank', 'noopener,noreferrer');
  };

  const handleOpenLatexGuide = () => {
    window.open('https://www.overleaf.com/learn/latex/Free_online_introduction_to_LaTeX_(part_1)', '_blank', 'noopener,noreferrer');
  };

  return (
    <MenubarMenu value={value}>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-border select-none transition-colors">
        Help
      </MenubarTrigger>

      <MenubarContent className="min-w-56 text-xs select-none">
        <MenubarItem
          onClick={handleOpenShortcuts}
          className="cursor-pointer flex items-center gap-2"
        >
          <Keyboard className="size-3.5 text-foreground/80 shrink-0" />
          <span className="whitespace-nowrap flex-1">Keyboard shortcuts</span>
          <kbd className="text-[10px] font-mono text-muted-foreground">Ctrl /</kbd>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem
          onClick={handleOpenDocumentation}
          className="cursor-pointer flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <BookOpen className="size-3.5 text-foreground/80 shrink-0" />
            <span className="whitespace-nowrap">Documentation & Tutorials</span>
          </span>
          <ExternalLink className="size-3 text-muted-foreground shrink-0" />
        </MenubarItem>

        <MenubarItem
          onClick={handleOpenLatexGuide}
          className="cursor-pointer flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            <HelpCircle className="size-3.5 text-foreground/80 shrink-0" />
            <span className="whitespace-nowrap">LaTeX Quick Guide</span>
          </span>
          <ExternalLink className="size-3 text-muted-foreground shrink-0" />
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

export default HelpMenu;
