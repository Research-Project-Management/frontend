'use client';

/**
 * VisualEditorView.tsx
 *
 * Rich-Text / Visual LaTeX Editor View (Overleaf Visual Mode Parity).
 * Location: `features/editor/ui/features/editor/VisualEditorView.tsx`
 *
 * Capabilities:
 * 1. WYSIWYG Document Surface:
 *    - Headings (H1 \section, H2 \subsection, H3 \subsubsection) rendered with styled typography.
 *    - Bold (\textbf), Italic (\textit), Underline (\underline), Code (\texttt).
 *    - Ordered and unordered lists.
 *    - Tables rendered as interactive HTML tables.
 * 2. Interactive KaTeX Math Editing:
 *    - Inline ($...$) and Display ($$...$$, \begin{equation}...\end{equation}) rendered with KaTeX.
 *    - Click-to-edit inline math editor card with live real-time KaTeX preview.
 * 3. Protected LaTeX Environments:
 *    - Figures, TikZ, Algorithms, Listings preserved with clean cards and 1-click raw LaTeX editor.
 * 4. Interactive Citations & References:
 *    - \cite rendered as clickable chips [@key] with citation details and picker link.
 *    - \ref rendered as link badges.
 * 5. Lossless Two-Way Sync:
 *    - Continuous debounced synchronization with backend LaTeX source via latexToHtml / htmlToLatex.
 *    - Registered with setActiveEditorEngine and editorCommandBus.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import 'katex/dist/katex.min.css';
import {
  Sigma,
  Check,
  X,
  Trash2,
  Code2,
  FileCode2,
  ExternalLink,
  BookOpen,
  Eye,
  Edit3,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';

import {
  latexToHtml,
  htmlToLatex,
  renderMathHtml,
  convertLatexFigureToHtml,
} from '@/features/editor/domain/latex/latex-converter';
import {
  editorCommandBus,
  setActiveEditorEngine,
} from '@/features/editor/coordinators/command-bus';
import { EditorEventBus } from '@/features/editor/domain/latex/latex-structure';
import { useSettingsStore } from '../../../store/settings.store';
import { useDocumentEditorStore } from '../../../store/editor.store';
import {
  VisualSlashCommandMenu,
  SLASH_COMMANDS,
  type SlashCommandItem,
} from './VisualSlashCommandMenu';
import {
  VisualTableToolbar,
} from './VisualTableToolbar';
import {
  VisualFigureToolbar,
} from './VisualFigureToolbar';
import {
  VisualMathSymbolPalette,
} from './VisualMathSymbolPalette';
import {
  VisualSelectionBubbleMenu,
  type BlockType,
} from './VisualSelectionBubbleMenu';
import { VisualCollaboratorCursors } from './VisualCollaboratorCursors';
import { VisualReferenceHoverCard } from './VisualReferenceHoverCard';
import type { CollaboratorPresenceInfo } from '../../../store/collaboration.store';

export interface VisualEditorViewProps {
  fileId?: string;
  filePath?: string;
  value: string;
  onChange?: (nextLatex: string) => void;
  readOnly?: boolean;
  currentUserId?: string;
  collaborators?: CollaboratorPresenceInfo[];
}

interface ActiveMathEditorState {
  element: HTMLElement;
  isDisplay: boolean;
  initialMath: string;
  currentMath: string;
}

interface ActiveProtectedBlockEditorState {
  element: HTMLElement;
  rawLatex: string;
}

interface ActiveTableState {
  table: HTMLTableElement;
  cell: HTMLTableCellElement;
  rowIndex: number;
  colIndex: number;
  totalRows: number;
  totalCols: number;
  caption: string;
  label: string;
  columnAlignment: 'left' | 'center' | 'right';
  position: { top: number; left: number };
}

interface ActiveFigureState {
  element: HTMLElement;
  src: string;
  width: string;
  caption: string;
  label: string;
  isCentering: boolean;
  isStarred: boolean;
  position: { top: number; left: number };
}

export function VisualEditorView({
  fileId,
  filePath = 'main.tex',
  value,
  onChange,
  readOnly = false,
  currentUserId,
  collaborators,
}: VisualEditorViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const originalLatexRef = useRef<string>(value);
  const debounceTimerRef = useRef<any>(null);

  // Math editor floating modal / popover
  const [activeMath, setActiveMath] = useState<ActiveMathEditorState | null>(null);
  const mathInputRef = useRef<HTMLInputElement>(null);
  const [showSymbolPalette, setShowSymbolPalette] = useState<boolean>(true);

  // Protected block raw code editor modal
  const [activeProtected, setActiveProtected] = useState<ActiveProtectedBlockEditorState | null>(null);
  const [protectedEditCode, setProtectedEditCode] = useState<string>('');

  // Floating Table Matrix Toolbar state
  const [activeTable, setActiveTable] = useState<ActiveTableState | null>(null);

  // Floating Figure Toolbar state (Overleaf Parity)
  const [activeFigure, setActiveFigure] = useState<ActiveFigureState | null>(null);
  const fileHierarchy = useDocumentEditorStore((s) => s.fileHierarchy);

  const projectImageFiles = useMemo(() => {
    const images: string[] = [];
    if (!fileHierarchy || !Array.isArray(fileHierarchy)) return images;

    const traverse = (nodes: any[], currentPath = '') => {
      for (const node of nodes) {
        const name = node.title || (node as any).name || '';
        const nodePath = currentPath ? `${currentPath}/${name}` : name;
        if (node.children?.length) {
          traverse(node.children, nodePath);
        } else {
          const ext = name.split('.').pop()?.toLowerCase() || '';
          if (['png', 'jpg', 'jpeg', 'pdf', 'svg', 'eps', 'webp'].includes(ext)) {
            images.push(nodePath);
          }
        }
      }
    };
    traverse(fileHierarchy);
    return images;
  }, [fileHierarchy]);

  // Slash Command Menu state
  const [slashMenu, setSlashMenu] = useState<{
    isOpen: boolean;
    query: string;
    position: { top: number; left: number };
    selectedIndex: number;
  }>({
    isOpen: false,
    query: '',
    position: { top: 0, left: 0 },
    selectedIndex: 0,
  });

  // Floating Selection Bubble Menu state (Medium / Notion / Overleaf Parity)
  const [selectionBubble, setSelectionBubble] = useState<{
    isOpen: boolean;
    position: { top: number; left: number };
    activeFormats: {
      bold: boolean;
      italic: boolean;
      underline: boolean;
      strike: boolean;
      code: boolean;
      blockType: BlockType;
    };
  }>({
    isOpen: false,
    position: { top: 0, left: 0 },
    activeFormats: {
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      code: false,
      blockType: 'p',
    },
  });

  const toggleEditorMode = useSettingsStore((s) => s.toggleEditorMode);

  // Filter commands for slash menu
  const filteredSlashCommands = useMemo(() => {
    const q = slashMenu.query.trim().toLowerCase();
    if (!q) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((item) => {
      if (item.title.toLowerCase().includes(q)) return true;
      if (item.description.toLowerCase().includes(q)) return true;
      return item.keywords.some((k) => k.toLowerCase().includes(q));
    });
  }, [slashMenu.query]);

  // Sync incoming value to internal HTML only when external value has drastically diverged
  useEffect(() => {
    originalLatexRef.current = value;
    if (!contentRef.current) return;

    // Check if the current HTML converts back to something close to value
    const currentHtml = contentRef.current.innerHTML;
    const currentDerivedLatex = htmlToLatex(currentHtml, value);

    if (currentDerivedLatex.trim() !== value.trim()) {
      const newHtml = latexToHtml(value);
      contentRef.current.innerHTML = newHtml;
    }
  }, [value]);

  // Two-way sync: read HTML, convert back to LaTeX, and call onChange
  const syncHtmlToLatex = useCallback(() => {
    if (!contentRef.current || readOnly) return;
    const html = contentRef.current.innerHTML;
    const nextLatex = htmlToLatex(html, originalLatexRef.current);
    originalLatexRef.current = nextLatex;
    onChange?.(nextLatex);
  }, [onChange, readOnly]);

  const handleInput = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      syncHtmlToLatex();
    }, 250);
  }, [syncHtmlToLatex]);

  // Precision Reverse SyncTeX: Jump to source line in Visual Mode
  const handleJumpToLine = useCallback(
    (targetLine: number, highlightType: 'synctex' | 'error' = 'synctex') => {
      if (!contentRef.current) return;

      const lineElements = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>('[data-line]')
      );

      if (lineElements.length === 0) {
        contentRef.current.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      let bestElement: HTMLElement | null = null;
      let minDiff = Infinity;
      let bestPrecedingElement: HTMLElement | null = null;
      let maxPrecedingLine = -1;

      for (const el of lineElements) {
        const lineAttr = el.getAttribute('data-line');
        if (!lineAttr) continue;
        const elLine = parseInt(lineAttr, 10);
        if (isNaN(elLine)) continue;

        if (elLine === targetLine) {
          bestElement = el;
          break;
        }

        if (elLine <= targetLine && elLine > maxPrecedingLine) {
          maxPrecedingLine = elLine;
          bestPrecedingElement = el;
        }

        const diff = Math.abs(elLine - targetLine);
        if (diff < minDiff) {
          minDiff = diff;
          bestElement = el;
        }
      }

      const targetEl = bestElement || bestPrecedingElement || lineElements[0];
      if (!targetEl) return;

      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const highlightClass =
        highlightType === 'error' ? 'synctex-highlight-error' : 'synctex-highlight-pulse';

      targetEl.classList.remove('synctex-highlight-pulse', 'synctex-highlight-error');
      // trigger reflow
      void targetEl.offsetWidth;
      targetEl.classList.add(highlightClass);

      setTimeout(() => {
        targetEl.classList.remove(highlightClass);
      }, 1800);

      try {
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(targetEl);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch {}
    },
    []
  );

  // Resolves the 1-indexed LaTeX line from any DOM node
  const getLineFromNode = useCallback((node: Node | null): number => {
    if (!node) return 1;
    const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    if (!el) return 1;

    const blockEl = el.closest<HTMLElement>('[data-line]');
    if (blockEl) {
      const lineAttr = blockEl.getAttribute('data-line');
      if (lineAttr) {
        const parsed = parseInt(lineAttr, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }

    const allLineEls = contentRef.current?.querySelectorAll<HTMLElement>('[data-line]');
    if (allLineEls && allLineEls.length > 0) {
      for (let i = allLineEls.length - 1; i >= 0; i--) {
        const item = allLineEls[i];
        if (el.compareDocumentPosition(item) & Node.DOCUMENT_POSITION_PRECEDING) {
          const parsed = parseInt(item.getAttribute('data-line') || '', 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
      const firstLine = parseInt(allLineEls[0].getAttribute('data-line') || '', 10);
      if (!isNaN(firstLine)) return firstLine;
    }

    return 1;
  }, []);

  // Computes the 1-indexed LaTeX line corresponding to the current caret or selection
  const getCurrentSelectionLine = useCallback((): number => {
    if (typeof window === 'undefined') return 1;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return 1;
    return getLineFromNode(sel.anchorNode);
  }, [getLineFromNode]);

  // Real-time broadcast of local cursor & selection to collaborators
  const broadcastLocalCursor = useCallback(() => {
    if (typeof window === 'undefined') return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !contentRef.current) return;
    if (!contentRef.current.contains(sel.anchorNode)) return;

    const startLine = getLineFromNode(sel.anchorNode);
    const startCol = sel.anchorOffset + 1;
    const endLine = getLineFromNode(sel.focusNode);
    const endCol = sel.focusOffset + 1;

    const isSelecting = !sel.isCollapsed && (startLine !== endLine || startCol !== endCol);

    editorCommandBus.dispatch({
      type: 'collab:cursor',
      userId: currentUserId || 'local-user',
      activeFileId: fileId,
      activeFile: filePath,
      cursor: {
        line: startLine,
        column: startCol,
        selection: isSelecting
          ? {
              startLineNumber: Math.min(startLine, endLine),
              startColumn: startLine <= endLine ? startCol : endCol,
              endLineNumber: Math.max(startLine, endLine),
              endColumn: startLine <= endLine ? endCol : startCol,
            }
          : undefined,
      },
    });
  }, [currentUserId, fileId, filePath, getLineFromNode]);

  // Precision Forward SyncTeX: Jump from Visual Mode cursor/element to PDF preview
  const triggerForwardSync = useCallback(
    (targetEl: HTMLElement | null) => {
      let resolvedLine = 1;

      const blockEl = targetEl ? targetEl.closest<HTMLElement>('[data-line]') : null;
      if (blockEl) {
        const lineAttr = blockEl.getAttribute('data-line');
        if (lineAttr) {
          const parsed = parseInt(lineAttr, 10);
          if (!isNaN(parsed)) resolvedLine = parsed;
        }
      } else {
        resolvedLine = getCurrentSelectionLine();
      }

      // Visual pulse feedback on source block
      const visualEl = blockEl || contentRef.current?.querySelector<HTMLElement>(`[data-line="${resolvedLine}"]`);
      if (visualEl) {
        visualEl.classList.remove('synctex-highlight-pulse');
        void visualEl.offsetWidth;
        visualEl.classList.add('synctex-highlight-pulse');
        setTimeout(() => {
          visualEl.classList.remove('synctex-highlight-pulse');
        }, 1200);
      }

      editorCommandBus.dispatch({
        type: 'synctex:forward',
        line: resolvedLine,
        column: 1,
      });
    },
    [getCurrentSelectionLine]
  );

  // Double-click on any element in Visual Editor surface jumps to PDF (Overleaf Parity)
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, button, [role="toolbar"], .latex-figure-badge')) return;
      triggerForwardSync(target);
    },
    [triggerForwardSync]
  );

  // Click delegation for interactive elements (Math, Protected blocks, Citations, Table Matrix)
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    // 0. Precision Forward SyncTeX: Ctrl+Click or Cmd+Click anywhere in the Visual Editor
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      triggerForwardSync(target);
      return;
    }

    // 1. Math Element Click
    const mathBlock = target.closest('.latex-math-block') as HTMLElement | null;
    const mathInline = target.closest('.latex-math-inline') as HTMLElement | null;
    const mathEl = mathBlock || mathInline;

    if (mathEl && contentRef.current?.contains(mathEl)) {
      e.preventDefault();
      e.stopPropagation();

      const rawEnc = mathEl.getAttribute('data-math') || '';
      const rawMath = decodeURIComponent(rawEnc);
      const isDisplay = !!mathBlock;

      setActiveMath({
        element: mathEl,
        isDisplay,
        initialMath: rawMath,
        currentMath: rawMath,
      });
      return;
    }

    // 2. Protected Block Edit Button Click
    const editBtn = target.closest('.latex-protected-edit-btn') as HTMLElement | null;
    const protectedBlock = target.closest('.latex-protected-block') as HTMLElement | null;

    if (editBtn && protectedBlock) {
      e.preventDefault();
      e.stopPropagation();
      const rawLatex = decodeURIComponent(protectedBlock.getAttribute('data-raw-latex') || '');
      setActiveProtected({ element: protectedBlock, rawLatex });
      setProtectedEditCode(rawLatex);
      return;
    }

    // 3. Citation Chip Click
    const citeChip = target.closest('.latex-citation-chip') as HTMLElement | null;
    if (citeChip) {
      e.preventDefault();
      e.stopPropagation();
      const citeKey = citeChip.getAttribute('data-cite');
      editorCommandBus.dispatch({
        type: 'dialog:open',
        dialog: 'citation-picker',
        payload: { initialQuery: citeKey },
      });
      return;
    }

    // 3b. Reference Chip Click (\ref{...}) -> Instant Jump to Target
    const refChip = target.closest('.latex-ref-chip') as HTMLElement | null;
    if (refChip) {
      e.preventDefault();
      e.stopPropagation();
      const refKey = refChip.getAttribute('data-ref');
      if (refKey && contentRef.current) {
        const encKey = encodeURIComponent(refKey);
        const targetEl =
          contentRef.current.querySelector<HTMLElement>(
            `[data-label="${encKey}"], [data-label="${refKey}"], .latex-label-token[data-label="${encKey}"], .latex-label-token[data-label="${refKey}"]`
          ) ||
          (refKey.startsWith('fig:') ? contentRef.current.querySelector<HTMLElement>('figure') : null) ||
          (refKey.startsWith('tab:') ? contentRef.current.querySelector<HTMLElement>('table') : null);

        if (targetEl) {
          const scrollTarget =
            (targetEl.closest('figure, table, h1, h2, h3, h4, .latex-math-block, [data-line]') as HTMLElement) ||
            targetEl;
          scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
          scrollTarget.classList.remove('synctex-highlight-pulse');
          void scrollTarget.offsetWidth;
          scrollTarget.classList.add('synctex-highlight-pulse');
          setTimeout(() => {
            scrollTarget.classList.remove('synctex-highlight-pulse');
          }, 1800);
        }
      }
      return;
    }

    // 4. Table Cell Click (Matrix Editor)
    const tableCell = target.closest('td, th') as HTMLTableCellElement | null;
    const tableEl = tableCell?.closest('table') as HTMLTableElement | null;

    if (tableCell && tableEl && contentRef.current?.contains(tableEl)) {
      const row = tableCell.closest('tr') as HTMLTableRowElement | null;
      const rowIndex = row ? Array.from(tableEl.rows).indexOf(row) : 0;
      const colIndex = row ? Array.from(row.cells).indexOf(tableCell) : 0;
      const totalRows = tableEl.rows.length;
      const totalCols = tableEl.rows[0]?.cells.length || 0;

      const rawCap = tableEl.getAttribute('data-caption') || '';
      const cap = rawCap ? decodeURIComponent(rawCap) : '';

      const rawLab = tableEl.getAttribute('data-label') || '';
      const lab = rawLab ? decodeURIComponent(rawLab) : '';

      const rawAlg = tableEl.getAttribute('data-align') || '';
      const algSpec = rawAlg ? decodeURIComponent(rawAlg) : '';
      const algTokens = algSpec.trim() ? algSpec.trim().split(/\s+/) : [];
      const colChar = algTokens[colIndex] || 'c';
      const colAlign: 'left' | 'center' | 'right' =
        colChar === 'l' ? 'left' : colChar === 'r' ? 'right' : 'center';

      const tableRect = tableEl.getBoundingClientRect();
      const cellRect = tableCell.getBoundingClientRect();
      let top = tableRect.top - 48;
      if (top < 60) {
        top = Math.max(60, cellRect.top - 48);
      }
      let left = Math.max(20, Math.min(window.innerWidth - 450, tableRect.left));

      setActiveTable({
        table: tableEl,
        cell: tableCell,
        rowIndex,
        colIndex,
        totalRows,
        totalCols,
        caption: cap,
        label: lab,
        columnAlignment: colAlign,
        position: { top, left },
      });
      return;
    }

    // 5. Figure Element Click (Interactive Figure GUI)
    const figureEl = target.closest('figure.latex-figure-wrapper') as HTMLElement | null;
    if (figureEl && contentRef.current?.contains(figureEl)) {
      const rawSrc = figureEl.getAttribute('data-src') || '';
      const src = rawSrc ? decodeURIComponent(rawSrc) : '';

      const rawWidth = figureEl.getAttribute('data-width') || '0.8\\linewidth';
      const width = rawWidth ? decodeURIComponent(rawWidth) : '0.8\\linewidth';

      const rawCap = figureEl.getAttribute('data-caption') || '';
      const caption = rawCap ? decodeURIComponent(rawCap) : '';

      const rawLab = figureEl.getAttribute('data-label') || '';
      const label = rawLab ? decodeURIComponent(rawLab) : '';

      const isCentering = figureEl.getAttribute('data-centering') !== 'false';
      const isStarred = figureEl.getAttribute('data-starred') === 'true';

      const figRect = figureEl.getBoundingClientRect();
      const top = Math.max(60, figRect.top - 46);
      const left = Math.max(20, Math.min(window.innerWidth - 450, figRect.left));

      setActiveFigure({
        element: figureEl,
        src,
        width,
        caption,
        label,
        isCentering,
        isStarred,
        position: { top, left },
      });
      setActiveTable(null);
      setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      return;
    }

    // Default: Clicked elsewhere inside editor surface
    setActiveTable(null);
    setActiveFigure(null);
  }, []);

  // Format execution (Bold, Italic, Headings, Lists, etc.)
  const executeVisualCommand = useCallback(
    (cmd: { command: string; level?: 1 | 2 | 3; contentHtml?: string }) => {
      if (readOnly) return;
      contentRef.current?.focus();

      switch (cmd.command) {
        case 'bold':
          document.execCommand('bold', false);
          break;
        case 'italic':
          document.execCommand('italic', false);
          break;
        case 'underline':
          document.execCommand('underline', false);
          break;
        case 'strike':
          document.execCommand('strikeThrough', false);
          break;
        case 'heading': {
          const tag = cmd.level === 2 ? 'h2' : cmd.level === 3 ? 'h3' : 'h1';
          document.execCommand('formatBlock', false, tag);
          break;
        }
        case 'bulletList':
          document.execCommand('insertUnorderedList', false);
          break;
        case 'orderedList':
          document.execCommand('insertOrderedList', false);
          break;
        case 'quote':
          document.execCommand('formatBlock', false, 'blockquote');
          break;
        case 'code':
          document.execCommand('formatBlock', false, 'pre');
          break;
        case 'insertMath': {
          const sampleMath = 'x^2 + y^2 = z^2';
          const rendered = renderMathHtml(sampleMath, false);
          const mathHtml = `<span class="latex-math-inline inline-block px-1 py-0.5 bg-muted/20 rounded cursor-pointer" data-math="${encodeURIComponent(sampleMath)}">${rendered}</span>&nbsp;`;
          document.execCommand('insertHTML', false, mathHtml);
          break;
        }
        case 'insertCitation':
          editorCommandBus.dispatch({ type: 'dialog:open', dialog: 'citation-picker' });
          break;
        default:
          break;
      }

      handleInput();
    },
    [handleInput, readOnly]
  );

  // Command Bus and Event Bus subscriptions
  useEffect(() => {
    const unsubCmd = editorCommandBus.subscribe('editor:visual-command', (cmd) => {
      executeVisualCommand(cmd);
    });

    const unsubEvent = EditorEventBus.on('flux:visual-command', (cmd) => {
      executeVisualCommand(cmd);
    });

    const unsubCite = EditorEventBus.on('flux:insert-citation', (payload) => {
      if (payload?.bibKey) {
        const chipHtml = `<span class="latex-citation-chip font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded inline-block cursor-pointer" data-cite="${payload.bibKey}">[@${payload.bibKey}]</span>&nbsp;`;
        document.execCommand('insertHTML', false, chipHtml);
        handleInput();
      }
    });

    return () => {
      unsubCmd();
      unsubEvent();
      unsubCite();
    };
  }, [executeVisualCommand, handleInput]);

  // Floating Selection Bubble Update logic (Medium / Notion / Overleaf style)
  const updateSelectionBubble = useCallback(() => {
    if (readOnly) {
      setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      return;
    }

    if (activeMath || activeProtected || activeTable || slashMenu.isOpen) {
      setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      return;
    }

    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      return;
    }

    const selectedText = sel.toString().trim();
    if (!selectedText) {
      setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      return;
    }

    const anchorNode = sel.anchorNode;
    const focusNode = sel.focusNode;
    if (
      !contentRef.current ||
      !anchorNode ||
      !focusNode ||
      !contentRef.current.contains(anchorNode) ||
      !contentRef.current.contains(focusNode)
    ) {
      setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      return;
    }

    const parentEl = (
      anchorNode.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode.parentElement
    ) as HTMLElement | null;

    if (parentEl?.closest('.latex-protected-block, pre, table, [data-math]')) {
      setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
      return;
    }

    try {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
        return;
      }

      let top = rect.top - 46;
      if (top < 60) {
        top = rect.bottom + 8;
      }
      const left = Math.max(80, Math.min(window.innerWidth - 80, rect.left + rect.width / 2));

      let bold = false;
      let italic = false;
      let underline = false;
      let strike = false;
      try {
        bold = document.queryCommandState('bold');
        italic = document.queryCommandState('italic');
        underline = document.queryCommandState('underline');
        strike = document.queryCommandState('strikeThrough');
      } catch {
        // Fallback for queryCommandState
      }

      const isInsideCode = Boolean(parentEl?.closest('code'));

      let blockType: BlockType = 'p';
      if (parentEl) {
        if (parentEl.closest('h1')) blockType = 'h1';
        else if (parentEl.closest('h2')) blockType = 'h2';
        else if (parentEl.closest('h3')) blockType = 'h3';
        else if (parentEl.closest('ul')) blockType = 'ul';
        else if (parentEl.closest('ol')) blockType = 'ol';
        else if (parentEl.closest('blockquote')) blockType = 'blockquote';
      }

      setSelectionBubble({
        isOpen: true,
        position: { top, left },
        activeFormats: {
          bold,
          italic,
          underline,
          strike,
          code: isInsideCode,
          blockType,
        },
      });
    } catch {
      setSelectionBubble((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
    }
  }, [readOnly, activeMath, activeProtected, activeTable, slashMenu.isOpen]);

  // Sync selection events with window requestAnimationFrame and broadcast local cursor
  useEffect(() => {
    let animFrameId: number;
    const handleSelectionChange = () => {
      if (typeof window !== 'undefined') {
        cancelAnimationFrame(animFrameId);
        animFrameId = window.requestAnimationFrame(() => {
          updateSelectionBubble();
          broadcastLocalCursor();
        });
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      cancelAnimationFrame(animFrameId);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [updateSelectionBubble, broadcastLocalCursor]);

  const handleBubbleFormat = useCallback(
    (format: 'bold' | 'italic' | 'underline' | 'strike' | 'code') => {
      if (readOnly) return;
      contentRef.current?.focus();

      if (format === 'code') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const codeAncestor = sel.anchorNode?.parentElement?.closest('code');
          if (codeAncestor) {
            const parent = codeAncestor.parentNode;
            while (codeAncestor.firstChild) {
              parent?.insertBefore(codeAncestor.firstChild, codeAncestor);
            }
            parent?.removeChild(codeAncestor);
          } else {
            const range = sel.getRangeAt(0);
            const codeNode = document.createElement('code');
            codeNode.className = 'px-1 py-0.5 rounded bg-muted font-mono text-sm';
            try {
              codeNode.appendChild(range.extractContents());
              range.insertNode(codeNode);
              sel.selectAllChildren(codeNode);
            } catch {
              // fallback
            }
          }
        }
      } else {
        const cmdMap: Record<string, string> = {
          bold: 'bold',
          italic: 'italic',
          underline: 'underline',
          strike: 'strikeThrough',
        };
        document.execCommand(cmdMap[format] || format, false);
      }

      handleInput();
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(updateSelectionBubble);
      }
    },
    [readOnly, handleInput, updateSelectionBubble]
  );

  const handleBubbleBlockTypeChange = useCallback(
    (type: BlockType) => {
      if (readOnly) return;
      contentRef.current?.focus();

      if (type === 'h1' || type === 'h2' || type === 'h3') {
        document.execCommand('formatBlock', false, type);
      } else if (type === 'p') {
        document.execCommand('formatBlock', false, 'p');
      } else if (type === 'ul') {
        document.execCommand('insertUnorderedList', false);
      } else if (type === 'ol') {
        document.execCommand('insertOrderedList', false);
      } else if (type === 'blockquote') {
        document.execCommand('formatBlock', false, 'blockquote');
      }

      handleInput();
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(updateSelectionBubble);
      }
    },
    [readOnly, handleInput, updateSelectionBubble]
  );

  const handleBubbleConvertToMath = useCallback(() => {
    if (readOnly) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const rawMath = sel.toString().trim() || 'x';
    const rendered = renderMathHtml(rawMath, false);
    const mathHtml = `<span class="latex-math-inline inline-block px-1 py-0.5 bg-muted/20 rounded cursor-pointer border border-transparent hover:border-primary/50 transition-colors" data-math="${encodeURIComponent(rawMath)}">${rendered}</span>&nbsp;`;

    document.execCommand('insertHTML', false, mathHtml);
    handleInput();
    setSelectionBubble((prev) => ({ ...prev, isOpen: false }));
  }, [readOnly, handleInput]);

  const handleBubbleConvertToCitation = useCallback(() => {
    if (readOnly) return;
    const sel = window.getSelection();
    const citeKey = sel ? sel.toString().trim() : '';

    if (citeKey && !citeKey.includes(' ') && citeKey.length < 50) {
      const chipHtml = `<span class="latex-citation-chip inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs cursor-pointer select-none" data-cite="${citeKey}">[@${citeKey}]</span>&nbsp;`;
      document.execCommand('insertHTML', false, chipHtml);
      handleInput();
      setSelectionBubble((prev) => ({ ...prev, isOpen: false }));
    } else {
      editorCommandBus.dispatch({
        type: 'dialog:open',
        dialog: 'citation-picker',
        payload: { initialQuery: citeKey },
      });
      setSelectionBubble((prev) => ({ ...prev, isOpen: false }));
    }
  }, [readOnly, handleInput]);

  // Register Active Editor Engine Adapter
  useEffect(() => {
    const engine = {
      getContent: () => {
        if (!contentRef.current) return originalLatexRef.current;
        return htmlToLatex(contentRef.current.innerHTML, originalLatexRef.current);
      },
      setContent: (text: string) => {
        originalLatexRef.current = text;
        if (contentRef.current) {
          contentRef.current.innerHTML = latexToHtml(text);
        }
      },
      insertText: (text: string) => {
        document.execCommand('insertText', false, text);
        handleInput();
      },
      getSelectedText: () => {
        const sel = window.getSelection();
        return sel ? sel.toString() : '';
      },
      jumpToLine: (line: number, highlight?: 'error' | 'synctex') => {
        handleJumpToLine(line, highlight);
      },
      scrollToLine: (line: number, smooth: boolean = true) => {
        const container = containerRef.current;
        if (!container) return;
        const targetEl = container.querySelector(`[data-line="${line}"]`) as HTMLElement;
        if (targetEl) {
          const targetTop = targetEl.offsetTop;
          container.scrollTo({
            top: Math.max(0, targetTop - 30),
            behavior: smooth ? 'smooth' : 'auto',
          });
        }
      },
      getVisibleLine: () => {
        const container = containerRef.current;
        if (!container) return 1;
        const elements = container.querySelectorAll('[data-line]');
        const scrollTop = container.scrollTop;
        for (const el of elements) {
          const htmlEl = el as HTMLElement;
          if (htmlEl.offsetTop + htmlEl.offsetHeight >= scrollTop + 30) {
            const l = parseInt(htmlEl.getAttribute('data-line') || '', 10);
            if (!isNaN(l)) return l;
          }
        }
        return 1;
      },
      getScrollContainer: () => containerRef.current,
      getCursorPosition: () => ({
        line: getCurrentSelectionLine(),
        column: 1,
      }),
    };

    setActiveEditorEngine(engine);

    return () => {
      setActiveEditorEngine(null);
    };
  }, [handleInput, handleJumpToLine, getCurrentSelectionLine]);

  // Subscribe to editor:jump-to-line for Reverse SyncTeX & Outline/Compiler navigation
  useEffect(() => {
    const unsub = editorCommandBus.subscribe('editor:jump-to-line', (cmd) => {
      handleJumpToLine(cmd.line, cmd.highlight || 'synctex');
    });
    return unsub;
  }, [handleJumpToLine]);

  // Subscribe to editor:scroll-to-line for Synchronized Dual Scrolling
  useEffect(() => {
    const unsub = editorCommandBus.subscribe('editor:scroll-to-line', (cmd) => {
      const container = containerRef.current;
      if (!container) return;
      const targetEl = container.querySelector(`[data-line="${cmd.line}"]`) as HTMLElement;
      if (targetEl) {
        const targetTop = targetEl.offsetTop;
        container.scrollTo({
          top: Math.max(0, targetTop - 30),
          behavior: cmd.smooth !== false ? 'smooth' : 'auto',
        });
      }
    });
    return unsub;
  }, []);

  // Synchronized Dual-Scroll Producer (Visual Mode -> PDF Preview)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let scrollRafId: number | null = null;
    let lastDispatchedLine = -1;

    const handleScroll = () => {
      if (scrollRafId !== null) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        if (!containerRef.current) return;
        const elements = containerRef.current.querySelectorAll('[data-line]');
        const scrollTop = containerRef.current.scrollTop;
        for (const el of elements) {
          const htmlEl = el as HTMLElement;
          if (htmlEl.offsetTop + htmlEl.offsetHeight >= scrollTop + 30) {
            const l = parseInt(htmlEl.getAttribute('data-line') || '', 10);
            if (!isNaN(l) && l !== lastDispatchedLine) {
              lastDispatchedLine = l;
              editorCommandBus.dispatch({ type: 'sync:editor-scrolled', line: l });
              break;
            }
          }
        }
      });
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      if (scrollRafId !== null) cancelAnimationFrame(scrollRafId);
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Handle Slash Command Selection
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
          const algoLatex = '\\begin{algorithm}[H]\n  \\caption{Algorithm description}\n  \\begin{algorithmic}[1]\n    \\STATE Initialize state\n    \\WHILE{condition}\n      \\STATE Compute step\n    \\ENDWHILE\n  \\end{algorithmic}\n\\end{algorithm}';
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
          const codeLatex = '\\begin{lstlisting}[language=Python]\n# Python Code Snippet\ndef solve():\n    return 42\n\\end{lstlisting}';
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
    [handleInput]
  );

  // Keyboard Shortcuts (Ctrl+Shift+V to toggle back to Source, Ctrl+B, Slash menu, etc.)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // 1. Slash Menu Navigation
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
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashMenu((prev) => ({
          ...prev,
          selectedIndex:
            filteredSlashCommands.length > 0
              ? (prev.selectedIndex - 1 + filteredSlashCommands.length) % filteredSlashCommands.length
              : 0,
        }));
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredSlashCommands.length > 0) {
          const selected = filteredSlashCommands[slashMenu.selectedIndex] || filteredSlashCommands[0];
          handleSelectSlashCommand(selected);
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenu((prev) => ({ ...prev, isOpen: false }));
        return;
      }
    }

    if (e.key === 'Escape') {
      if (selectionBubble.isOpen) {
        e.preventDefault();
        setSelectionBubble((prev) => ({ ...prev, isOpen: false }));
        return;
      }
      if (activeFigure) {
        e.preventDefault();
        setActiveFigure(null);
        return;
      }
      if (activeTable) {
        e.preventDefault();
        setActiveTable(null);
        return;
      }
    }

    // 2. Global Shortcuts
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
      e.preventDefault();
      toggleEditorMode();
      return;
    }

    if (modKey && (e.key === 'm' || e.key === 'M')) {
      e.preventDefault();
      executeVisualCommand({ command: 'insertMath' });
      return;
    }

    // Mod-Alt-j or Ctrl-Alt-j: Forward SyncTeX shortcut (Overleaf parity)
    if (modKey && e.altKey && (e.key === 'j' || e.key === 'J')) {
      e.preventDefault();
      triggerForwardSync(null);
      return;
    }

    // 3. Trigger Slash Menu on '/'
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
  };

  // Keyboard Up listener to detect query changes after typing '/'
  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Escape') {
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

  // Math Editor Live Preview
  const mathLivePreviewHtml = useMemo(() => {
    if (!activeMath?.currentMath) return '';
    return renderMathHtml(activeMath.currentMath, activeMath.isDisplay);
  }, [activeMath?.currentMath, activeMath?.isDisplay]);

  // Save Math changes back to DOM and LaTeX
  const handleSaveMath = () => {
    if (!activeMath) return;
    const { element, currentMath, isDisplay } = activeMath;

    if (!currentMath.trim()) {
      // If cleared, remove math element
      element.remove();
    } else {
      const renderedHtml = renderMathHtml(currentMath.trim(), isDisplay);
      element.innerHTML = renderedHtml;
      element.setAttribute('data-math', encodeURIComponent(currentMath.trim()));
    }

    setActiveMath(null);
    syncHtmlToLatex();
  };

  // Delete Math formula
  const handleDeleteMath = () => {
    if (!activeMath) return;
    activeMath.element.remove();
    setActiveMath(null);
    syncHtmlToLatex();
  };

  // Insert math symbol/template from quick palette into active formula
  const handleInsertMathSymbol = useCallback(
    (symbolSnippet: string) => {
      if (!activeMath) return;
      const input = mathInputRef.current;

      if (input) {
        const start = input.selectionStart ?? input.value.length;
        const end = input.selectionEnd ?? input.value.length;
        const prev = activeMath.currentMath;
        const next = prev.substring(0, start) + symbolSnippet + prev.substring(end);
        setActiveMath((s) => (s ? { ...s, currentMath: next } : null));

        // Restore focus and position cursor right after the inserted snippet
        setTimeout(() => {
          input.focus();
          const newPos = start + symbolSnippet.length;
          input.setSelectionRange(newPos, newPos);
        }, 0);
      } else {
        setActiveMath((s) =>
          s
            ? {
                ...s,
                currentMath: s.currentMath ? `${s.currentMath} ${symbolSnippet}` : symbolSnippet,
              }
            : null
        );
      }
    },
    [activeMath]
  );

  // Save Protected Block changes
  const handleSaveProtectedBlock = () => {
    if (!activeProtected) return;
    const { element } = activeProtected;
    const cleanLatex = protectedEditCode.trim();

    element.setAttribute('data-raw-latex', encodeURIComponent(cleanLatex));
    const preEl = element.querySelector('pre');
    if (preEl) {
      preEl.textContent = cleanLatex;
    }

    setActiveProtected(null);
    syncHtmlToLatex();
  };

  // Helper to safely mutate alignment tokens on <table>
  const updateTableAlignmentSpec = useCallback(
    (table: HTMLTableElement, mutator: (tokens: string[]) => void) => {
      const rawAlign = table.getAttribute('data-align') || '';
      const alignSpec = rawAlign ? decodeURIComponent(rawAlign) : '';
      let tokens = alignSpec.trim() ? alignSpec.trim().split(/\s+/) : [];

      mutator(tokens);

      const maxCols = table.rows[0]?.cells.length || 0;
      while (tokens.length < maxCols) tokens.push('c');
      if (tokens.length > maxCols) tokens = tokens.slice(0, maxCols);

      table.setAttribute('data-align', encodeURIComponent(tokens.join(' ')));
    },
    []
  );

  // Table Row Operations
  const handleAddRowAbove = useCallback(() => {
    if (!activeTable) return;
    const { table, rowIndex } = activeTable;
    const totalCols = table.rows[0]?.cells.length || 2;

    const targetRow = table.rows[rowIndex];
    const parent = targetRow?.parentElement || table;
    const newRow = document.createElement('tr');
    for (let c = 0; c < totalCols; c++) {
      const td = document.createElement('td');
      td.className = 'p-2 border border-border';
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      td.appendChild(p);
      newRow.appendChild(td);
    }

    if (targetRow) {
      parent.insertBefore(newRow, targetRow);
    } else {
      parent.appendChild(newRow);
    }

    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            totalRows: table.rows.length,
            rowIndex: rowIndex + 1,
          }
        : null
    );

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex]);

  const handleAddRowBelow = useCallback(() => {
    if (!activeTable) return;
    const { table, rowIndex } = activeTable;
    const totalCols = table.rows[0]?.cells.length || 2;

    const targetRow = table.rows[rowIndex];
    const parent = targetRow?.parentElement || table;
    const newRow = document.createElement('tr');
    for (let c = 0; c < totalCols; c++) {
      const td = document.createElement('td');
      td.className = 'p-2 border border-border';
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      td.appendChild(p);
      newRow.appendChild(td);
    }

    if (targetRow && targetRow.parentElement?.tagName.toLowerCase() === 'thead') {
      const tbody = table.querySelector('tbody');
      if (tbody) {
        tbody.insertBefore(newRow, tbody.firstChild);
      } else {
        table.appendChild(newRow);
      }
    } else if (targetRow && targetRow.nextElementSibling) {
      parent.insertBefore(newRow, targetRow.nextElementSibling);
    } else {
      parent.appendChild(newRow);
    }

    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            totalRows: table.rows.length,
          }
        : null
    );

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex]);

  const handleDeleteRow = useCallback(() => {
    if (!activeTable) return;
    const { table, rowIndex } = activeTable;

    if (table.rows.length <= 1) {
      table.remove();
      setActiveTable(null);
      syncHtmlToLatex();
      return;
    }

    const targetRow = table.rows[rowIndex];
    if (targetRow) {
      targetRow.remove();
    }

    const nextRowIndex = Math.min(rowIndex, table.rows.length - 1);
    const nextRow = table.rows[nextRowIndex];
    const nextCell = nextRow ? (nextRow.cells[activeTable.colIndex] || nextRow.cells[0]) : null;

    if (nextCell) {
      setActiveTable((prev) =>
        prev
          ? {
              ...prev,
              cell: nextCell,
              rowIndex: nextRowIndex,
              totalRows: table.rows.length,
            }
          : null
      );
    } else {
      setActiveTable(null);
    }

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex]);

  // Table Column Operations
  const handleAddColumnLeft = useCallback(() => {
    if (!activeTable) return;
    const { table, colIndex } = activeTable;

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      const isHead =
        row.parentElement?.tagName.toLowerCase() === 'thead' || row.querySelector('th') !== null;
      const cellEl = document.createElement(isHead ? 'th' : 'td');
      cellEl.className = isHead
        ? 'p-2 border border-border bg-muted/40 font-semibold'
        : 'p-2 border border-border';
      const p = document.createElement('p');
      p.innerHTML = isHead ? `Header ${colIndex + 1}` : '<br>';
      cellEl.appendChild(p);

      if (colIndex < row.cells.length) {
        row.insertBefore(cellEl, row.cells[colIndex]);
      } else {
        row.appendChild(cellEl);
      }
    }

    updateTableAlignmentSpec(table, (tokens) => {
      tokens.splice(colIndex, 0, 'c');
    });

    const totalCols = table.rows[0]?.cells.length || 0;
    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            totalCols,
            colIndex: colIndex + 1,
          }
        : null
    );

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex, updateTableAlignmentSpec]);

  const handleAddColumnRight = useCallback(() => {
    if (!activeTable) return;
    const { table, colIndex } = activeTable;
    const insertIndex = colIndex + 1;

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      const isHead =
        row.parentElement?.tagName.toLowerCase() === 'thead' || row.querySelector('th') !== null;
      const cellEl = document.createElement(isHead ? 'th' : 'td');
      cellEl.className = isHead
        ? 'p-2 border border-border bg-muted/40 font-semibold'
        : 'p-2 border border-border';
      const p = document.createElement('p');
      p.innerHTML = isHead ? `Header ${insertIndex + 1}` : '<br>';
      cellEl.appendChild(p);

      if (insertIndex < row.cells.length) {
        row.insertBefore(cellEl, row.cells[insertIndex]);
      } else {
        row.appendChild(cellEl);
      }
    }

    updateTableAlignmentSpec(table, (tokens) => {
      tokens.splice(insertIndex, 0, 'c');
    });

    const totalCols = table.rows[0]?.cells.length || 0;
    setActiveTable((prev) =>
      prev
        ? {
            ...prev,
            totalCols,
          }
        : null
    );

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex, updateTableAlignmentSpec]);

  const handleDeleteColumn = useCallback(() => {
    if (!activeTable) return;
    const { table, colIndex } = activeTable;
    const totalCols = table.rows[0]?.cells.length || 0;

    if (totalCols <= 1) {
      table.remove();
      setActiveTable(null);
      syncHtmlToLatex();
      return;
    }

    for (let r = 0; r < table.rows.length; r++) {
      const row = table.rows[r];
      if (row.cells[colIndex]) {
        row.cells[colIndex].remove();
      }
    }

    updateTableAlignmentSpec(table, (tokens) => {
      if (colIndex < tokens.length) {
        tokens.splice(colIndex, 1);
      }
    });

    const newTotalCols = table.rows[0]?.cells.length || 0;
    const nextColIndex = Math.min(colIndex, newTotalCols - 1);
    const nextRow = table.rows[activeTable.rowIndex] || table.rows[0];
    const nextCell = nextRow ? nextRow.cells[nextColIndex] : null;

    if (nextCell) {
      setActiveTable((prev) =>
        prev
          ? {
              ...prev,
              cell: nextCell,
              colIndex: nextColIndex,
              totalCols: newTotalCols,
            }
          : null
      );
    } else {
      setActiveTable(null);
    }

    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex, updateTableAlignmentSpec]);

  // Table Column Alignment (l / c / r)
  const handleAlignColumn = useCallback(
    (align: 'left' | 'center' | 'right') => {
      if (!activeTable) return;
      const { table, colIndex } = activeTable;
      const char = align === 'left' ? 'l' : align === 'right' ? 'r' : 'c';

      updateTableAlignmentSpec(table, (tokens) => {
        tokens[colIndex] = char;
      });

      const alignClass =
        align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center';
      for (let r = 0; r < table.rows.length; r++) {
        const c = table.rows[r].cells[colIndex];
        if (c) {
          c.classList.remove('text-left', 'text-center', 'text-right');
          c.classList.add(alignClass);
        }
      }

      setActiveTable((prev) =>
        prev
          ? {
              ...prev,
              columnAlignment: align,
            }
          : null
      );

      syncHtmlToLatex();
    },
    [activeTable, syncHtmlToLatex, updateTableAlignmentSpec]
  );

  // Table Metadata (Caption and Label)
  const handleUpdateMetadata = useCallback(
    (caption: string, label: string) => {
      if (!activeTable) return;
      const { table } = activeTable;

      if (caption) {
        table.setAttribute('data-caption', encodeURIComponent(caption));
      } else {
        table.removeAttribute('data-caption');
      }

      if (label) {
        table.setAttribute('data-label', encodeURIComponent(label));
      } else {
        table.removeAttribute('data-label');
      }

      setActiveTable((prev) =>
        prev
          ? {
              ...prev,
              caption,
              label,
            }
          : null
      );

      syncHtmlToLatex();
    },
    [activeTable, syncHtmlToLatex]
  );

  // Delete Entire Table
  const handleDeleteTable = useCallback(() => {
    if (!activeTable) return;
    activeTable.table.remove();
    setActiveTable(null);
    syncHtmlToLatex();
  }, [activeTable, syncHtmlToLatex]);

  // ── Figure Operations (Overleaf Parity) ──────────────────────────────────
  const handleChangeFigureWidth = useCallback(
    (newWidth: string) => {
      if (!activeFigure || !contentRef.current) return;
      activeFigure.element.setAttribute('data-width', encodeURIComponent(newWidth));

      // Update badge
      const badge = activeFigure.element.querySelector('.latex-figure-badge span.font-mono');
      if (badge) badge.textContent = newWidth;

      // Update img css width
      const img = activeFigure.element.querySelector('img') as HTMLImageElement | null;
      if (img) {
        let cssWidth = '80%';
        if (newWidth.includes('\\textwidth') || newWidth.includes('\\linewidth')) {
          const numMatch = newWidth.match(/([0-9.]+)/);
          if (numMatch) {
            const pct = Math.round(parseFloat(numMatch[1]) * 100);
            cssWidth = `${Math.min(100, Math.max(10, pct))}%`;
          } else {
            cssWidth = '100%';
          }
        } else if (newWidth.includes('%')) {
          cssWidth = newWidth;
        }
        img.style.width = cssWidth;
      }

      setActiveFigure((prev) => (prev ? { ...prev, width: newWidth } : null));
      syncHtmlToLatex();
    },
    [activeFigure, syncHtmlToLatex]
  );

  const handleChangeFigureImage = useCallback(
    (newSrc: string) => {
      if (!activeFigure || !contentRef.current) return;
      activeFigure.element.setAttribute('data-src', encodeURIComponent(newSrc));

      const filename = newSrc.split('/').pop() || newSrc;
      const titleSpan = activeFigure.element.querySelector('.latex-figure-badge span.opacity-75');
      if (titleSpan) titleSpan.textContent = filename;

      const img = activeFigure.element.querySelector('img') as HTMLImageElement | null;
      if (img) {
        img.src = newSrc;
        img.alt = activeFigure.caption || filename;
      }

      setActiveFigure((prev) => (prev ? { ...prev, src: newSrc } : null));
      syncHtmlToLatex();
    },
    [activeFigure, syncHtmlToLatex]
  );

  const handleUpdateFigureMetadata = useCallback(
    (newCaption: string, newLabel: string) => {
      if (!activeFigure || !contentRef.current) return;
      activeFigure.element.setAttribute('data-caption', encodeURIComponent(newCaption));
      activeFigure.element.setAttribute('data-label', encodeURIComponent(newLabel));

      // Update caption text
      const capText = activeFigure.element.querySelector('.latex-figure-caption-text');
      if (capText) capText.textContent = newCaption || 'No caption';

      // Update label badge in header
      const headerDiv = activeFigure.element.querySelector('.latex-figure-badge > div.flex');
      if (headerDiv) {
        let labelSpan = headerDiv.querySelector('span.text-primary.font-mono');
        if (newLabel) {
          if (!labelSpan) {
            labelSpan = document.createElement('span');
            labelSpan.className = 'text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono';
            headerDiv.appendChild(labelSpan);
          }
          labelSpan.textContent = newLabel;
        } else if (labelSpan) {
          labelSpan.remove();
        }
      }

      setActiveFigure((prev) => (prev ? { ...prev, caption: newCaption, label: newLabel } : null));
      syncHtmlToLatex();
    },
    [activeFigure, syncHtmlToLatex]
  );

  const handleToggleFigureCentering = useCallback(() => {
    if (!activeFigure || !contentRef.current) return;
    const nextCentering = !activeFigure.isCentering;
    activeFigure.element.setAttribute('data-centering', nextCentering ? 'true' : 'false');
    setActiveFigure((prev) => (prev ? { ...prev, isCentering: nextCentering } : null));
    syncHtmlToLatex();
  }, [activeFigure, syncHtmlToLatex]);

  const handleToggleFigureStarred = useCallback(() => {
    if (!activeFigure || !contentRef.current) return;
    const nextStarred = !activeFigure.isStarred;
    activeFigure.element.setAttribute('data-starred', nextStarred ? 'true' : 'false');
    setActiveFigure((prev) => (prev ? { ...prev, isStarred: nextStarred } : null));
    syncHtmlToLatex();
  }, [activeFigure, syncHtmlToLatex]);

  const handleDeleteFigure = useCallback(() => {
    if (!activeFigure || !contentRef.current) return;
    activeFigure.element.remove();
    setActiveFigure(null);
    syncHtmlToLatex();
  }, [activeFigure, syncHtmlToLatex]);

  // Click outside to dismiss table and figure toolbars
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        activeTable &&
        !target.closest('table') &&
        !target.closest('[role="toolbar"]')
      ) {
        setActiveTable(null);
      }
      if (
        activeFigure &&
        !target.closest('figure.latex-figure-wrapper') &&
        !target.closest('[role="toolbar"]')
      ) {
        setActiveFigure(null);
      }
    };

    window.addEventListener('mousedown', handleGlobalClick);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
    };
  }, [activeTable, activeFigure]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 h-full w-full overflow-y-auto bg-background text-foreground select-text font-serif"
    >
      {/* ── Real-Time Collaborator Cursors & Selection Overlays (Overleaf Parity) ── */}
      <VisualCollaboratorCursors
        contentRef={contentRef}
        containerRef={containerRef}
        fileId={fileId}
        filePath={filePath}
        collaborators={collaborators}
        currentUserId={currentUserId}
      />

      {/* ── Document Container ── */}
      <div className="max-w-4xl mx-auto px-8 py-10 min-h-full">
        <div
          ref={contentRef}
          contentEditable={!readOnly}
          suppressContentEditableWarning
          onInput={handleInput}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onMouseUp={() => {
            if (typeof window !== 'undefined') {
              window.requestAnimationFrame(updateSelectionBubble);
            }
          }}
          className={cn(
            'visual-editor-surface outline-none prose prose-neutral dark:prose-invert max-w-none',
            'focus:ring-0 leading-relaxed font-serif text-[15px]',
            '[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:font-sans [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:border-b [&_h1]:pb-2',
            '[&_h2]:text-xl [&_h2]:font-semibold [&_h2]:font-sans [&_h2]:mt-6 [&_h2]:mb-3',
            '[&_h3]:text-lg [&_h3]:font-medium [&_h3]:font-sans [&_h3]:mt-4 [&_h3]:mb-2',
            '[&_p]:my-3.5 [&_p]:leading-7',
            '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3',
            '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3',
            '[&_li]:my-1',
            '[&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4',
            '[&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:border [&_table]:border-border',
            '[&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:bg-muted/40 [&_th]:font-semibold [&_th]:text-left',
            '[&_td]:border [&_td]:border-border [&_td]:p-2',
            '[&_.latex-citation-chip]:hover:bg-primary/20 [&_.latex-citation-chip]:cursor-pointer [&_.latex-citation-chip]:transition-colors',
            '[&_.latex-math-block]:hover:ring-1 [&_.latex-math-block]:hover:ring-primary/40 [&_.latex-math-block]:transition-all',
            '[&_.latex-math-inline]:hover:ring-1 [&_.latex-math-inline]:hover:ring-primary/40 [&_.latex-math-inline]:transition-all'
          )}
        />
      </div>

      {/* ── Interactive Inline Math Editor Card ── */}
      {activeMath && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-card border shadow-2xl rounded-xl p-5 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <Sigma className="size-4 text-primary" />
                <span className="font-semibold text-sm">
                  Edit LaTeX Math ({activeMath.isDisplay ? 'Equation Block' : 'Inline Formula'})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={showSymbolPalette ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowSymbolPalette((prev) => !prev)}
                  className="h-7 px-2 text-xs gap-1.5 cursor-pointer font-medium"
                  title="Toggle Quick-Symbol Palette"
                  aria-label="Toggle math symbol palette"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  <span>{showSymbolPalette ? 'Hide Symbols' : 'Quick Symbols'}</span>
                </Button>
                <button
                  type="button"
                  onClick={() => setActiveMath(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Close math editor"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* KaTeX Quick-Symbol & Template Palette */}
            {showSymbolPalette && (
              <VisualMathSymbolPalette onInsertSymbol={handleInsertMathSymbol} />
            )}

            {/* LaTeX input */}
            <div className="space-y-1.5">
              <label htmlFor="latex-math-input-source" className="text-xs font-mono text-muted-foreground">
                LaTeX Equation Source:
              </label>
              <Input
                id="latex-math-input-source"
                ref={mathInputRef}
                aria-label="LaTeX equation input"
                value={activeMath.currentMath}
                onChange={(e) =>
                  setActiveMath((prev) => (prev ? { ...prev, currentMath: e.target.value } : null))
                }
                autoFocus
                placeholder="e.g. \int_{0}^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}"
                className="font-mono text-sm h-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSaveMath();
                  } else if (e.key === 'Escape') {
                    setActiveMath(null);
                  }
                }}
              />
            </div>

            {/* Real-time KaTeX Live Preview */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Eye className="size-3.5" />
                <span>Live Preview:</span>
              </span>
              <div
                className="min-h-16 p-4 rounded-lg bg-muted/40 border flex items-center justify-center overflow-x-auto text-base"
                dangerouslySetInnerHTML={{ __html: mathLivePreviewHtml || '<span class="text-xs text-muted-foreground italic">Type formula above to preview...</span>' }}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteMath}
                className="text-destructive hover:bg-destructive/10 text-xs gap-1.5 cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Delete Formula</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveMath(null)}
                  className="text-xs cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveMath}
                  className="text-xs gap-1.5 cursor-pointer font-medium"
                >
                  <Check className="size-3.5" />
                  <span>Apply Changes</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Protected Block LaTeX Editor Modal ── */}
      {activeProtected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-card border shadow-2xl rounded-xl p-5 w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <Code2 className="size-4 text-primary" />
                <span className="font-semibold text-sm">Edit Protected LaTeX Environment</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveProtected(null)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground">Raw LaTeX Environment:</label>
              <textarea
                aria-label="Raw LaTeX Environment"
                value={protectedEditCode}
                onChange={(e) => setProtectedEditCode(e.target.value)}
                rows={10}
                className="w-full font-mono text-xs p-3 rounded-lg border bg-muted/20 outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveProtected(null)}
                className="text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveProtectedBlock}
                className="text-xs gap-1.5 cursor-pointer"
              >
                <Check className="size-3.5" />
                <span>Save Environment</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slash Command Menu Popup ── */}
      <VisualSlashCommandMenu
        isOpen={slashMenu.isOpen}
        query={slashMenu.query}
        position={slashMenu.position}
        selectedIndex={slashMenu.selectedIndex}
        onSelect={handleSelectSlashCommand}
        onClose={() => setSlashMenu((prev) => ({ ...prev, isOpen: false }))}
        onHoverIndex={(idx) => setSlashMenu((prev) => ({ ...prev, selectedIndex: idx }))}
      />

      {/* ── Floating Table Matrix Toolbar ── */}
      {activeTable && (
        <VisualTableToolbar
          position={activeTable.position}
          caption={activeTable.caption}
          label={activeTable.label}
          columnAlignment={activeTable.columnAlignment}
          rowIndex={activeTable.rowIndex}
          colIndex={activeTable.colIndex}
          totalRows={activeTable.totalRows}
          totalCols={activeTable.totalCols}
          onAddRowAbove={handleAddRowAbove}
          onAddRowBelow={handleAddRowBelow}
          onDeleteRow={handleDeleteRow}
          onAddColumnLeft={handleAddColumnLeft}
          onAddColumnRight={handleAddColumnRight}
          onDeleteColumn={handleDeleteColumn}
          onAlignColumn={handleAlignColumn}
          onUpdateMetadata={handleUpdateMetadata}
          onDeleteTable={handleDeleteTable}
          onClose={() => setActiveTable(null)}
        />
      )}

      {/* ── Floating Figure Toolbar (Overleaf Parity) ── */}
      {activeFigure && (
        <VisualFigureToolbar
          position={activeFigure.position}
          src={activeFigure.src}
          width={activeFigure.width}
          caption={activeFigure.caption}
          label={activeFigure.label}
          isCentering={activeFigure.isCentering}
          isStarred={activeFigure.isStarred}
          projectImageFiles={projectImageFiles}
          onChangeWidth={handleChangeFigureWidth}
          onChangeImage={handleChangeFigureImage}
          onUpdateMetadata={handleUpdateFigureMetadata}
          onToggleCentering={handleToggleFigureCentering}
          onToggleStarred={handleToggleFigureStarred}
          onDeleteFigure={handleDeleteFigure}
          onClose={() => setActiveFigure(null)}
        />
      )}

      {/* ── Floating Selection Bubble Menu (Medium / Notion / Overleaf Parity) ── */}
      {selectionBubble.isOpen && (
        <VisualSelectionBubbleMenu
          position={selectionBubble.position}
          activeFormats={selectionBubble.activeFormats}
          onFormat={handleBubbleFormat}
          onBlockTypeChange={handleBubbleBlockTypeChange}
          onConvertToMath={handleBubbleConvertToMath}
          onConvertToCitation={handleBubbleConvertToCitation}
          onSyncToPdf={() => triggerForwardSync(null)}
          onClose={() => setSelectionBubble((prev) => ({ ...prev, isOpen: false }))}
        />
      )}

      {/* ── Interactive In-Text Hover Card for Citations and Cross-References (Overleaf Parity) ── */}
      <VisualReferenceHoverCard
        contentRef={contentRef}
        containerRef={containerRef}
      />
    </div>
  );
}

export default VisualEditorView;
