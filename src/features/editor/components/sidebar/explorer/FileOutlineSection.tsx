'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { editorCommandBus } from '@/features/editor/core/command-bus/editor-command-bus';
import { parseDocumentOutline, OUTLINE_INDENT } from '@/features/editor/utils/pdf-outline.util';

const OUTLINE_COLORS: Record<number, string> = {
  0: 'font-medium text-foreground',
  1: 'text-foreground/90',
  2: 'text-muted-foreground',
  3: 'text-muted-foreground/80',
  4: 'text-muted-foreground/70',
};

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
    <>
      {/* Resizable Divider between File tree and File outline */}
      {isOutlineOpen && (
        <div
          onMouseDown={isFileTreeOpen ? startResizeOutline : undefined}
          className={cn(
            'h-2 w-full shrink-0 flex items-center justify-center border-t border-border hover:bg-muted/60 select-none group transition-colors',
            isFileTreeOpen ? 'cursor-row-resize' : 'cursor-default',
          )}
        >
          <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
            <span className="size-1 rounded-full bg-foreground/60" />
            <span className="size-1 rounded-full bg-foreground/60" />
            <span className="size-1 rounded-full bg-foreground/60" />
            <span className="size-1 rounded-full bg-foreground/60" />
          </div>
        </div>
      )}

      {/* ── File outline Accordion ────────────────────────────────────────── */}
      <div
        className={cn(
          'bg-background flex flex-col select-none',
          !isOutlineOpen && 'border-t border-border',
          !isFileTreeOpen && isOutlineOpen ? 'flex-1 min-h-0' : 'shrink-0',
        )}
      >
        <button
          type="button"
          onClick={() => setIsOutlineOpen((value) => !value)}
          className="flex h-8 w-full items-center gap-1.5 px-3 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted/60 cursor-pointer select-none"
        >
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform text-muted-foreground',
              isOutlineOpen && 'rotate-90',
            )}
          />
          <span className="min-w-0 flex-1 truncate">File outline</span>
          {outline.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-10 font-mono font-medium text-muted-foreground">
              {outline.length}
            </span>
          )}
        </button>
        {isOutlineOpen && (
          <div
            style={isFileTreeOpen ? { height: `${outlineHeight}px` } : undefined}
            className={cn(
              'overflow-y-auto pb-1 border-t border-border/40',
              !isFileTreeOpen && 'flex-1 min-h-0',
            )}
          >
            {outline.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center px-4 py-8 select-none">
                <p className="text-xs text-foreground/80 font-medium">
                  We can&apos;t find any sections or subsections in this file.
                </p>
                <span className="text-11 text-primary hover:underline mt-1.5 cursor-pointer">
                  Find out more about the file outline
                </span>
              </div>
            ) : (
              outline.map((entry, index) => (
                <button
                  key={`${entry.line}-${index}`}
                  type="button"
                  onClick={() => handleOutlineClick(entry.line)}
                  style={{
                    paddingLeft: `${24 + OUTLINE_INDENT[entry.level]}px`,
                  }}
                  className={cn(
                    'flex h-7 w-full items-center gap-1.5 pr-2 text-left text-xs transition-colors hover:bg-muted/70 cursor-pointer',
                    OUTLINE_COLORS[entry.level],
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'shrink-0 text-muted-foreground',
                      entry.level === 0 ? 'size-3.5' : 'size-3',
                    )}
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
    </>
  );
});
