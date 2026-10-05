'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { parseDocumentOutline, OUTLINE_INDENT } from '@/features/editor/utils/pdf-outline.util';

export interface FileOutlineSectionProps {
  isFileTreeOpen: boolean;
  docContent: string;
}

export const FileOutlineSection = React.memo(function FileOutlineSection({
  isFileTreeOpen,
  docContent,
}: FileOutlineSectionProps) {
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [outlineHeight, setOutlineHeight] = useState(200);

  const startResizeOutline = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = outlineHeight;

      const onMouseMove = (ev: MouseEvent) => {
        const deltaY = startY - ev.clientY;
        const newH = Math.min(Math.max(startH + deltaY, 80), 500);
        setOutlineHeight(newH);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [outlineHeight],
  );

  const outline = useMemo(
    () => (isOutlineOpen ? parseDocumentOutline(docContent) : []),
    [docContent, isOutlineOpen],
  );

  const handleOutlineClick = useCallback((line: number) => {
    editorCommandBus.dispatch({ type: 'editor:jump-to-line', line });
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col select-none relative border-t border-border/60 bg-transparent mb-1',
        !isFileTreeOpen && isOutlineOpen ? 'flex-1 min-h-0' : 'shrink-0',
      )}
    >
      {/* Invisible row resize handle on top edge when both tree and outline are open */}
      {isOutlineOpen && isFileTreeOpen && (
        <div
          onMouseDown={startResizeOutline}
          className="absolute -top-1 inset-x-0 h-2 z-10 cursor-row-resize bg-transparent"
          title="Resize outline section"
        />
      )}

      {/* Accordion header: matching Library & Sticky styling */}
      <button
        type="button"
        onClick={() => setIsOutlineOpen((value) => !value)}
        aria-expanded={isOutlineOpen}
        aria-label={isOutlineOpen ? 'Collapse file outline' : 'Expand file outline'}
        className="flex h-9 w-full items-center justify-between px-3 text-left text-13 font-semibold tracking-tight text-foreground transition-colors hover:bg-muted/50 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-inset"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150 text-foreground',
              isOutlineOpen && 'rotate-90',
            )}
            strokeWidth={1.75}
          />
          <span className="truncate">File outline</span>
        </div>
        {outline.length > 0 && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-11 font-mono font-medium text-foreground">
            {outline.length}
          </span>
        )}
      </button>

      {/* Outline content list */}
      {isOutlineOpen && (
        <div
          style={isFileTreeOpen ? { height: `${outlineHeight}px` } : undefined}
          className={cn(
            'overflow-y-auto pb-3',
            !isFileTreeOpen && 'flex-1 min-h-0',
          )}
        >
          {outline.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-4 py-8 select-none">
              <p className="text-12 text-muted-foreground font-normal">
                No sections or subsections found in this document.
              </p>
            </div>
          ) : (
            outline.map((entry, index) => (
              <button
                key={`${entry.line}-${index}`}
                type="button"
                onClick={() => handleOutlineClick(entry.line)}
                style={{
                  paddingLeft: `${16 + OUTLINE_INDENT[entry.level]}px`,
                }}
                className={cn(
                  'flex h-7.5 w-full items-center gap-2 pr-2 text-left text-13 tracking-tight transition-colors hover:bg-muted/60 cursor-pointer outline-none focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-inset text-foreground',
                  entry.level === 0 ? 'font-medium' : 'font-normal text-foreground/90',
                )}
              >
                <ChevronRight
                  className={cn(
                    'shrink-0 text-foreground',
                    entry.level === 0 ? 'size-3.5' : 'size-3',
                  )}
                  strokeWidth={1.5}
                />
                <span className="min-w-0 flex-1 truncate">{entry.title}</span>
                <span className="shrink-0 text-11 font-mono text-muted-foreground">
                  :{entry.line}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
