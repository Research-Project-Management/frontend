'use client';

/**
 * EditMenu.tsx
 *
 * Topbar Edit Dropdown Menu (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/EditMenu.tsx`
 */

import React from 'react';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarShortcut } from '@/shared/components/ui/menubar';
import { useEditorInstance } from '@/features/editor/ui/hooks/useEditorInstance';
import { editorCommandBus } from '@/features/editor/core';
import { ShieldCheck } from 'lucide-react';
import { useWorkspaceStore } from '@/features/editor/core';
import { useSearchStore } from '@/features/editor/core/store/search.store';

export function EditMenu({ value = 'edit' }: { value?: string } = {}) {
  const { engine } = useEditorInstance();

  const handleUndo = () => editorCommandBus.dispatch({ type: 'editor:undo' });
  const handleRedo = () => editorCommandBus.dispatch({ type: 'editor:redo' });
  const handleSelectAll = () => engine?.selectAll();
  const handleFind = () => {
    editorCommandBus.dispatch({ type: 'editor:find', open: true });
    engine?.focus();
  };
  const handleFindInProject = () => {
    useWorkspaceStore.getState().setSidebarLeftOpen(true);
    useWorkspaceStore.getState().setActiveSidebarTab('search');
    useSearchStore.getState().setShowReplace(false);
    editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Search' });
  };
  const handleReplaceInProject = () => {
    useWorkspaceStore.getState().setSidebarLeftOpen(true);
    useWorkspaceStore.getState().setActiveSidebarTab('search');
    useSearchStore.getState().setShowReplace(true);
    editorCommandBus.dispatch({ type: 'sidebar:open-panel', panel: 'Search', showReplace: true });
  };
  const handleLintPage = () => editorCommandBus.dispatch({ type: 'editor:lint-project' });

  return (
    <MenubarMenu value={value}>
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
        <MenubarItem onClick={handleFindInProject} className="cursor-pointer">
          <span className="whitespace-nowrap">Find in project</span>
          <MenubarShortcut>Ctrl Shift F</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleReplaceInProject} className="cursor-pointer">
          <span className="whitespace-nowrap">Replace in project</span>
          <MenubarShortcut>Ctrl Shift H</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={handleSelectAll} className="cursor-pointer">
          <span className="whitespace-nowrap">Select all</span>
          <MenubarShortcut>Ctrl A</MenubarShortcut>
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={handleLintPage} className="cursor-pointer">
          <ShieldCheck className="size-3.5 mr-2 text-foreground shrink-0" />
          <span className="whitespace-nowrap">Check Page Syntax</span>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

export default EditMenu;
