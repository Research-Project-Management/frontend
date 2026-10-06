'use client';

import React, { memo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { CitationItem } from './CitationItem';
import type { UnifiedCitation } from '../hooks/useCitationTabState';

interface VirtualizedCitationListProps {
  items: UnifiedCitation[];
  copiedKey: string | null;
  onSelect: (key: string) => void;
  onCopy: (key: string) => void;
  onInspect: (key: string) => void;
}

export const VirtualizedCitationList = memo(function VirtualizedCitationList({
  items,
  copiedKey,
  onSelect,
  onCopy,
  onInspect,
}: VirtualizedCitationListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Use virtualization for lists with 25+ citations to maintain 60 FPS scrolling
  const isLargeList = items.length >= 25;

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
    enabled: isLargeList,
  });

  if (!isLargeList) {
    return (
      <div className="space-y-0.5">
        {items.map((item) => (
          <CitationItem
            key={item.key}
            item={item}
            isCopied={copiedKey === item.key}
            onSelect={onSelect}
            onCopy={onCopy}
            onInspect={onInspect}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[calc(100vh-210px)] overflow-y-auto sidebar-scrollbar"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
              key={item.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <CitationItem
                item={item}
                isCopied={copiedKey === item.key}
                onSelect={onSelect}
                onCopy={onCopy}
                onInspect={onInspect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default VirtualizedCitationList;
