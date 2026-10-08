'use client';

/**
 * EditMenu.tsx
 *
 * Topbar Edit Dropdown Menu (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/edit/EditMenu.tsx`
 */

import React from 'react';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarShortcut } from "@/shared/components/ui";
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { Bot, ShieldCheck } from 'lucide-react';

export function EditMenu() {
  const { engine } = useEditorInstance();

  const handleUndo = () => editorCommandBus.dispatch({ type: 'editor:undo' });
  const handleRedo = () => editorCommandBus.dispatch({ type: 'editor:redo' });
  const handleSelectAll = () => engine?.selectAll();
  const handleFind = () => {
    editorCommandBus.dispatch({ type: 'editor:find', open: true });
    engine?.focus();
  };
  const handleAutoFix = () => editorCommandBus.dispatch({ type: 'editor:autofix' });
  const handleLintPage = () => editorCommandBus.dispatch({ type: 'editor:lint-project' });

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary select-none transition-colors">
        Edit
      </MenubarTrigger>
      <MenubarContent className="min-w-64 text-xs select-none">
        <MenubarItem onClick={handleUndo} className="cursor-pointer">
          <span className="whitespace-nowrap">Undo</span>
          <MenubarShortcut>Ctrl Z</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleRedo} className="cursor-pointer">
          <span className="whitespace-nowrap">Redo</span>
          <MenubarShortcut>Ctrl Y</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={handleFind} className="cursor-pointer">
          <span className="whitespace-nowrap">Find</span>
          <MenubarShortcut>Ctrl F</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleSelectAll} className="cursor-pointer">
          <span className="whitespace-nowrap">Select all</span>
          <MenubarShortcut>Ctrl A</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={handleAutoFix} className="cursor-pointer">
          <Bot className="size-3.5 mr-2 text-foreground shrink-0" />
          <span className="whitespace-nowrap">Auto-Fix Page Syntax</span>
          <MenubarShortcut>Alt Shift F</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleLintPage} className="cursor-pointer">
          <ShieldCheck className="size-3.5 mr-2 text-foreground shrink-0" />
          <span className="whitespace-nowrap">Check Page Syntax</span>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

export default EditMenu;
