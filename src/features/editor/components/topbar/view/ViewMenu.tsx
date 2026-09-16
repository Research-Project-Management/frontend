'use client';

import React, { useState } from 'react';
import { Calculator } from 'lucide-react';
import { MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator } from "@/shared/components/ui";
import {
  useSettingsStore,
  usePageStore,
  type LayoutMode,
} from '@/features/editor/store';
import { WordCountDialog } from '../../editor/subcomponents/WordCountDialog';

export default function ViewMenu() {
  const { layout, setLayout } = useSettingsStore();
  const { getEditorContent } = usePageStore();
  const [wordCountOpen, setWordCountOpen] = useState(false);

  const handleSetLayout = (m: LayoutMode) => setLayout(m);

  return (
    <>
      <MenubarMenu>
        <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm">
          View
        </MenubarTrigger>
        <MenubarContent className="min-w-48 text-xs z-[9999]">
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
          <MenubarSeparator />
          <MenubarItem onClick={() => setWordCountOpen(true)}>
            <Calculator className="size-3.5 mr-2 text-primary shrink-0" />
            Word Count (TeXcount)
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <WordCountDialog
        open={wordCountOpen}
        onClose={() => setWordCountOpen(false)}
        content={getEditorContent.current?.() ?? ''}
      />
    </>
  );
}
