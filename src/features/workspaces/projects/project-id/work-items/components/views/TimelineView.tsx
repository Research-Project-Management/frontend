'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Plus } from 'lucide-react';
import { Button } from "@/shared/components/ui";
import { StatusIcon } from '@/shared/components/icons';
import type { Item, Task, Column as ColumnType, Cycle, ProjectMember, BaseWorkItemViewProps, WorkItemCardHandlers } from '../../types/work-item.types';

// ==========================================
// TYPES
// ==========================================

export type TimelineZoom = 'week' | 'month' | 'quarter';

export interface TimelineDayColumn {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayNumber: number; // 1..31
  dayOfWeek: string; // 'M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'
  isToday: boolean;
  isWeekend: boolean;
  weekNumber: number;
  monthYearKey: string; // e.g. 'Sept 2026'
}

export interface TimelineHeaderGroup {
  key: string;
  label: string;
  startIndex: number;
  spanCount: number;
}

export interface TimelineBarData {
  task: Task;
  startIndex: number;
  endIndex: number;
  hasDates: boolean;
  durationDays: number;
  durationLabel: string;
}

/** Finish-to-Start: B can't start until A finishes (blocks/blocked_by) */
/** Start-to-Start: B can't start until A starts (starts_before/starts_after) */
/** Finish-to-Finish: B can't finish until A finishes (finishes_before/finishes_after) */
export type DepLineType = 'FS' | 'SS' | 'FF';

export interface DependencyLine {
  fromTaskId: string;
  toTaskId: string;
  /** x pixel from canvas left where line starts */
  fromX: number;
  /** row center y of the source bar */
  fromY: number;
  /** x pixel where line ends */
  toX: number;
  /** row center y of the target bar */
  toY: number;
  type: DepLineType;
  /** true when dependency is violated (dates conflict) */
  violated: boolean;
}

export interface TimelineViewProps extends BaseWorkItemViewProps, WorkItemCardHandlers {
  items?: Item[];
  tasks?: Item[];
  columns: ColumnType[];
  projectId?: string;
  workspaceId?: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateCard?: (task: { id: string } & Partial<Task>) => void;
}

// ==========================================
// CONSTANTS & UTILITIES
// ==========================================

export const DAY_WIDTHS: Record<TimelineZoom, number> = {
  week: 46,
  month: 36,
  quarter: 28,
};

export const SIDEBAR_WIDTH = 340;
export const ROW_HEIGHT = 40;
export const HEADER_HEIGHT = 56;

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sept',
  'Oct',
  'Nov',
  'Dec',
];

export const DAY_OF_WEEK_ABBR = ['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa'];

export function formatToDateStr(targetDate: Date): string {
  const year = targetDate.getFullYear();
  const month = String(targetDate.getMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length < 3) {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return null;
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 0, 0, 0, 0);
}

