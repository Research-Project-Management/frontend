'use client';

import React from 'react';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarShortcut } from "@/shared/components/ui";
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';

export default function EditMenu() {
  const { engine } = useEditorInstance();

  const handleUndo = () => engine?.undo();
  const handleRedo = () => engine?.redo();
  const handleSelectAll = () => engine?.selectAll();
  const handleFind = () => engine?.openFind();

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm">
        Edit
      </MenubarTrigger>
      <MenubarContent className="min-w-44 text-xs z-[9999]">
        <MenubarItem onClick={handleUndo}>
          Undo
          <MenubarShortcut>Ctrl Z</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleRedo}>
          Redo
          <MenubarShortcut>Ctrl Y</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={handleFind}>
          Find
          <MenubarShortcut>Ctrl F</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleSelectAll}>
          Select all
          <MenubarShortcut>Ctrl A</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
