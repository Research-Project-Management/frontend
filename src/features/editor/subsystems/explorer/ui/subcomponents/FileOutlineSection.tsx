'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/shared/lib/utils';
import { FILE_OUTLINE_VIRTUAL_THRESHOLD } from '@/features/editor/domain/constants/editor.constants';
import { editorCommandBus, usePageStore, documentFacade } from '@/features/editor/core';
import { extractDocumentContentString, extractProjectId } from '@/features/editor/domain/types/core.types';
import {
  parseDocumentOutline,
  dtoToOutlineEntries,
  cacheBackendOutline,
  type OutlineEntry,
} from '@/features/editor/subsystems/compiler';
import { pagesService } from '@/features/editor/sdk/pages.service';
import { useEditorInstance } from '@/features/editor/core/bus/useEditorInstance';
import { useWorkspaceStore } from '@/features/editor/core';

const outlineResultCache = new Map<string, OutlineEntry[]>();
const outlineInFlightCache = new Map<string, Promise<OutlineEntry[]>>();

function hashOutlineKey(projectId: string, filePath: string | undefined, content: string): string {
  let h = 2166136261;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${projectId}|${filePath ?? ''}|${content.length}:${h >>> 0}`;
}

export interface FileOutlineSectionProps {
  isFileTreeOpen: boolean;
  docContent?: string;
  activeFileName?: string;
}

export const FileOutlineSection = React.memo(function FileOutlineSection({
  isFileTreeOpen,
  docContent,
  activeFileName,
}: FileOutlineSectionProps) {
  const { engine } = useEditorInstance();
  const isOutlineOpen = useWorkspaceStore((s) => s.fileOutlineOpen);
  const toggleFileOutline = useWorkspaceStore((s) => s.toggleFileOutline);
  const [outlineHeight, setOutlineHeight] = useState(200);
  const [activeLine, setActiveLine] = useState<number>(1);
  const [content, setContent] = useState<string>(() => docContent ?? '');
  const activeItemRef = useRef<HTMLDivElement | null>(null);

  // Sync with prop changes when active file changes
  useEffect(() => {
    if (docContent !== undefined) {
      setContent(docContent);
      return;
    }
    if (!isOutlineOpen) return;
    const currentText = engine?.getContent() || documentFacade.getDocumentContent();
    if (currentText) {
      setContent(currentText);
      return;
    }
    const pageState = usePageStore.getState();
    setContent(
      extractDocumentContentString(
        pageState.activeFilePage?.content || pageState.currentPage?.content,
      ),
    );
  }, [docContent, activeFileName, isOutlineOpen, engine]);

  // Subscribe to real-time keystrokes and cursor updates from the active editor engine only when open
  useEffect(() => {
    if (!engine || !isOutlineOpen) return;

    const initialPos = engine.getCursorPosition();
    if (initialPos) {
      setActiveLine(initialPos.line);
    }

    const currentText = engine.getContent();
    if (currentText) {
      setContent(currentText);
    } else if (docContent === undefined) {
      const pageState = usePageStore.getState();
      setContent(
        extractDocumentContentString(
          pageState.activeFilePage?.content || pageState.currentPage?.content,
        ),
      );
    }

    const unsubCursor = engine.onCursorChange((line: number) => {
      setActiveLine((prev) => (prev === line ? prev : line));
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
  }, [engine, isOutlineOpen, docContent]);

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

  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [collapsedLines, setCollapsedLines] = useState<Set<number>>(() => new Set());
  const lastFetchedHashRef = useRef<string | null>(null);
  const outlineScrollRef = useRef<HTMLDivElement | null>(null);

  const toggleSectionCollapse = useCallback((line: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedLines((prev) => {
      const next = new Set(prev);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }, []);

  const sectionOutline = useMemo(
    () => outline.filter((entry) => entry.type !== 'figure' && entry.type !== 'table'),
    [outline],
  );

  const minLevel = useMemo(
    () => (sectionOutline.length > 0 ? Math.min(...sectionOutline.map((e) => e.level)) : 0),
    [sectionOutline],
  );

  const visibleEntries = useMemo(() => {
    const result: Array<{ entry: OutlineEntry; hasChildren: boolean; isCollapsed: boolean }> = [];
    const collapsedStack: number[] = [];

    for (let i = 0; i < sectionOutline.length; i++) {
      const entry = sectionOutline[i];
      while (collapsedStack.length > 0 && entry.level <= collapsedStack[collapsedStack.length - 1]) {
        collapsedStack.pop();
      }
      if (collapsedStack.length > 0) {
        continue;
      }

      const nextEntry = sectionOutline[i + 1];
      const hasChildren = Boolean(nextEntry && nextEntry.level > entry.level);
      const isCollapsed = hasChildren && collapsedLines.has(entry.line);
      result.push({ entry, hasChildren, isCollapsed });

      if (isCollapsed) {
        collapsedStack.push(entry.level);
      }
    }
    return result;
  }, [sectionOutline, collapsedLines]);

  const isVirtualized = isOutlineOpen && visibleEntries.length >= FILE_OUTLINE_VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: visibleEntries.length,
    getScrollElement: () => outlineScrollRef.current,
    estimateSize: () => 30,
    overscan: 8,
    enabled: isVirtualized,
  });

  useEffect(() => {
    if (!isOutlineOpen) {
      return;
    }
    const pageState = usePageStore.getState();
    const projectId =
      pageState.spaceId ||
      pageState.projectId ||
      extractProjectId(pageState.currentPage) ||
      pageState.currentPage?.id ||
      '';
    const activePageId = pageState.rootPageId || pageState.parentPageId || pageState.currentPage?.id || undefined;
    const activeDocId = pageState.activeDocId || pageState.activePageId || undefined;
    const outlineTargetId = activePageId || projectId;
    if (!outlineTargetId) {
      setOutline(parseDocumentOutline(content));
      return;
    }

    const outlineHash = hashOutlineKey(outlineTargetId, activeFileName, content);
    if (lastFetchedHashRef.current === outlineHash) {
      return;
    }

    const cached = outlineResultCache.get(outlineHash);
    if (cached) {
      lastFetchedHashRef.current = outlineHash;
      cacheBackendOutline(cached);
      setOutline(cached);
      return;
    }

    let cancelled = false;
    let requestPromise = outlineInFlightCache.get(outlineHash);
    if (!requestPromise) {
      requestPromise = pagesService.structure
        .getOutline(outlineTargetId, {
          filePath: activeFileName,
          docId: activeDocId,
          pageId: activePageId,
          content,
        })
        .then((res) => {
          const mapped = dtoToOutlineEntries(res?.entries);
          if (outlineResultCache.size >= 32) {
            const oldestKey = outlineResultCache.keys().next().value;
            if (oldestKey !== undefined) {
              outlineResultCache.delete(oldestKey);
            }
          }
          outlineResultCache.set(outlineHash, mapped);
          return mapped;
        })
        .finally(() => {
          outlineInFlightCache.delete(outlineHash);
        });
      outlineInFlightCache.set(outlineHash, requestPromise);
    }

    requestPromise
      .then((mapped) => {
        if (cancelled) return;
        lastFetchedHashRef.current = outlineHash;
        cacheBackendOutline(mapped);
        setOutline(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          lastFetchedHashRef.current = outlineHash;
          setOutline(parseDocumentOutline(content));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [content, activeFileName, isOutlineOpen]);

  // Active section heading containing the current cursor position
  const activeSectionIndex = useMemo(() => {
    if (visibleEntries.length === 0) return -1;
    let currentIdx = -1;
    for (let i = 0; i < visibleEntries.length; i++) {
      if (visibleEntries[i].entry.line <= activeLine) {
        currentIdx = i;
      } else {
        break;
      }
    }
    return currentIdx >= 0 ? currentIdx : 0;
  }, [visibleEntries, activeLine]);

  // Scroll active item into view
  useEffect(() => {
    if (activeSectionIndex < 0 || !isOutlineOpen) return;
    let cancelled = false;
    if (isVirtualized) {
      queueMicrotask(() => {
        if (!cancelled) {
          rowVirtualizer.scrollToIndex(activeSectionIndex, { align: 'auto' });
        }
      });
      return () => {
        cancelled = true;
      };
    }
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeSectionIndex, isOutlineOpen, isVirtualized, rowVirtualizer]);

  const handleOutlineClick = useCallback(
    (line: number) => {
      if (engine) {
        engine.jumpToLine(line, 'synctex');
        engine.focus();
      } else {
        editorCommandBus.dispatch({ type: 'editor:jump-to-line', line, highlight: 'synctex' });
      }
      editorCommandBus.dispatch({ type: 'synctex:forward', line });
    },
    [engine],
  );

  const renderOutlineRow = (
    item: { entry: OutlineEntry; hasChildren: boolean; isCollapsed: boolean },
    index: number,
  ) => {
    const { entry, hasChildren, isCollapsed } = item;
    const isActive = index === activeSectionIndex;
    const relativeDepth = Math.max(0, entry.level - minLevel);
    return (
      <div
        key={`${entry.line}-${index}`}
        ref={!isVirtualized && isActive ? activeItemRef : undefined}
        role="button"
        tabIndex={0}
        onClick={() => handleOutlineClick(entry.line)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleOutlineClick(entry.line);
          }
        }}
        className={cn(
          'mx-1.5 flex h-7.5 items-center gap-1 rounded-md px-1.5 pr-2 text-left text-13 tracking-tight transition-colors motion-reduce:transition-none cursor-pointer outline-none focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-inset select-none',
          isActive
            ? 'bg-primary/10 text-primary font-medium'
            : 'hover:bg-muted/60 text-foreground/85 font-normal',
        )}
      >
        {Array.from({ length: relativeDepth }, (_, d) => (
          <span
            key={d}
            className="w-3.5 self-stretch flex justify-center shrink-0"
            aria-hidden="true"
          >
            <span className="w-px h-full bg-border/80" />
          </span>
        ))}

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => toggleSectionCollapse(entry.line, e)}
            aria-label={isCollapsed ? 'Expand section' : 'Collapse section'}
            className="size-4 flex items-center justify-center rounded-sm hover:bg-muted shrink-0 cursor-pointer"
          >
            <ChevronRight
              className={cn(
                'size-3.5 transition-transform duration-150',
                isActive ? 'text-primary' : 'text-muted-foreground',
                !isCollapsed && 'rotate-90',
              )}
              strokeWidth={1.75}
            />
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden="true" />
        )}

        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            isActive ? 'text-primary font-medium' : 'text-foreground',
          )}
        >
          {entry.title}
        </span>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col select-none relative bg-surface',
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

      {/* Accordion header: matching File Tree styling */}
      <button
        type="button"
        onClick={toggleFileOutline}
        aria-expanded={isOutlineOpen}
        aria-label={isOutlineOpen ? 'Collapse File Outline' : 'Expand File Outline'}
        className={cn(
          'flex h-9 w-full items-center justify-between px-3 text-left text-13 font-semibold tracking-tight text-foreground transition-colors hover:bg-muted/40 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-foreground focus-visible:ring-inset',
          !isFileTreeOpen && 'border-t border-border',
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 transition-transform duration-150 text-foreground motion-reduce:transition-none',
              isOutlineOpen && 'rotate-90',
            )}
            strokeWidth={1.75}
          />
          <span className="truncate">File Outline</span>
        </div>
      </button>

      {/* Outline content list */}
      {isOutlineOpen && (
        <div
          ref={outlineScrollRef}
          style={isFileTreeOpen ? { height: `${outlineHeight}px` } : undefined}
          className={cn(
            'overflow-y-auto pb-3',
            !isFileTreeOpen && 'flex-1 min-h-0',
          )}
        >
          {visibleEntries.length === 0 ? (
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
          ) : isVirtualized ? (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = visibleEntries[virtualRow.index];
                if (!item) return null;
                return (
                  <div
                    key={`${item.entry.line}-${virtualRow.index}`}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {renderOutlineRow(item, virtualRow.index)}
                  </div>
                );
              })}
            </div>
          ) : (
            visibleEntries.map((item, index) => renderOutlineRow(item, index))
          )}
        </div>
      )}
    </div>
  );
});