export function getISOWeekNumber(targetDate: Date): number {
  const date = new Date(targetDate.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

export function getTimelineDays(
  centerDate: Date = new Date(),
  zoom: TimelineZoom = 'week'
): TimelineDayColumn[] {
  const todayStr = formatToDateStr(new Date());

  let pastDays = 25;
  let futureDays = 65;

  if (zoom === 'month') {
    pastDays = 45;
    futureDays = 120;
  } else if (zoom === 'quarter') {
    pastDays = 60;
    futureDays = 240;
  }

  const start = new Date(centerDate.getTime());
  start.setDate(start.getDate() - pastDays);
  start.setHours(0, 0, 0, 0);

  const totalDays = pastDays + futureDays;
  const days: TimelineDayColumn[] = [];

  for (let index = 0; index < totalDays; index++) {
    const currentDate = new Date(start.getTime());
    currentDate.setDate(currentDate.getDate() + index);

    const dateStr = formatToDateStr(currentDate);
    const dayOfWeekIndex = currentDate.getDay();

    days.push({
      date: currentDate,
      dateStr,
      dayNumber: currentDate.getDate(),
      dayOfWeek: DAY_OF_WEEK_ABBR[dayOfWeekIndex],
      isToday: dateStr === todayStr,
      isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
      weekNumber: getISOWeekNumber(currentDate),
      monthYearKey: `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`,
    });
  }

  return days;
}

export function getMonthYearGroups(days: TimelineDayColumn[]): TimelineHeaderGroup[] {
  const groups: TimelineHeaderGroup[] = [];
  if (days.length === 0) return groups;

  let currentKey = days[0].monthYearKey;
  let startIndex = 0;
  let count = 0;

  for (let index = 0; index < days.length; index++) {
    if (days[index].monthYearKey === currentKey) {
      count++;
    } else {
      groups.push({
        key: currentKey,
        label: currentKey,
        startIndex,
        spanCount: count,
      });
      currentKey = days[index].monthYearKey;
      startIndex = index;
      count = 1;
    }
  }

  if (count > 0) {
    groups.push({
      key: currentKey,
      label: currentKey,
      startIndex,
      spanCount: count,
    });
  }

  return groups;
}

export function getWeekGroups(days: TimelineDayColumn[]): TimelineHeaderGroup[] {
  const groups: TimelineHeaderGroup[] = [];
  if (days.length === 0) return groups;

  let currentWeek = days[0].weekNumber;
  let startIndex = 0;
  let count = 0;

  for (let index = 0; index < days.length; index++) {
    if (days[index].weekNumber === currentWeek) {
      count++;
    } else {
      groups.push({
        key: `week-${currentWeek}-${startIndex}`,
        label: `Week ${currentWeek}`,
        startIndex,
        spanCount: count,
      });
      currentWeek = days[index].weekNumber;
      startIndex = index;
      count = 1;
    }
  }

  if (count > 0) {
    groups.push({
      key: `week-${currentWeek}-${startIndex}`,
      label: `Week ${currentWeek}`,
      startIndex,
      spanCount: count,
    });
  }

  return groups;
}

export function calculateDuration(
  startDate?: string | null,
  dueDate?: string | null
): { days: number; label: string } {
  const start = parseDateOnly(startDate);
  const due = parseDateOnly(dueDate);

  if (!start && !due) {
    return { days: 0, label: '-' };
  }

  if (start && due) {
    const diffMs = due.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.round(diffMs / 86400000) + 1);
    if (diffDays === 1) return { days: 1, label: '1 day' };
    if (diffDays === 7) return { days: 7, label: '1 week' };
    if (diffDays === 14) return { days: 14, label: '2 weeks' };
    if (diffDays % 7 === 0 && diffDays <= 28) {
      return { days: diffDays, label: `${diffDays / 7} weeks` };
    }
    if (diffDays >= 30) {
      const months = Math.round(diffDays / 30);
      return { days: diffDays, label: `${months} ${months === 1 ? 'month' : 'months'}` };
    }
    return { days: diffDays, label: `${diffDays} days` };
  }

  return { days: 1, label: '1 day' };
}

export const mapItemToBar = mapTaskToBar;
export function mapTaskToBar(
  task: Task,
  days: TimelineDayColumn[]
): TimelineBarData {
  const start = parseDateOnly(task.startDate);
  const due = parseDateOnly(task.dueDate);
  const duration = calculateDuration(task.startDate, task.dueDate);

  if (!start && !due) {
    return {
      task,
      startIndex: -1,
      endIndex: -1,
      hasDates: false,
      durationDays: 0,
      durationLabel: '-',
    };
  }

  const effectiveStart = start || due!;
  const effectiveDue = due || start!;

  const startStr = formatToDateStr(effectiveStart);
  const dueStr = formatToDateStr(effectiveDue);

  let startIndex = days.findIndex((columnDay) => columnDay.dateStr === startStr);
  let endIndex = days.findIndex((columnDay) => columnDay.dateStr === dueStr);

  if (startIndex === -1 && endIndex === -1) {
    const minDay = days[0].date;
    const maxDay = days[days.length - 1].date;

    if (effectiveDue < minDay || effectiveStart > maxDay) {
      return {
        task,
        startIndex: -1,
        endIndex: -1,
        hasDates: true,
        durationDays: duration.days,
        durationLabel: duration.label,
      };
    }
  }

  if (startIndex === -1) startIndex = 0;
  if (endIndex === -1) endIndex = days.length - 1;

  if (startIndex > endIndex) {
    const tempIndex = startIndex;
    startIndex = endIndex;
    endIndex = tempIndex;
  }

  return {
    task,
    startIndex,
    endIndex,
    hasDates: true,
    durationDays: duration.days,
    durationLabel: duration.label,
  };
}

// ==========================================
// DEPENDENCY LINE COMPUTATION
// ==========================================

/**
 * Compute SVG connector lines for task relations visible in the current viewport.
 * Supported relation types:
 *   FS (Finish-to-Start):  blocks / blocked_by
 *   SS (Start-to-Start):   starts_before / starts_after
 *   FF (Finish-to-Finish): finishes_before / finishes_after
 *
 * Each line goes from the source anchor on the "from" bar to the target anchor
 * on the "to" bar, rendered as an elbow path in SVG.
 */
export function computeDependencyLines(
  tasks: Task[],
  barDataMap: Map<string, TimelineBarData>,
  dayWidth: number,
): DependencyLine[] {
  const lines: DependencyLine[] = [];

  const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]));
  const rowIndexMap = new Map<string, number>(tasks.map((t, i) => [t.id, i]));

  const FS_TYPES = new Set(['blocks', 'blocked_by']);
  const SS_TYPES = new Set(['starts_before', 'starts_after']);
  const FF_TYPES = new Set(['finishes_before', 'finishes_after']);

  for (const fromTask of tasks) {
    const relations = (fromTask.relations as Array<{ targetTaskId?: string; type?: string }>) || [];
    if (!Array.isArray(relations) || relations.length === 0) continue;

    const fromBar = barDataMap.get(fromTask.id);
    const fromRowIdx = rowIndexMap.get(fromTask.id);
    if (!fromBar || fromRowIdx === undefined) continue;

    for (const rel of relations) {
      const relType = rel?.type;
      const toTaskId = rel?.targetTaskId;
      if (!relType || !toTaskId) continue;

      // Skip non-timeline relations
      if (!FS_TYPES.has(relType) && !SS_TYPES.has(relType) && !FF_TYPES.has(relType)) continue;

      const toTask = taskMap.get(toTaskId);
      const toBar = barDataMap.get(toTaskId);
      const toRowIdx = rowIndexMap.get(toTaskId);
      if (!toTask || !toBar || toRowIdx === undefined) continue;
      if (!fromBar.hasDates || !toBar.hasDates) continue;
      if (fromBar.startIndex === -1 || toBar.startIndex === -1) continue;

      let depType: DepLineType;
      let fromX: number;
      let toX: number;
      let violated: boolean;

      if (FS_TYPES.has(relType)) {
        depType = 'FS';
        // Line exits right side of from-bar, enters left side of to-bar
        fromX = (fromBar.endIndex + 1) * dayWidth;
        toX = toBar.startIndex * dayWidth;
        // Violated: toTask starts before fromTask ends
        const toStart = parseDateOnly(toTask.startDate);
        const fromDue = parseDateOnly(fromTask.dueDate);
        violated = !!(toStart && fromDue && toStart < fromDue);
      } else if (SS_TYPES.has(relType)) {
        depType = 'SS';
        // Line exits left side of from-bar, enters left side of to-bar
        fromX = fromBar.startIndex * dayWidth;
        toX = toBar.startIndex * dayWidth;
        // Violated: toTask starts before fromTask starts
        const toStart = parseDateOnly(toTask.startDate);
        const fromStart = parseDateOnly(fromTask.startDate);
        violated = !!(toStart && fromStart && toStart < fromStart);
      } else {
        depType = 'FF';
        // Line exits right side of from-bar, enters right side of to-bar
        fromX = (fromBar.endIndex + 1) * dayWidth;
        toX = (toBar.endIndex + 1) * dayWidth;
        // Violated: toTask ends before fromTask ends
        const toDue = parseDateOnly(toTask.dueDate);
        const fromDue = parseDateOnly(fromTask.dueDate);
        violated = !!(toDue && fromDue && toDue < fromDue);
      }

      // Y = center of the row (header not included — offset handled in SVG)
      const fromY = fromRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const toY = toRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      lines.push({ fromTaskId: fromTask.id, toTaskId, fromX, fromY, toX, toY, type: depType, violated });
    }
  }

  return lines;
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

