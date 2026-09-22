'use client';

import React from 'react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarShortcut,
} from "@/shared/components/ui";
import { useEditorInstance } from '@/features/editor/core/context/editor-instance.context';

export default function FormatMenu() {
  const { engine } = useEditorInstance();

  const wrapSelection = (before: string, after: string) => {
    engine?.wrapSelection(before, after);
  };

  const insertHeading = (cmd: string, defaultTitle: string) => {
    if (!engine) return;
    const selectedText = engine.getSelectedText() || defaultTitle;
    engine.insertText(`${cmd}{${selectedText}}\n`);
  };

  const formatNormal = () => {
    if (!engine) return;
    const text = engine.getSelectedText();
    if (!text) return;
    const unformatted = text
      .replace(/\\(?:sub){0,2}section\*?\{([^}]*)\}/g, '$1')
      .replace(/\\(?:sub)?paragraph\*?\{([^}]*)\}/g, '$1');
    engine.insertText(unformatted);
  };

  const insertList = (env: 'itemize' | 'enumerate') => {
    if (!engine) return;
    engine.insertText(`\\begin{${env}}\n  \\item \n\\end{${env}}\n`);
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm">
        Format
      </MenubarTrigger>
      <MenubarContent className="min-w-48 text-xs z-[9999]">
        <MenubarItem onClick={() => wrapSelection('\\textbf{', '}')}>
          Bold
          <MenubarShortcut>Ctrl B</MenubarShortcut>
        </MenubarItem>
        <MenubarItem onClick={() => wrapSelection('\\textit{', '}')}>
          Italics
          <MenubarShortcut>Ctrl I</MenubarShortcut>
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem onClick={() => insertList('itemize')}>
          Bullet list
        </MenubarItem>
        <MenubarItem onClick={() => insertList('enumerate')}>
          Numbered list
        </MenubarItem>
        <MenubarItem onClick={() => engine?.indent()}>
          Increase indentation
        </MenubarItem>
        <MenubarItem onClick={() => engine?.outdent()}>
          Decrease indentation
        </MenubarItem>

        <MenubarSeparator />

        <MenubarItem onClick={formatNormal}>
          Normal
        </MenubarItem>
        <MenubarItem onClick={() => insertHeading('\\section', 'Section Title')}>
          Section
        </MenubarItem>
        <MenubarItem onClick={() => insertHeading('\\subsection', 'Subsection Title')}>
          Subsection
        </MenubarItem>
        <MenubarItem onClick={() => insertHeading('\\subsubsection', 'Subsubsection Title')}>
          Subsubsection
        </MenubarItem>
        <MenubarItem onClick={() => insertHeading('\\paragraph', 'Paragraph Title')}>
          Paragraph
        </MenubarItem>
        <MenubarItem onClick={() => insertHeading('\\subparagraph', 'Subparagraph Title')}>
          Subparagraph
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
