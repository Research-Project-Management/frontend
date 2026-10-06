'use client';

import React from 'react';
import { Clock, Tag } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { PlaneEmptyState } from '@/shared/components/ui';

export interface TimelineCardItem {
  id: string;
  versionNumber?: number;
  title?: string;
  label?: string;
  fileName?: string;
  date: string | Date;
  author: string;
  eventType?: string;
}

export interface TimelineGroup {
  groupName: string;
  items: TimelineCardItem[];
}

interface HistoryTimelineProps {
  isOpen: boolean;
  timelineTab: 'all' | 'labels';
  onChangeTab: (tab: 'all' | 'labels') => void;
  labeledCount: number;
  isLoading: boolean;
  groupedTimeline: TimelineGroup[];
  selectedEventId: string | null;
  onSelectRevision: (id: string) => void;
}

export function HistoryTimeline({
  isOpen,
  timelineTab,
  onChangeTab,
  labeledCount,
  isLoading,
  groupedTimeline,
  selectedEventId,
  onSelectRevision,
}: HistoryTimelineProps) {
  if (!isOpen) return null;

  return (
    <aside
      aria-label="Revision history timeline"
      className="w-80 shrink-0 border-l border-border bg-card flex flex-col text-card-foreground min-h-0 select-none animate-in fade-in duration-150 motion-reduce:animate-none"
    >
      {/* Top Switcher: [ All history | Labels ] */}
      <div className="p-3 border-b border-border shrink-0">
        <div className="inline-flex w-full items-center rounded-md bg-muted p-1 gap-1 text-12">
          <button
            type="button"
            onClick={() => onChangeTab('all')}
            className={cn(
              'flex-1 py-1 px-2.5 rounded-sm text-12 font-medium transition-colors cursor-pointer text-center outline-none focus-visible:ring-1 focus-visible:ring-primary',
              timelineTab === 'all'
                ? 'bg-background text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All history
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('labels')}
            className={cn(
              'flex-1 py-1 px-2.5 rounded-sm text-12 font-medium transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5 outline-none focus-visible:ring-1 focus-visible:ring-primary',
              timelineTab === 'labels'
                ? 'bg-background text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>Labels</span>
            {labeledCount > 0 && (
              <span className="text-11 px-1.5 py-0.5 rounded-full bg-muted-foreground/20 text-foreground font-mono leading-tight">
                {labeledCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Timeline Revisions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-12 gap-2">
            <Clock className="size-5 animate-spin opacity-50 text-primary" />
            <span>Loading revision history…</span>
          </div>
        ) : groupedTimeline.length === 0 ? (
          <div className="py-8 px-2">
            <PlaneEmptyState
              variant="history"
              isCompact
              title={timelineTab === 'labels' ? 'No labeled versions' : 'No revisions found'}
              description={
                timelineTab === 'labels'
                  ? 'Label milestone revisions to bookmark key checkpoints like submissions or drafts.'
                  : 'Changes are automatically checkpointed as you edit.'
              }
            />
          </div>
        ) : (
          groupedTimeline.map(({ groupName, items }) => (
            <div key={groupName} className="space-y-1.5">
              <div className="text-11 font-mono font-medium text-muted-foreground tracking-normal px-1 uppercase">
                {groupName}
              </div>

              {items.map((item) => {
                const isSelected = item.id === selectedEventId;
                const d = new Date(item.date);
                const timeStr = isNaN(d.getTime())
                  ? 'Unknown time'
                  : d.toLocaleTimeString('en-GB', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    });

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-selected={isSelected}
                    aria-label={`Revision from ${timeStr} by ${item.author}`}
                    onClick={() => onSelectRevision(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectRevision(item.id);
                      }
                    }}
                    className={cn(
                      'group relative rounded-md p-2.5 transition-colors cursor-pointer select-none border outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isSelected
                        ? 'bg-primary/10 border-primary/40 text-foreground font-medium shadow-xs'
                        : 'bg-card hover:bg-muted/50 border-border text-foreground',
                    )}
                  >
                    {/* Header: Timestamp & Version Number */}
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'text-12 font-mono font-semibold truncate',
                          isSelected ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {timeStr}
                      </span>

                      {item.versionNumber && (
                        <span className="text-11 font-mono text-muted-foreground">
                          v{item.versionNumber}
                        </span>
                      )}
                    </div>

                    {/* Label Badge if present */}
                    {item.label && (
                      <div className="mt-1.5 flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-11 font-medium w-fit">
                        <Tag className="size-3 shrink-0" />
                        <span className="truncate max-w-[220px]">{item.label}</span>
                      </div>
                    )}

                    {/* Status & Filename */}
                    <div className="text-11 text-foreground/80 mt-1 font-medium">
                      {item.eventType === 'collaborative_checkpoint'
                        ? 'Auto Checkpoint'
                        : item.eventType === 'restore'
                          ? 'Restored Version'
                          : 'Edited'}
                    </div>

                    {item.fileName && (
                      <div className="text-11 text-muted-foreground font-mono truncate mt-0.5">
                        {item.fileName}
                      </div>
                    )}

                    {/* Author Tag */}
                    <div className="flex items-center gap-1.5 mt-2 text-11 font-mono text-muted-foreground">
                      <span className="size-1.5 rounded-full bg-primary shrink-0" />
                      <span>{item.author}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

export default HistoryTimeline;
