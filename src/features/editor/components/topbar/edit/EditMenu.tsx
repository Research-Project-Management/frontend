'use client';

import React from 'react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from '@/shared/components/ui';
import { usePageStore } from '@/features/editor/store/page.store';

export default function EditMenu() {
  const { editorRef } = usePageStore();
  const editor = () => editorRef.current;

  const handleUndo = () => editor()?.trigger('menu', 'undo', null);
  const handleRedo = () => editor()?.trigger('menu', 'redo', null);
  const handleSelectAll = () =>
    editor()?.setSelection(editor()!.getModel()!.getFullModelRange());
  const handleFind = () =>
    editor()?.getAction('actions.find')?.run();
  const handleReplace = () =>
    editor()?.getAction('editor.action.startFindReplaceAction')?.run();

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground cursor-pointer rounded-sm">
        Edit
      </MenubarTrigger>
      <MenubarContent className="min-w-44 text-xs z-[9999]">
        <MenubarItem onClick={handleUndo}>
          Undo
          <MenubarShortcut>Ctrl+Z</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleRedo}>
          Redo
          <MenubarShortcut>Ctrl+Y</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={handleFind}>
          Find…
          <MenubarShortcut>Ctrl+F</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleReplace}>
          Replace…
          <MenubarShortcut>Ctrl+H</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={handleSelectAll}>
          Select All
          <MenubarShortcut>Ctrl+A</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
