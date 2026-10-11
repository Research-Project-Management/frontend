'use client';

/**
 * InsertMenu.tsx
 *
 * Topbar Insert Dropdown Menu (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/topbar/InsertMenu.tsx`
 */

import React from 'react';
import { AlignLeft, Tag, Heading } from 'lucide-react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarSeparator,
} from "@/shared/components/ui";
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';
import { useDocumentCollaborationStore } from '@/features/editor/store/collaboration.store';
import { useLayoutStore } from '@/features/editor/store/layout.store';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

export function InsertMenu() {
  const { engine } = useEditorInstance();

  const insertSnippet = (snippet: string) => {
    engine?.insertText(snippet);
  };

  const handleInsertFigureUrl = () => {
    insertSnippet(
      '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{https://example.com/image.png}\n  \\caption{Figure caption}\n  \\label{fig:my_figure}\n\\end{figure}\n'
    );
  };

  const handleComment = () => {
    const sel = engine?.getSelection?.();
    const cursor = engine?.getCursorPosition?.();

    const startLine = sel?.startLine ?? cursor?.line ?? 1;
    const endLine = sel?.endLine ?? cursor?.line ?? 1;
    const selectedText = engine?.getSelectedText?.() || '';

    useDocumentCollaborationStore.getState().setPendingComment({
      startLine,
      endLine,
      selectedText,
    });
    useLayoutStore.getState().setActiveSidebarTab('review');
    useLayoutStore.getState().setSidebarLeftOpen(true);
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary select-none transition-colors">
        Insert
      </MenubarTrigger>

      <MenubarContent className="min-w-56 text-xs select-none">
        {/* 1. Math > */}
        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            <span className="whitespace-nowrap">Math</span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-40 text-xs select-none">
            <MenubarItem
              onClick={() => insertSnippet('$E = mc^2$')}
              className="cursor-pointer"
            >
              <span className="whitespace-nowrap">Inline math</span>
            </MenubarItem>
            <MenubarItem
              onClick={() => insertSnippet('\\[\n  \\int_{a}^{b} f(x)\\,dx\n\\]\n')}
              className="cursor-pointer"
            >
              <span className="whitespace-nowrap">Display math</span>
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* 2. Symbol */}
        <MenubarItem
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'symbol-palette' })}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Symbol</span>
        </MenubarItem>

        {/* 3. Figure > */}
        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            <span className="whitespace-nowrap">Figure</span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-52 text-xs select-none">
            <MenubarItem
              onClick={() => {
                useLayoutStore.getState().setActiveSidebarTab('files');
                useLayoutStore.getState().setSidebarLeftOpen(true);
                editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'upload' } });
              }}
              className="cursor-pointer"
            >
              <span className="whitespace-nowrap">Upload from computer</span>
            </MenubarItem>
            <MenubarItem
              onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'figure-wizard' })}
              className="cursor-pointer"
            >
              <span className="whitespace-nowrap">From project files</span>
            </MenubarItem>
            <MenubarItem
              onClick={() => {
                useLayoutStore.getState().setActiveSidebarTab('files');
                useLayoutStore.getState().setSidebarLeftOpen(true);
                editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'add-files', payload: { initialTab: 'project' } });
              }}
              className="cursor-pointer"
            >
              <span className="whitespace-nowrap">From another project</span>
            </MenubarItem>
            <MenubarItem
              onClick={handleInsertFigureUrl}
              className="cursor-pointer"
            >
              <span className="whitespace-nowrap">From URL</span>
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* 4. Table */}
        <MenubarItem
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'table-wizard' })}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Table (Tabular)</span>
        </MenubarItem>

        {/* 4b. Matrix */}
        <MenubarItem
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'matrix-wizard' })}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Matrix (Math)</span>
        </MenubarItem>

        {/* 5. Citation */}
        <MenubarItem
          onClick={() => editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' })}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Citation</span>
        </MenubarItem>

        {/* 5b. Bibliography > */}
        <MenubarSub>
          <MenubarSubTrigger className="cursor-pointer">
            <span className="whitespace-nowrap">Bibliography</span>
          </MenubarSubTrigger>
          <MenubarSubContent className="min-w-48 text-xs select-none">
            <MenubarItem
              onClick={() => insertSnippet('\\printbibliography\n')}
              className="cursor-pointer"
            >
              <span className="whitespace-nowrap">\printbibliography (biblatex)</span>
            </MenubarItem>
            <MenubarItem
              onClick={() => insertSnippet('\\bibliography{references}\n')}
              className="cursor-pointer"
            >
              <span className="whitespace-nowrap">\bibliography&#123;references&#125; (BibTeX)</span>
            </MenubarItem>
            <MenubarSub>
              <MenubarSubTrigger className="cursor-pointer">
                <span className="whitespace-nowrap">\bibliographystyle</span>
              </MenubarSubTrigger>
              <MenubarSubContent className="min-w-36 text-xs select-none">
                {['plain', 'ieeetr', 'alpha', 'abbrv', 'acm', 'unsrt', 'apalike'].map((style) => (
                  <MenubarItem
                    key={style}
                    onClick={() => insertSnippet(`\\bibliographystyle{${style}}\n`)}
                    className="cursor-pointer"
                  >
                    <span className="whitespace-nowrap">{style}</span>
                  </MenubarItem>
                ))}
              </MenubarSubContent>
            </MenubarSub>
          </MenubarSubContent>
        </MenubarSub>

        {/* 6. Link */}
        <MenubarItem
          onClick={() => insertSnippet('\\href{https://example.com}{Link text}')}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Link</span>
        </MenubarItem>

        {/* 7. Cross reference */}
        <MenubarItem
          onClick={() => insertSnippet('\\ref{fig:figure}')}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Cross reference</span>
        </MenubarItem>

        {/* Divider */}
        <MenubarSeparator />

        {/* 8. Comment */}
        <MenubarItem
          onClick={handleComment}
          className="cursor-pointer"
        >
          <span className="whitespace-nowrap">Comment</span>
        </MenubarItem>

        {/* Divider */}
        <MenubarSeparator />

        {/* 9. Abstract */}
        <MenubarItem
          onClick={() => insertSnippet('\\begin{abstract}\n  \n\\end{abstract}\n')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <AlignLeft className="size-3.5 text-foreground shrink-0" />
          <span className="whitespace-nowrap">Abstract</span>
        </MenubarItem>

        {/* 10. Keywords */}
        <MenubarItem
          onClick={() => insertSnippet('\\begin{IEEEkeywords}\n  \n\\end{IEEEkeywords}\n')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Tag className="size-3.5 text-foreground shrink-0" />
          <span className="whitespace-nowrap">Keywords</span>
        </MenubarItem>

        {/* 11. Title */}
        <MenubarItem
          onClick={() => insertSnippet('\\title{Document Title}\n')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <Heading className="size-3.5 text-foreground shrink-0" />
          <span className="whitespace-nowrap">Title</span>
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}

export default InsertMenu;
