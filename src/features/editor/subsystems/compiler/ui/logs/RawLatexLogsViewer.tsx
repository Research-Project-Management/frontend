'use client';

import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export const RAW_LOGS_VIRTUAL_LINE_THRESHOLD = 150;

export interface RawLatexLogsViewerProps {
  log?: string | null;
}

export const RawLatexLogsViewer = React.memo(function RawLatexLogsViewer({
  log,
}: RawLatexLogsViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lines = useMemo(() => {
    if (!log) return [];
    return log.replace(/\r\n/g, '\n').split('\n');
  }, [log]);

  const isVirtualized = lines.length >= RAW_LOGS_VIRTUAL_LINE_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: isVirtualized ? lines.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 20,
    overscan: 16,
    enabled: isVirtualized,
  });

  if (!isVirtualized) {
    return (
      <pre
        id="raw-latex-logs-content"
        className="p-3 border-t border-border/60 bg-muted/20 font-mono text-12 text-foreground/90 whitespace-pre-wrap break-words leading-relaxed max-h-96 overflow-y-auto select-text"
      >
        {log || 'No compilation logs recorded yet.'}
      </pre>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();
  const renderedRows =
    virtualItems.length > 0
      ? virtualItems.map((item) => ({
          index: item.index,
          size: item.size,
          start: item.start,
        }))
      : lines.slice(0, 40).map((_, index) => ({
          index,
          size: 20,
          start: index * 20,
        }));

  return (
    <div
      ref={scrollRef}
      id="raw-latex-logs-content"
      data-virtualized="true"
      className="p-3 border-t border-border/60 bg-muted/20 font-mono text-12 text-foreground/90 leading-relaxed max-h-96 overflow-auto select-text"
    >
      <div
        style={{
          height: `${Math.max(rowVirtualizer.getTotalSize(), lines.length * 20)}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {renderedRows.map((virtualRow) => (
          <div
            key={virtualRow.index}
            data-index={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              minWidth: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
            className="whitespace-pre"
          >
            {lines[virtualRow.index] || ' '}
          </div>
        ))}
      </div>
    </div>
  );
});

export default RawLatexLogsViewer;