interface TimelineTopControlsProps {
  totalCount: number;
  zoom: TimelineZoom;
  onZoomChange: (zoom: TimelineZoom) => void;
  onTodayClick: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

function TimelineTopControls({
  totalCount,
  zoom,
  onZoomChange,
  onTodayClick,
  isFullscreen,
  onToggleFullscreen,
}: TimelineTopControlsProps) {
  const zoomOptions: Array<{ id: TimelineZoom; label: string }> = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
  ];

  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 border-b border-border bg-background select-none shrink-0">
      {/* 1. Work items Count */}
      <span className="text-xs text-muted-foreground font-normal">
        {totalCount} {totalCount === 1 ? 'Work item' : 'Work items'}
      </span>

      {/* 2. Zoom Selector: Week | Month | Quarter */}
      <div className="inline-flex items-center p-0.5 rounded-md bg-muted border border-border text-xs">
        {zoomOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onZoomChange(option.id)}
            className={`px-2.5 py-1 rounded-sm text-xs transition-all ${
              zoom === option.id
                ? 'bg-background text-foreground font-medium shadow-none'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 3. Today Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onTodayClick}
        className="h-7 px-3 text-xs font-normal border-border text-foreground hover:bg-muted"
      >
        Today
      </Button>

      {/* 4. Fullscreen Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={onToggleFullscreen}
        className="h-7 w-7 p-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
        title={isFullscreen ? 'Exit full screen' : 'Full screen'}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5 shrink-0" />
        )}
      </Button>
    </div>
  );
}

interface TimelineSidebarProps {
  tasks: Task[];
  columns: ColumnType[];
  onEditCard: (task: Task) => void;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  isReadOnly?: boolean;
  sidebarScrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

function TimelineSidebar({
  tasks,
  columns,
  onEditCard,
  onAddCard,
  isReadOnly = false,
  sidebarScrollRef,
  onScroll,
}: TimelineSidebarProps) {
  const defaultColumnId = columns[0]?.id || '';

  const getColumnForTask = (task: Task) => {
    return columns.find((column) => column.id === task.columnId);
  };

  return (
    <div
      className="shrink-0 border-r border-border flex flex-col bg-background select-none z-20 h-full overflow-hidden w-[200px] sm:w-[260px] md:w-[340px]"
    >
      {/* Fixed Sidebar Header (56px) */}
      <div
        className="flex items-center justify-between px-3 border-b border-border bg-background/95 backdrop-blur text-muted-foreground font-medium text-xs shrink-0"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <span className="font-semibold text-foreground">Work items</span>
        <span className="text-11 font-medium text-muted-foreground pr-1">Duration</span>
      </div>

      {/* Scrollable Rows Container (Synced with Canvas vertical scroll, hidden scrollbar) */}
      <div
        ref={sidebarScrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {tasks.map((task) => {
          const column = getColumnForTask(task);
          const identifier =
            task.identifier ||
            (task.sequenceNumber ? `TIEPT-${task.sequenceNumber}` : task.id.slice(0, 6));
          const duration = calculateDuration(task.startDate, task.dueDate);

          return (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              aria-label={`Work item: ${task.title}`}
              onClick={() => onEditCard(task)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEditCard(task);
                }
              }}
              className="flex items-center justify-between px-3 border-b border-border hover:bg-muted cursor-pointer transition-colors group text-xs shrink-0 outline-none focus-visible:ring-1 focus-visible:ring-primary"
              style={{ height: `${ROW_HEIGHT}px` }}
              title={task.title}
            >
              {/* Left: Status Icon, Identifier, Title */}
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                <StatusIcon
                  title={column?.title || 'Backlog'}
                  group={column?.slug || column?.title || 'backlog'}
                  color={column?.accentColor}
                  className="h-3.5 w-3.5 shrink-0"
                />
                <span className="text-11 font-mono text-muted-foreground shrink-0">
                  {identifier}
                </span>
                <span className="truncate text-foreground font-normal group-hover:text-primary transition-colors">
                  {task.title}
                </span>
              </div>

              {/* Right: Duration or No-dates badge */}
              <div className="shrink-0 pl-2">
                {duration.label === '-' ? (
                  <span className="text-10 text-muted-foreground/60 font-normal border border-dashed border-muted-foreground/30 rounded px-1.5 py-0.5 whitespace-nowrap">
                    No dates
                  </span>
                ) : (
                  <span className="text-11 text-muted-foreground font-mono">{duration.label}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pinned Bottom "+ New work item" (40px) */}
      {!isReadOnly && (
        <div
          className="border-t border-border flex items-center px-3 bg-background shrink-0"
          style={{ height: `${ROW_HEIGHT}px` }}
        >
          <button
            type="button"
            onClick={() => onAddCard(defaultColumnId)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors w-full text-left py-1"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>New work item</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface TimelineBarProps {
  task: Task;
  startIndex: number;
  endIndex: number;
  dayWidth: number;
  days: TimelineDayColumn[];
  column?: ColumnType;
  onEditCard: (task: Task) => void;
  onUpdateCard?: (task: { id: string } & Partial<Task>) => void;
  isReadOnly?: boolean;
}

function TimelineBar({
  task,
  startIndex,
  endIndex,
  dayWidth,
  days,
  column,
  onEditCard,
  onUpdateCard,
  isReadOnly = false,
}: TimelineBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [dragging, setDragging] = useState<'move' | 'start' | 'end' | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const startXRef = useRef<number>(0);
  const originalStartIndexRef = useRef<number>(startIndex);
  const originalEndIndexRef = useRef<number>(endIndex);

  // Drag interaction
  const handlePointerDown = (
    event: React.PointerEvent,
    mode: 'move' | 'start' | 'end'
  ) => {
    if (isReadOnly || !onUpdateCard) return;
    event.stopPropagation();
    event.preventDefault();

    setDragging(mode);
    startXRef.current = event.clientX;
    originalStartIndexRef.current = startIndex;
    originalEndIndexRef.current = endIndex;
    setDragOffset(0);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      const deltaDays = Math.round(deltaX / dayWidth);
      setDragOffset(deltaDays);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const deltaX = upEvent.clientX - startXRef.current;
      const deltaDays = Math.round(deltaX / dayWidth);
      setDragging(null);
      setDragOffset(0);

      if (deltaDays === 0) return;

      let newStartIndex = originalStartIndexRef.current;
      let newEndIndex = originalEndIndexRef.current;

      if (mode === 'move') {
        newStartIndex = Math.max(0, Math.min(days.length - 1, newStartIndex + deltaDays));
        newEndIndex = Math.max(0, Math.min(days.length - 1, newEndIndex + deltaDays));
      } else if (mode === 'start') {
        newStartIndex = Math.max(0, Math.min(newEndIndex, newStartIndex + deltaDays));
      } else if (mode === 'end') {
        newEndIndex = Math.max(newStartIndex, Math.min(days.length - 1, newEndIndex + deltaDays));
      }

      const newStartDate = days[newStartIndex]?.dateStr;
      const newDueDate = days[newEndIndex]?.dateStr;

      if (newStartDate && newDueDate) {
        onUpdateCard({
          id: task.id,
          startDate: newStartDate,
          dueDate: newDueDate,
        });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Compute live visual coordinates during drag
  let visualStart = startIndex;
  let visualEnd = endIndex;
  if (dragging === 'move') {
    visualStart = Math.max(0, Math.min(days.length - 1, startIndex + dragOffset));
    visualEnd = Math.max(0, Math.min(days.length - 1, endIndex + dragOffset));
  } else if (dragging === 'start') {
    visualStart = Math.max(0, Math.min(endIndex, startIndex + dragOffset));
  } else if (dragging === 'end') {
    visualEnd = Math.max(startIndex, Math.min(days.length - 1, endIndex + dragOffset));
  }

  const visualLeft = Math.max(0, visualStart * dayWidth);
  const visualWidth = Math.max(dayWidth, (visualEnd - visualStart + 1) * dayWidth);
  const accentColor = column?.accentColor || 'hsl(var(--primary))';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Timeline item: ${task.title}`}
      onKeyDown={(e) => {
        if (!dragging && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onEditCard(task);
        }
      }}
      style={{
        left: `${visualLeft}px`,
        width: `${visualWidth}px`,
        height: '28px',
        top: '6px',
        backgroundColor: accentColor,
      }}
      className={`absolute z-10 rounded-md flex items-center px-2 text-white select-none transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary ${
        dragging ? 'opacity-90 ring-2 ring-primary cursor-grabbing' : 'cursor-pointer hover:brightness-105'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(event) => {
        if (!dragging) {
          event.stopPropagation();
          onEditCard(task);
        }
      }}
      title={`${task.title} (${task.startDate || 'No start'} -> ${task.dueDate || 'No due'})`}
    >
      {/* Left resize handle */}
      {!isReadOnly && onUpdateCard && (
        <div
          onPointerDown={(event) => handlePointerDown(event, 'start')}
          className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l-md hover:bg-black/20 flex items-center justify-center transition-opacity ${
            isHovered || dragging === 'start' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-0.5 h-3 bg-primary-foreground rounded-full" />
        </div>
      )}

      {/* Main bar content (clickable & draggable for moving) */}
      <div
        className="flex items-center gap-1.5 min-w-0 flex-1 h-full cursor-pointer px-1"
        onPointerDown={(event) => handlePointerDown(event, 'move')}
      >
        <StatusIcon
          title={column?.title || 'Backlog'}
          group={column?.slug || column?.title || 'backlog'}
          color={column?.accentColor}
          className="h-3 w-3 shrink-0 text-primary-foreground"
        />
        <span className="text-11 font-medium truncate text-primary-foreground">
          {task.title}
        </span>
      </div>

      {/* Right resize handle */}
      {!isReadOnly && onUpdateCard && (
        <div
          onPointerDown={(event) => handlePointerDown(event, 'end')}
          className={`absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r-md hover:bg-black/20 flex items-center justify-center transition-opacity ${
            isHovered || dragging === 'end' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-0.5 h-3 bg-primary-foreground rounded-full" />
        </div>
      )}
    </div>
  );
}

