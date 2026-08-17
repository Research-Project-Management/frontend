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

export default function FormatMenu() {
  const { editorRef } = usePageStore();
  const editor = () => editorRef.current;

  const wrapSelection = (before: string, after: string) => {
    const ed = editor();
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const model = ed.getModel();
    if (!model) return;
    const selectedText = model.getValueInRange(sel);
    ed.executeEdits('menu', [
      {
        range: sel,
        text: `${before}${selectedText}${after}`,
        forceMoveMarkers: true,
      },
    ]);
    ed.focus();
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground cursor-pointer rounded-sm">
        Format
      </MenubarTrigger>
      <MenubarContent className="min-w-44 text-xs z-[9999]">
        <MenubarItem onClick={() => wrapSelection('\\textbf{', '}')}>
          Bold (\textbf)
          <MenubarShortcut>Ctrl+B</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={() => wrapSelection('\\textit{', '}')}>
          Italic (\textit)
          <MenubarShortcut>Ctrl+I</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={() => wrapSelection('\\underline{', '}')}>
          Underline (\underline)
          <MenubarShortcut>Ctrl+U</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={() => wrapSelection('\\texttt{', '}')}>
          Monospace (\texttt)
        </MenubarItem>
        <MenubarItem onClick={() => wrapSelection('\\textsc{', '}')}>
          Small Caps (\textsc)
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem onClick={() => wrapSelection('$', '$')}>
          Inline Math ($…$)
        </MenubarItem>
        <MenubarItem onClick={() => wrapSelection('\\[\n  ', '\n\\]')}>
          Display Math (\[…\])
        </MenubarItem>
        <MenubarSeparator />
        <MenubarItem
          onClick={() =>
            editor()?.getAction('editor.action.formatDocument')?.run()
          }
        >
          Format Document
          <MenubarShortcut>Shift+Alt+F</MenubarShortcut>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
