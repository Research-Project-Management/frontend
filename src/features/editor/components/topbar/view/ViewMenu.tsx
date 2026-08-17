'use client';

import React from 'react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
} from '@/shared/components/ui';
import {
  useSettingsStore,
  type LayoutMode,
} from '@/features/editor/store/settings.store';

export default function ViewMenu() {
  const { layout, setLayout } = useSettingsStore();

  const handleSetLayout = (m: LayoutMode) => setLayout(m);

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground cursor-pointer rounded-sm">
        View
      </MenubarTrigger>
      <MenubarContent className="min-w-44 text-xs z-[9999]">
        <MenubarItem
          onClick={() => handleSetLayout('editor-only')}
          className={layout === 'editor-only' ? 'font-semibold text-primary' : ''}
        >
          Editor Only
        </MenubarItem>
        <MenubarItem
          onClick={() => handleSetLayout('split')}
          className={layout === 'split' ? 'font-semibold text-primary' : ''}
        >
          Editor & PDF (Split)
        </MenubarItem>
        <MenubarItem
          onClick={() => handleSetLayout('viewer-only')}
          className={layout === 'viewer-only' ? 'font-semibold text-primary' : ''}
        >
          PDF Viewer Only
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
