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
import { usePageStore } from '@/features/editor/store';
import { EditorEventBus } from '@/features/editor/utils/editor.util';

export default function InsertMenu() {
  const { editorRef } = usePageStore();

  const insertSnippet = (snippet: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const selection = ed.getSelection();
    ed.executeEdits('menu', [
      {
        range: selection!,
        text: snippet,
        forceMoveMarkers: true,
      },
    ]);
    ed.focus();
  };

  const handleUploadFigure = () => {
    EditorEventBus.emit('flux:upload-file');
    insertSnippet(
      '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{image.png}\n  \\caption{Caption}\n  \\label{fig:figure}\n\\end{figure}\n',
    );
  };

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-sidebar-hover data-[state=open]:bg-sidebar-accent cursor-pointer rounded-sm">
        Insert
      </MenubarTrigger>
      <MenubarContent className="min-w-48 text-xs z-[9999]">
        {/* Math > */}
        <MenubarSub>
          <MenubarSubTrigger>Math</MenubarSubTrigger>
          <MenubarSubContent className="text-xs min-w-40">
            <MenubarItem onClick={() => insertSnippet('$E = mc^2$')}>
              Inline math
            </MenubarItem>
            <MenubarItem onClick={() => insertSnippet('\\[\n  \\int_{a}^{b} f(x)\\,dx\n\\]\n')}>
              Display math
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* Symbol */}
        <MenubarItem onClick={() => insertSnippet('\\alpha')}>
          Symbol
        </MenubarItem>

        {/* Figure > */}
        <MenubarSub>
          <MenubarSubTrigger>Figure</MenubarSubTrigger>
          <MenubarSubContent className="text-xs min-w-48">
            <MenubarItem onClick={handleUploadFigure}>
              Upload from computer
            </MenubarItem>
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{image.png}\n  \\caption{Caption}\n  \\label{fig:figure}\n\\end{figure}\n',
                )
              }
            >
              From project files
            </MenubarItem>
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{figure}[htbp]\n  \\centering\n  % Reference asset from another project\n  \\includegraphics[width=0.8\\linewidth]{figure.png}\n  \\caption{Caption}\n  \\label{fig:figure}\n\\end{figure}\n',
                )
              }
            >
              From another project
            </MenubarItem>
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{figure}[htbp]\n  \\centering\n  % Image from external URL\n  \\includegraphics[width=0.8\\linewidth]{https://example.com/image.png}\n  \\caption{Caption}\n  \\label{fig:figure}\n\\end{figure}\n',
                )
              }
            >
              From URL
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        {/* Table */}
        <MenubarItem
          onClick={() =>
            insertSnippet(
              '\\begin{table}[htbp]\n  \\centering\n  \\caption{Caption}\n  \\label{tab:table}\n  \\begin{tabular}{llr}\n    \\toprule\n    Header 1 & Header 2 & Header 3 \\\\\n    \\midrule\n    Row 1 & Value & 10.0 \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}\n',
            )
          }
        >
          Table
        </MenubarItem>

        {/* Citation */}
        <MenubarItem onClick={() => EditorEventBus.emit('flux:open-citation-picker')}>
          Citation
        </MenubarItem>

        {/* Link */}
        <MenubarItem onClick={() => insertSnippet('\\href{https://example.com}{Link text}')}>
          Link
        </MenubarItem>

        {/* Cross reference */}
        <MenubarItem onClick={() => insertSnippet('\\ref{fig:figure}')}>
          Cross reference
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
