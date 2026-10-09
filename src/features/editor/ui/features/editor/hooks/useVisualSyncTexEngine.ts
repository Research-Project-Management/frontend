'use client';

import React, { useCallback, useEffect } from 'react';
import {
  editorCommandBus,
  setActiveEditorEngine,
} from '@/features/editor/coordinators/command-bus';
import {
  latexToHtml,
  htmlToLatex,
} from '@/features/editor/domain/latex/latex-converter';

interface UseVisualSyncTexEngineOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  originalLatexRef: React.MutableRefObject<string>;
  fileId?: string;
  filePath?: string;
  currentUserId?: string;
  readOnly?: boolean;
  handleInput: () => void;
}

export function useVisualSyncTexEngine({
  containerRef,
  contentRef,
  originalLatexRef,
  fileId,
  filePath = 'main.tex',
  currentUserId,
  readOnly = false,
  handleInput,
}: UseVisualSyncTexEngineOptions) {
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
      } catch {
        // Selection range fallback
      }
    },
    [contentRef]
  );

  // Resolves the 1-indexed LaTeX line from any DOM node
  const getLineFromNode = useCallback(
    (node: Node | null): number => {
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
    },
    [contentRef]
  );

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
  }, [contentRef, currentUserId, fileId, filePath, getLineFromNode]);

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
      const visualEl =
        blockEl || contentRef.current?.querySelector<HTMLElement>(`[data-line="${resolvedLine}"]`);
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
    [contentRef, getCurrentSelectionLine]
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
  }, [
    containerRef,
    contentRef,
    getCurrentSelectionLine,
    handleInput,
    handleJumpToLine,
    originalLatexRef,
  ]);

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
  }, [containerRef]);

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
  }, [containerRef]);

  return {
    handleJumpToLine,
    getLineFromNode,
    getCurrentSelectionLine,
    broadcastLocalCursor,
    triggerForwardSync,
    handleDoubleClick,
  };
}
