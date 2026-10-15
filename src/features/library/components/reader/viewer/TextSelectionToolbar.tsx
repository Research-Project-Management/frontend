'use client';

import React, { useState } from 'react';
import { StickyNote, Check, Quote, Copy } from 'lucide-react';
import { copyToClipboard, cn } from '@/shared/lib/utils';
import { formatInTextCitation } from '@/features/library/domain/reader.domain';
import type { AnnotationRect, ReaderDocument } from '@/features/library/types/reader.types';
import type { ReaderAnnotationTool } from '@/features/library/store/reader.store';
import { ZOTERO_COLORS } from '@/features/library/components/reader/ReaderToolbar';

export interface TextSelectionToolbarProps {
  selectedText: string;
  selectedPageNum: number;
  selectedRects: AnnotationRect[];
  menuPosition: { top: number; left: number };
  activeColor?: string;
  activeTool?: ReaderAnnotationTool;
  paper?: ReaderDocument;
  visiblePage: number;
  onAnnotate?: (
    selectedText: string,
    pageNumber: number,
    colorHex?: string,
    rects?: AnnotationRect[],
    type?: 'highlight' | 'underline' | 'note' | 'text' | 'rect' | 'area',
    comment?: string,
  ) => void;
  onAddToNote?: (selectedText: string, pageNumber?: number, annotationId?: string) => void;
  onAskAi: (selectedText: string) => void;
  onClose: () => void;
}

export function TextSelectionToolbar({
  selectedText,
  selectedPageNum,
  selectedRects,
  menuPosition,
  activeColor,
  activeTool,
  paper,
  visiblePage,
  onAnnotate,
  onAddToNote,
  onAskAi,
  onClose,
}: TextSelectionToolbarProps) {
  const [copiedSelection, setCopiedSelection] = useState(false);
  const [copiedCitation, setCopiedCitation] = useState(false);

  const handleCopySelection = async () => {
    if (!selectedText) return;
    const ok = await copyToClipboard(selectedText);
    if (ok) {
      setCopiedSelection(true);
      setTimeout(() => {
        setCopiedSelection(false);
        onClose();
      }, 1200);
    }
  };

  const handleCopyCitation = async () => {
    if (!paper || !selectedText) return;
    const citation = formatInTextCitation(paper, visiblePage);
    const citeText = `${citation} "${selectedText}"`;
    const ok = await copyToClipboard(citeText);
    if (ok) {
      setCopiedCitation(true);
      setTimeout(() => {
        setCopiedCitation(false);
        onClose();
      }, 1200);
    }
  };

  return (
    <div
      className="pdf-floating-selection-menu absolute z-50 flex items-center gap-1.5 bg-background text-foreground px-2 py-1 rounded-md border border-border shadow-raised-200 duration-150 select-none"
      style={{
        top: `${menuPosition.top}px`,
        left: `${menuPosition.left}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* 8 Zotero Color Highlight Dots */}
      {onAnnotate && (
        <div className="flex items-center gap-1 pr-1.5 border-r border-border">
          {ZOTERO_COLORS.map((c) => {
            const isSelected = activeColor === c.hex;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={`Highlight in ${c.label}`}
                onClick={() => {
                  const targetType = activeTool === 'underline' ? 'underline' : 'highlight';
                  onAnnotate(selectedText, selectedPageNum, c.hex, selectedRects, targetType);
                  onClose();
                  window.getSelection()?.removeAllRanges();
                }}
                title={`Highlight in ${c.label}`}
                className={cn(
                  'size-3.5 rounded-full border border-border hover:scale-125 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-2.5 md:before:hidden',
                  isSelected && 'ring-2 ring-primary ring-offset-1 scale-110',
                )}
                style={{ backgroundColor: c.hex }}
              />
            );
          })}
        </div>
      )}

      {/* Note Action */}
      {onAddToNote && (
        <button
          type="button"
          aria-label="Add selected text to Note"
          onClick={() => {
            onAddToNote(selectedText, selectedPageNum);
            onClose();
            window.getSelection()?.removeAllRanges();
          }}
          className="flex items-center gap-1 h-7 px-2 rounded-md text-12 font-medium hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
          title="Add selected text to Note"
        >
          <StickyNote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          <span>Note</span>
        </button>
      )}

      {/* Ask AI Action */}
      <button
        type="button"
        aria-label="Ask AI about selected text"
        onClick={() => {
          onAskAi(selectedText);
          onClose();
          window.getSelection()?.removeAllRanges();
        }}
        className="flex items-center gap-1 h-7 px-2 rounded-md text-12 font-medium hover:bg-muted text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
        title="Ask AI about selected text"
      >
        <img src="/Chat.svg" alt="AI" className="size-3.5 shrink-0 rounded-full" />
        <span>Ask AI</span>
      </button>

      {/* Cite Action */}
      {paper && (
        <button
          type="button"
          aria-label="Copy in-text citation"
          onClick={handleCopyCitation}
          className="flex items-center gap-1 h-7 px-2 rounded-md text-12 font-medium hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
          title="Copy in-text citation: (Author, Year, p. X)"
        >
          {copiedCitation ? (
            <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
          ) : (
            <Quote className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
          )}
          <span>{copiedCitation ? 'Cited' : 'Cite'}</span>
        </button>
      )}

      {/* Copy Action */}
      <button
        type="button"
        aria-label="Copy selected text"
        onClick={handleCopySelection}
        className="flex items-center gap-1 h-7 px-2 rounded-md text-12 font-medium hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring relative before:absolute before:-inset-1.5 md:before:hidden"
        title="Copy text"
      >
        {copiedSelection ? (
          <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
        ) : (
          <Copy className="size-3.5 text-foreground shrink-0" strokeWidth={1.5} />
        )}
        <span>{copiedSelection ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}
