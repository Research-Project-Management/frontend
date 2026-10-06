'use client';

import React from 'react';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarShortcut } from "@/shared/components/ui";
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { Sparkles, ShieldCheck } from 'lucide-react';

export default function EditMenu() {
  const { engine } = useEditorInstance();

  const handleUndo = () => engine?.undo();
  const handleRedo = () => engine?.redo();
  const handleSelectAll = () => engine?.selectAll();
  const handleFind = () => {
    editorCommandBus.dispatch({ type: 'editor:find', open: true });
    engine?.focus();
  };
  const handleAutoFix = () => EditorEventBus.emit('flux:autofix');
  const handleLintPage = () => EditorEventBus.emit('flux:lint-page');

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md">
        Edit
      </MenubarTrigger>
      <MenubarContent className="min-w-56 text-xs">
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
        <MenubarSeparator />
        <MenubarItem onClick={handleAutoFix} className="cursor-pointer">
          <Sparkles className="size-3.5 mr-2 text-foreground" />
          <span>Auto-Fix Page Syntax</span>
          <MenubarShortcut>Alt Shift F</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleLintPage} className="cursor-pointer">
          <ShieldCheck className="size-3.5 mr-2 text-foreground" />
          <span>Check Page Syntax</span>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
