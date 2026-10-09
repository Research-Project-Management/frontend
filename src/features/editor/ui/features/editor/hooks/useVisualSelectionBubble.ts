'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { renderMathHtml } from '@/features/editor/domain/latex/latex-converter';
import type { BlockType } from '../VisualSelectionBubbleMenu';

export interface SelectionBubbleState {
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
}

interface UseVisualSelectionBubbleOptions {
  contentRef: React.RefObject<HTMLDivElement | null>;
  readOnly?: boolean;
  hasActiveModalOrToolbar?: boolean;
  handleInput: () => void;
  broadcastLocalCursor: () => void;
}

export function useVisualSelectionBubble({
  contentRef,
  readOnly = false,
  hasActiveModalOrToolbar = false,
  handleInput,
  broadcastLocalCursor,
}: UseVisualSelectionBubbleOptions) {
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubbleState>({
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

  // Floating Selection Bubble Update logic (Medium / Notion / Overleaf style)
  const updateSelectionBubble = useCallback(() => {
    if (readOnly || hasActiveModalOrToolbar) {
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
  }, [readOnly, hasActiveModalOrToolbar, contentRef]);

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
    [readOnly, contentRef, handleInput, updateSelectionBubble]
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
    [readOnly, contentRef, handleInput, updateSelectionBubble]
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

  return {
    selectionBubble,
    setSelectionBubble,
    updateSelectionBubble,
    handleBubbleFormat,
    handleBubbleBlockTypeChange,
    handleBubbleConvertToMath,
    handleBubbleConvertToCitation,
  };
}
