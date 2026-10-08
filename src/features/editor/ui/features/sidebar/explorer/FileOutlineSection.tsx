'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { parseDocumentOutline, OUTLINE_INDENT } from '@/features/editor/domain/document/pdf-outline';
import { useEditorInstance } from '@/features/editor/ui/hooks/use-editor-instance';

export interface FileOutlineSectionProps {
  isFileTreeOpen: boolean;
  docContent: string;
  activeFileName?: string;
}

export const FileOutlineSection = React.memo(function FileOutlineSection({
  isFileTreeOpen,
  docContent,
  activeFileName,
}: FileOutlineSectionProps) {
  const { engine } = useEditorInstance();
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [outlineHeight, setOutlineHeight] = useState(200);
  const [activeLine, setActiveLine] = useState<number>(1);
  const [content, setContent] = useState<string>(docContent);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Sync with prop changes when active file changes
  useEffect(() => {
    setContent(docContent);
  }, [docContent]);

  // Subscribe to real-time keystrokes and cursor updates from the active editor engine
  useEffect(() => {
    if (!engine) return;

    const initialPos = engine.getCursorPosition();
    if (initialPos) {
      setActiveLine(initialPos.line);
    }

    const currentText = engine.getContent();
    if (currentText) {
      setContent(currentText);
    }

    const unsubCursor = engine.onCursorChange((line: number) => {
      setActiveLine(line);
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubContent = engine.onContentChange((latestContent: string) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setContent(latestContent);
      }, 300);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubCursor();
      unsubContent();
    };
  }, [engine]);

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
    () => (isOutlineOpen ? parseDocumentOutline(content) : []),
    [content, isOutlineOpen],
  );

  // Active section heading containing the current cursor position
  const activeSectionIndex = useMemo(() => {
    if (outline.length === 0) return -1;
    let currentIdx = -1;
    for (let i = 0; i < outline.length; i++) {
      if (outline[i].line <= activeLine) {
        currentIdx = i;
      } else {
        break;
      }
    }
    return currentIdx >= 0 ? currentIdx : 0;
  }, [outline, activeLine]);

  // Scroll active item into view
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeSectionIndex]);

  const handleOutlineClick = useCallback(
    (line: number) => {
      if (engine) {
        engine.jumpToLine(line, 'synctex');
        engine.focus();
      } else {
        editorCommandBus.dispatch({ type: 'editor:jump-to-line', line, highlight: 'synctex' });
      }
    },
    [engine],
  );

  return (
    <div
      className={cn(
        'flex flex-col select-none relative bg-transparent',
        !isFileTreeOpen && isOutlineOpen ? 'flex-1 min-h-0' : 'shrink-0',
      )}
    >
      {/* Invisible row resize handle on top edge when both tree and outline are open */}
      {isOutlineOpen && isFileTreeOpen && (
        <div
          onMouseDown={startResizeOutline}
          className="absolute -top-1 inset-x-0 h-2 z-10 cursor-row-resize bg-transparent"
        />
      )}

      {/* Accordion header: matching Library & Sticky styling with default border-b */}
      <button
        type="button"
        onClick={() => setIsOutlineOpen((value) => !value)}
        aria-expanded={isOutlineOpen}
        aria-label={isOutlineOpen ? 'Collapse File Outlines' : 'Expand File Outlines'}
        className="flex h-9 w-full items-center justify-between px-3 text-left text-13 font-semibold tracking-tight text-foreground border-b border-border transition-colors hover:bg-muted/50 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-inset"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150 text-foreground motion-reduce:transition-none',
              isOutlineOpen && 'rotate-90',
            )}
            strokeWidth={1.75}
          />
          <span className="truncate">File Outlines</span>
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
              {activeFileName && (
                <p className="mt-1.5 text-12 font-mono text-muted-foreground/60 tracking-tight">
                  {activeFileName}
                </p>
              )}
            </div>
          ) : (
            outline.map((entry, index) => {
              const isActive = index === activeSectionIndex;
              const indent = OUTLINE_INDENT[entry.level] ?? (entry.level * 10);
              return (
                <button
                  key={`${entry.line}-${index}`}
                  ref={isActive ? activeItemRef : undefined}
                  type="button"
                  onClick={() => handleOutlineClick(entry.line)}
                  style={{
                    paddingLeft: `${16 + indent}px`,
                  }}
                  className={cn(
                    'flex h-7.5 w-full items-center gap-2 pr-2 text-left text-13 tracking-tight transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-inset select-none',
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-muted/60 text-foreground/85 font-normal',
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground',
                      entry.level === 0 ? 'size-3.5' : 'size-3',
                    )}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate',
                      isActive ? 'text-primary font-medium' : 'text-foreground',
                    )}
                  >
                    {entry.title}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-11 font-mono',
                      isActive ? 'text-primary/80 font-medium' : 'text-muted-foreground',
                    )}
                  >
                    :{entry.line}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
});
