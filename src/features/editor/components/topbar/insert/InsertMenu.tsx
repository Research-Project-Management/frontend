'use client';

import React from 'react';
import {
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from '@/shared/components/ui';
import { usePageStore } from '@/features/editor/store/page.store';

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

  return (
    <MenubarMenu>
      <MenubarTrigger className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground cursor-pointer rounded-sm">
        Insert
      </MenubarTrigger>
      <MenubarContent className="min-w-52 text-xs z-[9999]">
        <MenubarSub>
          <MenubarSubTrigger>Section heading</MenubarSubTrigger>
          <MenubarSubContent className="text-xs">
            <MenubarItem onClick={() => insertSnippet('\\section{Title}\n')}>
              \section&#123;…&#125;
            </MenubarItem>
            <MenubarItem onClick={() => insertSnippet('\\subsection{Title}\n')}>
              \subsection&#123;…&#125;
            </MenubarItem>
            <MenubarItem onClick={() => insertSnippet('\\subsubsection{Title}\n')}>
              \subsubsection&#123;…&#125;
            </MenubarItem>
            <MenubarItem onClick={() => insertSnippet('\\paragraph{Title}\n')}>
              \paragraph&#123;…&#125;
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSub>
          <MenubarSubTrigger>Environment</MenubarSubTrigger>
          <MenubarSubContent className="text-xs">
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{image.png}\n  \\caption{Caption}\n  \\label{fig:label}\n\\end{figure}\n',
                )
              }
            >
              Figure
            </MenubarItem>
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{table}[htbp]\n  \\centering\n  \\caption{Caption}\n  \\label{tab:label}\n  \\begin{tabular}{llr}\n    \\toprule\n    Header 1 & Header 2 & Header 3 \\\\\n    \\midrule\n    Row 1 & Value & 10.0 \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}\n',
                )
              }
            >
              Table (booktabs)
            </MenubarItem>
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{equation}\n  \\label{eq:label}\n  E = mc^2\n\\end{equation}\n',
                )
              }
            >
              Equation
            </MenubarItem>
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{align}\n  a &= b + c \\\\\n  d &= e + f\n\\end{align}\n',
                )
              }
            >
              Align (multiline math)
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{itemize}\n  \\item First\n  \\item Second\n\\end{itemize}\n',
                )
              }
            >
              Bullet List (itemize)
            </MenubarItem>
            <MenubarItem
              onClick={() =>
                insertSnippet(
                  '\\begin{enumerate}\n  \\item First\n  \\item Second\n\\end{enumerate}\n',
                )
              }
            >
              Numbered List (enumerate)
            </MenubarItem>
          </MenubarSubContent>
        </MenubarSub>

        <MenubarSeparator />
        <MenubarItem onClick={() => insertSnippet('\\cite{key}')}>
          Citation (\cite&#123;…&#125;)
        </MenubarItem>
        <MenubarItem onClick={() => insertSnippet('\\ref{fig:label}')}>
          Cross-reference (\ref&#123;…&#125;)
        </MenubarItem>
        <MenubarItem onClick={() => insertSnippet('\\footnote{Note text}')}>
          Footnote (\footnote&#123;…&#125;)
        </MenubarItem>
        <MenubarItem onClick={() => insertSnippet('\\label{sec:name}')}>
          Label (\label&#123;…&#125;)
        </MenubarItem>
      </MenubarContent>
    </MenubarMenu>
  );
}
