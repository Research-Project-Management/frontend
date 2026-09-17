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
import { EditorEventBus } from '@/features/editor/utils/editor.util';
import { useSettingsStore } from '@/features/editor/store';

export default function ViewMenu() {
  const { setLayout } = useSettingsStore();

  const handlePresentationMode = () => {
    setLayout('viewer-only');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm">
        View
      </MenubarTrigger>
      <MenubarContent className="min-w-44 text-xs z-[9999]">
        <MenubarItem onClick={handlePresentationMode}>
          Presentation mode
        </MenubarItem>

        <MenubarSub>
          <MenubarSubTrigger>PDF zoom</MenubarSubTrigger>
          <MenubarSubContent className="text-xs min-w-36">
            <MenubarItem onClick={() => EditorEventBus.emit('flux:zoom-in')}>
              Zoom in
            </MenubarItem>
            <MenubarItem onClick={() => EditorEventBus.emit('flux:zoom-out')}>
              Zoom out
            </MenubarItem>
            <MenubarItem onClick={() => EditorEventBus.emit('flux:zoom-fit-width')}>
              Fit to width
            </MenubarItem>
            <MenubarItem onClick={() => EditorEventBus.emit('flux:zoom-fit-height')}>
              Fit to height
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>
      </MenubarContent>
    </MenubarMenu>
  );
}
