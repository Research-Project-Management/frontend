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
import { usePageStore } from '@/features/editor/store';

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

  const insertHeading = (cmd: string, defaultTitle: string) => {
    const ed = editor();
    if (!ed) return;
    const sel = ed.getSelection();
    const model = ed.getModel();
    const selectedText = (sel && model ? model.getValueInRange(sel) : '') || defaultTitle;
    if (sel && !sel.isEmpty()) {
      ed.executeEdits('menu', [
        {
          range: sel,
          text: `${cmd}{${selectedText}}\n`,
          forceMoveMarkers: true,
        },
      ]);
    } else if (sel) {
      ed.executeEdits('menu', [
        {
          range: sel,
          text: `${cmd}{${defaultTitle}}\n`,
          forceMoveMarkers: true,
        },
      ]);
    }
    ed.focus();
  };

  const formatNormal = () => {
    const ed = editor();
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const model = ed.getModel();
    if (!model) return;
    const text = model.getValueInRange(sel);
    if (!text) return;
    const unformatted = text
      .replace(/\\(?:sub){0,2}section\*?\{([^}]*)\}/g, '$1')
      .replace(/\\(?:sub)?paragraph\*?\{([^}]*)\}/g, '$1');
    ed.executeEdits('menu', [
      {
        range: sel,
        text: unformatted,
        forceMoveMarkers: true,
      },
    ]);
    ed.focus();
  };

  const insertList = (env: 'itemize' | 'enumerate') => {
    const ed = editor();
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    ed.executeEdits('menu', [
      {
        range: sel,
        text: `\\begin{${env}}\n  \\item \n\\end{${env}}\n`,
        forceMoveMarkers: true,
      },
    ]);
    ed.focus();
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
        <MenubarItem onClick={() => editor()?.getAction('editor.action.indentLines')?.run()}>
          Increase indentation
        </MenubarItem>
        <MenubarItem onClick={() => editor()?.getAction('editor.action.outdentLines')?.run()}>
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