// ==========================================
// DEPENDENCY OVERLAY (Phase 3)
// ==========================================

interface DependencyOverlayProps {
  lines: DependencyLine[];
  totalWidth: number;
  totalHeight: number;
}

/**
 * Renders SVG elbow connector lines for task dependencies.
 * Positioned absolutely over the rows section of the canvas (below header).
 * An "elbow" path: horizontal → vertical → horizontal, with a small arrowhead at the end.
 */
function DependencyOverlay({ lines, totalWidth, totalHeight }: DependencyOverlayProps) {
  if (lines.length === 0) return null;

  const ELBOW_OFFSET = 12; // horizontal offset before turning vertical

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-20"
      width={totalWidth}
      height={totalHeight}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker
          id="dep-arrow-normal"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="hsl(var(--primary) / 0.7)" />
        </marker>
        <marker
          id="dep-arrow-violated"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="hsl(var(--destructive) / 0.9)" />
        </marker>
      </defs>

      {lines.map((line, idx) => {
        const { fromX, fromY, toX, toY, violated } = line;
        const stroke = violated ? 'hsl(var(--destructive) / 0.9)' : 'hsl(var(--primary) / 0.6)';
        const markerId = violated ? 'dep-arrow-violated' : 'dep-arrow-normal';

        // Build elbow path: from → elbow → vertical → to
        let d: string;
        const midX1 = fromX + ELBOW_OFFSET;
        const midX2 = toX - ELBOW_OFFSET;

        if (Math.abs(fromY - toY) < 2) {
          // Same row: straight line
          d = `M ${fromX} ${fromY} L ${toX} ${toY}`;
        } else if (midX1 <= midX2) {
          // Normal routing: right then down/up then right
          d = `M ${fromX} ${fromY} H ${midX1} V ${toY} H ${toX}`;
        } else {
          // Reverse routing (to-bar is to the left): go further right to avoid overlap
          const detourX = Math.max(fromX, toX) + ELBOW_OFFSET * 2;
          d = `M ${fromX} ${fromY} H ${detourX} V ${toY} H ${toX}`;
        }

        return (
          <path
            key={`dep-${idx}`}
            d={d}
            stroke={stroke}
            strokeWidth={1.5}
            fill="none"
            strokeDasharray={violated ? '5,3' : undefined}
            markerEnd={`url(#${markerId})`}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

interface TimelineCanvasProps {
  tasks: Task[];
  columns: ColumnType[];
  days: TimelineDayColumn[];
  zoom: TimelineZoom;
  dayWidth: number;
  onEditCard: (task: Task) => void;
  onUpdateCard?: (task: { id: string } & Partial<Task>) => void;
  isReadOnly?: boolean;
  canvasScrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

function TimelineCanvas({
  tasks,
  columns,
  days,
  zoom,
  dayWidth,
  onEditCard,
  onUpdateCard,
  isReadOnly = false,
  canvasScrollRef,
  onScroll,
}: TimelineCanvasProps) {
  const totalWidth = days.length * dayWidth;
  const monthGroups = getMonthYearGroups(days);
  const weekGroups = getWeekGroups(days);

  const getColumnForTask = (task: Task) => {
    return columns.find((column) => column.id === task.columnId);
  };

  // Quick-add dates by clicking on empty row
  const handleEmptyRowClick = (task: Task, day: TimelineDayColumn) => {
    if (isReadOnly || !onUpdateCard) return;
    onUpdateCard({
      id: task.id,
      startDate: day.dateStr,
      dueDate: day.dateStr,
    });
  };

  // ── Phase 2: Today line position ──────────────────────────────────────────
  const todayIndex = days.findIndex((d) => d.isToday);
  const todayLineX = todayIndex >= 0 ? todayIndex * dayWidth + dayWidth / 2 : null;

  // ── Phase 3: Compute bar data map for dependency lines ────────────────────
  const barDataMap = useMemo(() => {
    const map = new Map<string, TimelineBarData>();
    for (const task of tasks) {
      map.set(task.id, mapTaskToBar(task, days));
    }
    return map;
  }, [tasks, days]);

  const depLines = useMemo(
    () => computeDependencyLines(tasks, barDataMap, dayWidth),
    [tasks, barDataMap, dayWidth],
  );

  const totalRowsHeight = tasks.length * ROW_HEIGHT;

  return (
    <div
      ref={canvasScrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-auto select-none bg-background relative"
    >
      <div style={{ width: `${totalWidth}px` }} className="min-w-full relative flex flex-col">
        {/* Sticky Dual-tier Header */}
        <div
          className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border select-none"
          style={{ height: `${HEADER_HEIGHT}px` }}
        >
          {/* Tier 1: Month / Year / Week groups (28px) */}
          <div className="flex h-7 border-b border-border text-xs font-medium text-muted-foreground overflow-hidden">
            {zoom === 'quarter' ? (
              // Quarter zoom: show Month groups
              monthGroups.map((group) => (
                <div
                  key={group.key}
                  style={{ width: `${group.spanCount * dayWidth}px` }}
                  className="shrink-0 px-2.5 flex items-center border-r border-border text-foreground font-semibold truncate text-11"
                >
                  {group.label}
                </div>
              ))
            ) : (
              // Week & Month zoom: show Month-Year & Week groups
              weekGroups.map((group) => (
                <div
                  key={group.key}
                  style={{ width: `${group.spanCount * dayWidth}px` }}
                  className="shrink-0 px-2 flex items-center justify-between border-r border-border text-11 truncate"
                >
                  <span className="font-semibold text-foreground">{group.label}</span>
                  <span className="text-10 text-muted-foreground">
                    {days[group.startIndex]?.monthYearKey}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Tier 2: Days (28px) e.g. "4 Sa", "5 Su", "11 Sa" */}
          <div className="flex h-7">
            {days.map((day) => (
              <div
                key={day.dateStr}
                style={{ width: `${dayWidth}px` }}
                className={`shrink-0 flex items-center justify-center border-r border-border text-11 font-medium transition-colors ${
                  day.isWeekend ? 'bg-secondary' : ''
                } ${day.isToday ? 'font-bold' : 'text-muted-foreground'}`}
              >
                {day.isToday ? (
                  <div className="flex items-center gap-1">
                    <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center font-semibold text-10 shadow-none">
                      {day.dayNumber}
                    </span>
                    <span className="text-10 text-primary font-semibold">{day.dayOfWeek}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5 text-foreground">
                    <span className="text-11 font-normal">{day.dayNumber}</span>
                    <span className="text-10 text-muted-foreground font-normal">{day.dayOfWeek}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Grid Background & Rows */}
        <div className="relative flex-1">
          {/* Vertical grid lines and Today Highlight Column */}
          <div className="absolute inset-0 flex pointer-events-none z-0">
            {days.map((day) => (
              <div
                key={`col-bg-${day.dateStr}`}
                style={{ width: `${dayWidth}px` }}
                className={`shrink-0 border-r border-border h-full ${
                  day.isWeekend ? 'bg-secondary' : ''
                } ${day.isToday ? 'bg-muted' : ''}`}
              />
            ))}
          </div>

          {/* Phase 2: Today vertical dashed line */}
          {todayLineX !== null && (
            <div
              aria-hidden="true"
              className="absolute top-0 bottom-0 pointer-events-none z-25"
              style={{ left: `${todayLineX}px`, transform: 'translateX(-50%)' }}
            >
              <div className="h-full border-l-2 border-dashed border-primary/50" />
              <span
                className="absolute top-1 left-1 text-10 font-semibold text-primary/70 bg-background/80 px-1 rounded whitespace-nowrap select-none"
                style={{ fontSize: '10px' }}
              >
                Today
              </span>
            </div>
          )}

          {/* Phase 3: Dependency connector lines SVG overlay */}
          <DependencyOverlay
            lines={depLines}
            totalWidth={totalWidth}
            totalHeight={totalRowsHeight}
          />

          {/* Task rows */}
          <div className="relative z-10 flex flex-col">
            {tasks.map((task) => {
              const column = getColumnForTask(task);
              const barData = barDataMap.get(task.id) ?? mapTaskToBar(task, days);

              return (
                <div
                  key={task.id}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className="border-b border-border relative flex items-center group/row hover:bg-muted transition-colors"
                >
                  {barData.hasDates ? (
                    <TimelineBar
                      task={task}
                      startIndex={barData.startIndex}
                      endIndex={barData.endIndex}
                      dayWidth={dayWidth}
                      days={days}
                      column={column}
                      onEditCard={onEditCard}
                      onUpdateCard={onUpdateCard}
                      isReadOnly={isReadOnly}
                    />
                  ) : (
                    // Phase 4: Empty row — clickable cells + dashed placeholder hint
                    <div className="absolute inset-0 flex">
                      {days.map((day) => (
                        <div
                          key={`cell-${task.id}-${day.dateStr}`}
                          style={{ width: `${dayWidth}px` }}
                          onClick={() => handleEmptyRowClick(task, day)}
                          className="h-full cursor-pointer hover:bg-primary/5 transition-colors group/cell flex items-center justify-center relative"
                          title="Click to set start date"
                        />
                      ))}
                      {/* Centered "No dates" dashed placeholder — visible on row hover */}
                      {!isReadOnly && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <div className="border border-dashed border-muted-foreground/40 rounded-md px-3 h-6 flex items-center text-10 text-muted-foreground/60 font-normal whitespace-nowrap select-none">
                            Click to set date
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom spacing row matching sidebar "+ New work item" */}
          <div
            style={{ height: `${ROW_HEIGHT}px` }}
            className="border-t border-border relative z-10 bg-background"
          />
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export function TimelineView({
  items: propItems,
  tasks: propTasks,
  columns,
  onAddCard,
  onEditCard,
  onUpdateCard,
  isReadOnly = false,
}: TimelineViewProps) {
  const tasks = propItems || propTasks || [];
  const items = tasks;
  // Zoom state with localStorage persistence
  const [zoom, setZoom] = useState<TimelineZoom>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('flux:timeline_view:zoom') as TimelineZoom;
      if (saved === 'week' || saved === 'month' || saved === 'quarter') {
        return saved;
      }
    }
    return 'week';
  });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasScrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const dayWidth = DAY_WIDTHS[zoom];

  const handleZoomChange = (newZoom: TimelineZoom) => {
    setZoom(newZoom);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flux:timeline_view:zoom', newZoom);
    }
  };

  // Generate calendar days
  const days = useMemo(() => {
    return getTimelineDays(new Date(), zoom);
  }, [zoom]);

  // Center timeline on "Today"
  const scrollToToday = useCallback(() => {
    if (!canvasScrollRef.current) return;
    const todayIndex = days.findIndex((columnDay) => columnDay.isToday);
    if (todayIndex !== -1) {
      const containerWidth = canvasScrollRef.current.clientWidth;
      const targetLeft = todayIndex * dayWidth - containerWidth / 2 + dayWidth / 2;
      canvasScrollRef.current.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    }
  }, [days, dayWidth]);

  // Initial scroll to today
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToToday();
    }, 100);
    return () => clearTimeout(timer);
  }, [zoom, scrollToToday]);

  // Synchronize vertical scroll between canvas and sidebar
  const handleCanvasScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current) return;
    if (sidebarScrollRef.current) {
      isSyncingRef.current = true;
      sidebarScrollRef.current.scrollTop = event.currentTarget.scrollTop;
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    }
  };

  const handleSidebarScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current) return;
    if (canvasScrollRef.current) {
      isSyncingRef.current = true;
      canvasScrollRef.current.scrollTop = event.currentTarget.scrollTop;
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    }
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullscreen(true);
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  // Listen to external fullscreen exit (e.g. Escape key)
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full w-full bg-background select-none ${
        isFullscreen ? 'fixed inset-0 z-50 p-4 bg-background' : 'p-4'
      }`}
    >
      {/* Top Controls: Work item count, Zoom selector (Week | Month | Quarter), Today, Fullscreen */}
      <TimelineTopControls
        totalCount={tasks.length}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onTodayClick={scrollToToday}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Main Gantt Grid: Frozen Sidebar (Work items + Duration + New) & Scrollable Canvas */}
      <div className="flex-1 flex min-h-0 overflow-hidden border border-border rounded-lg bg-background ">
        <TimelineSidebar
          tasks={tasks}
          columns={columns}
          onEditCard={onEditCard}
          onAddCard={onAddCard}
          isReadOnly={isReadOnly}
          sidebarScrollRef={sidebarScrollRef}
          onScroll={handleSidebarScroll}
        />

        <TimelineCanvas
          tasks={tasks}
          columns={columns}
          days={days}
          zoom={zoom}
          dayWidth={dayWidth}
          onEditCard={onEditCard}
          onUpdateCard={onUpdateCard}
          isReadOnly={isReadOnly}
          canvasScrollRef={canvasScrollRef}
          onScroll={handleCanvasScroll}
        />
      </div>
    </div>
  );
}

export default TimelineView;
