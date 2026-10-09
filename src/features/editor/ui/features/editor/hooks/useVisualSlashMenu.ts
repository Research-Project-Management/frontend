'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  SLASH_COMMANDS,
  type SlashCommandItem,
} from '../VisualSlashCommandMenu';
import {
  renderMathHtml,
  convertLatexFigureToHtml,
} from '@/features/editor/domain/latex/latex-converter';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

export interface SlashMenuState {
  isOpen: boolean;
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
}

interface UseVisualSlashMenuOptions {
  contentRef: React.RefObject<HTMLDivElement | null>;
  projectImageFiles: string[];
  handleInput: () => void;
}

export function useVisualSlashMenu({
  contentRef,
  projectImageFiles,
  handleInput,
}: UseVisualSlashMenuOptions) {
  const [slashMenu, setSlashMenu] = useState<SlashMenuState>({
    isOpen: false,
    query: '',
    position: { top: 0, left: 0 },
    selectedIndex: 0,
  });

  const filteredSlashCommands = useMemo(() => {
    const q = slashMenu.query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.description.toLowerCase().includes(q)) return true;
      return item.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [slashMenu.query]);

  const handleSelectSlashCommand = useCallback(
    (item: SlashCommandItem) => {
      // 1. Remove the "/query" typed text from the DOM cursor position
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        const textNode =
          sel.anchorNode.nodeType === Node.TEXT_NODE
            ? (sel.anchorNode as Text)
            : (sel.anchorNode.firstChild as Text | null);

        if (textNode && textNode.textContent) {
          const text = textNode.textContent;
          const offset = sel.anchorOffset;
          const slashIdx = text.lastIndexOf('/', offset - 1);
          if (slashIdx !== -1) {
            const before = text.slice(0, slashIdx);
            const after = text.slice(offset);
            textNode.textContent = before + after;

            try {
              const range = document.createRange();
              range.setStart(textNode, before.length);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            } catch {
              // Ignore range restore failures in edge cases
            }
          }
        }
      }

      // 2. Close slash menu
      setSlashMenu((prev) => ({ ...prev, isOpen: false }));

      // 3. Execute the selected command
      switch (item.id) {
        case 'section':
          document.execCommand('formatBlock', false, 'h1');
          break;
        case 'subsection':
          document.execCommand('formatBlock', false, 'h2');
          break;
        case 'subsubsection':
          document.execCommand('formatBlock', false, 'h3');
          break;
        case 'bullet-list':
          document.execCommand('insertUnorderedList', false);
          break;
        case 'numbered-list':
          document.execCommand('insertOrderedList', false);
          break;
        case 'quote':
          document.execCommand('formatBlock', false, 'blockquote');
          break;
        case 'inline-math': {
          const sample = 'x^2 + y^2 = z^2';
          const mathHtml = `<span class="latex-math-inline inline-block px-1 py-0.5 bg-muted/20 rounded cursor-pointer" data-math="${encodeURIComponent(sample)}">${renderMathHtml(sample, false)}</span>&nbsp;`;
          document.execCommand('insertHTML', false, mathHtml);
          break;
        }
        case 'display-equation': {
          const sample = '\\int_{0}^{1} f(x) dx = F(1) - F(0)';
          const mathHtml = `<div class="latex-math-block my-3 p-2 text-center bg-muted/10 rounded cursor-pointer" data-math="${encodeURIComponent(sample)}" data-display="true">${renderMathHtml(sample, true)}</div><p><br></p>`;
          document.execCommand('insertHTML', false, mathHtml);
          break;
        }
        case 'align-block': {
          const sample = 'a &= b + c \\\\\n&= d + e';
          const mathHtml = `<div class="latex-math-block my-3 p-2 text-center bg-muted/10 rounded cursor-pointer" data-math="${encodeURIComponent(sample)}" data-display="true">${renderMathHtml(sample, true)}</div><p><br></p>`;
          document.execCommand('insertHTML', false, mathHtml);
          break;
        }
        case 'table': {
          const tableHtml = `<table class="my-4 border-collapse border border-border w-full"><thead><tr><th class="p-2 border border-border bg-muted/40 font-semibold"><p>Header 1</p></th><th class="p-2 border border-border bg-muted/40 font-semibold"><p>Header 2</p></th><th class="p-2 border border-border bg-muted/40 font-semibold"><p>Header 3</p></th></tr></thead><tbody><tr><td class="p-2 border border-border"><p>Cell 1</p></td><td class="p-2 border border-border"><p>Cell 2</p></td><td class="p-2 border border-border"><p>Cell 3</p></td></tr><tr><td class="p-2 border border-border"><p>Cell 4</p></td><td class="p-2 border border-border"><p>Cell 5</p></td><td class="p-2 border border-border"><p>Cell 6</p></td></tr></tbody></table><p><br></p>`;
          document.execCommand('insertHTML', false, tableHtml);
          break;
        }
        case 'figure': {
          const defaultSrc = projectImageFiles[0] || 'diagram.png';
          const figLatex = `\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\linewidth]{${defaultSrc}}\n  \\caption{Figure caption}\n  \\label{fig:example}\n\\end{figure}`;
          const figHtml = convertLatexFigureToHtml(figLatex) + '<p><br></p>';
          document.execCommand('insertHTML', false, figHtml);
          break;
        }
        case 'algorithm': {
          const algoLatex =
            '\\begin{algorithm}[H]\n  \\caption{Algorithm description}\n  \\begin{algorithmic}[1]\n    \\STATE Initialize state\n    \\WHILE{condition}\n      \\STATE Compute step\n    \\ENDWHILE\n  \\end{algorithmic}\n\\end{algorithm}';
          const enc = encodeURIComponent(algoLatex);
          const algoHtml = `<div class="latex-protected-block my-4 p-3 bg-muted/30 border border-border/80 rounded-md font-mono text-xs" data-raw-latex="${enc}">
            <div class="flex items-center justify-between text-muted-foreground pb-2 border-b border-border/50 select-none">
              <span class="font-semibold text-foreground/80 flex items-center gap-1.5">📦 LaTeX [Algorithm]</span>
              <div class="flex items-center gap-2">
                <button type="button" class="latex-protected-edit-btn text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded cursor-pointer transition-colors">Edit Raw</button>
                <span class="text-11 bg-muted px-1.5 py-0.5 rounded">Protected Block</span>
              </div>
            </div>
            <pre class="mt-2 text-foreground/90 whitespace-pre-wrap overflow-x-auto select-all">${algoLatex}</pre>
          </div><p><br></p>`;
          document.execCommand('insertHTML', false, algoHtml);
          break;
        }
        case 'code-block': {
          const codeLatex =
            '\\begin{lstlisting}[language=Python]\n# Python Code Snippet\ndef solve():\n    return 42\n\\end{lstlisting}';
          const enc = encodeURIComponent(codeLatex);
          const codeHtml = `<div class="latex-protected-block my-4 p-3 bg-muted/30 border border-border/80 rounded-md font-mono text-xs" data-raw-latex="${enc}">
            <div class="flex items-center justify-between text-muted-foreground pb-2 border-b border-border/50 select-none">
              <span class="font-semibold text-foreground/80 flex items-center gap-1.5">📦 LaTeX [Listing]</span>
              <div class="flex items-center gap-2">
                <button type="button" class="latex-protected-edit-btn text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-0.5 rounded cursor-pointer transition-colors">Edit Raw</button>
                <span class="text-11 bg-muted px-1.5 py-0.5 rounded">Protected Block</span>
              </div>
            </div>
            <pre class="mt-2 text-foreground/90 whitespace-pre-wrap overflow-x-auto select-all">${codeLatex}</pre>
          </div><p><br></p>`;
          document.execCommand('insertHTML', false, codeHtml);
          break;
        }
        case 'citation':
          editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
          break;
        case 'label': {
          const labelKey = 'sec:label';
          const labelHtml = `<span class="latex-label-token inline-flex items-center text-11 font-mono bg-muted/60 text-muted-foreground px-1 py-0.5 rounded ml-1 select-none" data-label="${encodeURIComponent(labelKey)}">🏷️${labelKey}</span>&nbsp;`;
          document.execCommand('insertHTML', false, labelHtml);
          break;
        }
        default:
          break;
      }

      handleInput();
    },
    [handleInput, projectImageFiles]
  );

  const handleSlashKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): boolean => {
      // Return true if handled and event should stop
      if (slashMenu.isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSlashMenu((prev) => ({
            ...prev,
            selectedIndex:
              filteredSlashCommands.length > 0
                ? (prev.selectedIndex + 1) % filteredSlashCommands.length
                : 0,
          }));
          return true;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSlashMenu((prev) => ({
            ...prev,
            selectedIndex:
              filteredSlashCommands.length > 0
                ? (prev.selectedIndex - 1 + filteredSlashCommands.length) %
                  filteredSlashCommands.length
                : 0,
          }));
          return true;
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (filteredSlashCommands.length > 0) {
            const selected =
              filteredSlashCommands[slashMenu.selectedIndex] || filteredSlashCommands[0];
            handleSelectSlashCommand(selected);
          }
          return true;
        }

        if (e.key === 'Escape') {
          e.preventDefault();
          setSlashMenu((prev) => ({ ...prev, isOpen: false }));
          return true;
        }
      }

      // Trigger Slash Menu on '/'
      if (e.key === '/') {
        let top = 120;
        let left = 100;
        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
        if (sel && sel.rangeCount > 0) {
          try {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            if (rect.bottom > 0) top = rect.bottom + 4;
            if (rect.left > 0) left = rect.left;
          } catch {
            // fallback coordinates
          }
        } else if (contentRef.current) {
          try {
            const rect = contentRef.current.getBoundingClientRect();
            top = (rect.top || 0) + 80;
            left = (rect.left || 0) + 40;
          } catch {
            // fallback coordinates
          }
        }

        setSlashMenu({
          isOpen: true,
          query: '',
          position: { top, left },
          selectedIndex: 0,
        });
      }

      return false;
    },
    [contentRef, filteredSlashCommands, handleSelectSlashCommand, slashMenu.isOpen, slashMenu.selectedIndex]
  );

  const handleSlashKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      e.key === 'ArrowUp' ||
      e.key === 'ArrowDown' ||
      e.key === 'Enter' ||
      e.key === 'Escape'
    ) {
      return;
    }

    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      const text = sel.anchorNode.textContent || '';
      const offset = sel.anchorOffset;
      const slashIdx = text.lastIndexOf('/', offset - 1);

      if (slashIdx !== -1) {
        const query = text.slice(slashIdx + 1, offset).trim();
        if (query.includes(' ') || query.includes('\n')) {
          setSlashMenu((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
        } else {
          setSlashMenu((prev) => ({
            ...prev,
            isOpen: true,
            query,
            selectedIndex: 0,
          }));
        }
      } else {
        setSlashMenu((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      }
    }
  }, []);

  return {
    slashMenu,
    setSlashMenu,
    filteredSlashCommands,
    handleSelectSlashCommand,
    handleSlashKeyDown,
    handleSlashKeyUp,
  };
}
