'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Plus } from 'lucide-react';
import { StatusIcon } from '@/shared/components/icons';
import { cn } from "@/shared/lib/utils";
import { toast } from 'sonner';
import { RelationService } from '../../services/relation.service';
import type { Item, Column as ColumnType, BaseWorkItemViewProps, WorkItemCardHandlers } from '../../types/work-item.types';

// ============================================================================
// TYPES
// ============================================================================

export type TimelineZoom = 'week' | 'month' | 'quarter';

export interface TimelineColumn {
  id: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  isWeekend?: boolean;
  primaryLabel: string;
  secondaryLabel?: string;
  width: number;
}

export interface TimelineTier1Group {
  id: string;
  label: string;
  subLabel?: string;
  isCurrent?: boolean;
  startIndex: number;
  spanCount: number;
  width: number;
}

export interface TimelineBarData {
  item: Item;
  hasDates: boolean;
  pixelLeft: number;
  pixelWidth: number;
  durationDays: number;
  durationLabel: string;
  effectiveStart?: Date;
  effectiveDue?: Date;
}

export type DepLineType = 'FS' | 'SS' | 'FF';

export interface DependencyLine {
  fromItemId: string;
  toItemId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  type: DepLineType;
  violated: boolean;
}

export interface TimelineViewProps extends BaseWorkItemViewProps, WorkItemCardHandlers {
  items?: Item[];
  columns: ColumnType[];
  projectId?: string;
  workspaceId?: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
}

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

export const ROW_HEIGHT = 38;
export const HEADER_HEIGHT = 60;
export const SIDEBAR_WIDTH = 320;

export const COLUMN_WIDTHS: Record<TimelineZoom, number> = {
  week: 48,
  month: 84,
  quarter: 110,
};

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

export const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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

/** Get Monday of the week containing targetDate */
export function getStartOfWeek(targetDate: Date): Date {
  const date = new Date(targetDate.getTime());
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return date;
}

/** Get Sunday of the week containing targetDate */
export function getEndOfWeek(targetDate: Date): Date {
  const start = getStartOfWeek(targetDate);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function calculateDuration(
  startDate?: string | null,
  dueDate?: string | null
): { days: number; label: string } {
  const start = parseDateOnly(startDate);
  const due = parseDateOnly(dueDate);

  if (!start && !due) {
    return { days: 0, label: '' };
  }

  const effectiveStart = start || due!;
  const effectiveDue = due || start!;
  const diffMs = effectiveDue.getTime() - effectiveStart.getTime();
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

// ============================================================================
// TIMELINE COLUMN & HEADER BUILDERS
// ============================================================================

export function buildTimelineData(zoom: TimelineZoom, centerDate: Date = new Date()): {
  columns: TimelineColumn[];
  tier1Groups: TimelineTier1Group[];
  currentColumnIndex: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatToDateStr(today);

  if (zoom === 'week') {
    // ------------------------------------------------------------------------
    // WEEK ZOOM (Days granularity)
    // Tier 1: Weeks (Month + "Week XX")
    // Tier 2: Days ("8 W", "9 Th", "16 Th" with blue badge)
    // ------------------------------------------------------------------------
    const colWidth = COLUMN_WIDTHS.week;
    const startMonday = getStartOfWeek(centerDate);
    // 3 weeks prior, 11 weeks future = 14 full weeks (98 days)
    startMonday.setDate(startMonday.getDate() - 21);

    const totalWeeks = 14;
    const columns: TimelineColumn[] = [];
    const tier1Groups: TimelineTier1Group[] = [];

    let currentColumnIndex = -1;

    for (let w = 0; w < totalWeeks; w++) {
      const weekStart = new Date(startMonday.getTime());
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekNumber = getISOWeekNumber(weekStart);
      const monthYearKey = `${MONTH_NAMES_SHORT[weekStart.getMonth()]} ${weekStart.getFullYear()}`;

      tier1Groups.push({
        id: `w-group-${w}-${weekNumber}`,
        label: monthYearKey,
        subLabel: `Week ${weekNumber}`,
        startIndex: w * 7,
        spanCount: 7,
        width: 7 * colWidth,
      });

      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(weekStart.getTime());
        dayDate.setDate(dayDate.getDate() + d);
        const dateStr = formatToDateStr(dayDate);
        const isToday = dateStr === todayStr;
        const dayOfWeekIndex = dayDate.getDay();

        if (isToday) {
          currentColumnIndex = columns.length;
        }

        columns.push({
          id: dateStr,
          startDate: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0, 0, 0),
          endDate: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59, 59, 999),
          isCurrent: isToday,
          isWeekend: dayOfWeekIndex === 0 || dayOfWeekIndex === 6,
          primaryLabel: String(dayDate.getDate()),
          secondaryLabel: DAY_OF_WEEK_ABBR[dayOfWeekIndex],
          width: colWidth,
        });
      }
    }

    return { columns, tier1Groups, currentColumnIndex };
  }

  if (zoom === 'month') {
    // ------------------------------------------------------------------------
    // MONTH ZOOM (Weeks granularity)
    // Tier 1: Months ("August 2026", "September 2026 [Current]", "October 2026")
    // Tier 2: Weeks ("W34 23-29", "W37 13-19" with blue badge)
    // ------------------------------------------------------------------------
    const colWidth = COLUMN_WIDTHS.month;
    const startMonday = getStartOfWeek(centerDate);
    // 8 weeks prior, 20 weeks future = 28 weeks
    startMonday.setDate(startMonday.getDate() - 56);
    const totalWeeks = 28;

    const columns: TimelineColumn[] = [];
    let currentColumnIndex = -1;

    for (let w = 0; w < totalWeeks; w++) {
      const weekStart = new Date(startMonday.getTime());
      weekStart.setDate(weekStart.getDate() + w * 7);
      const weekEnd = new Date(weekStart.getTime());
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekNumber = getISOWeekNumber(weekStart);
      const isCurrentWeek = today >= weekStart && today <= weekEnd;

      if (isCurrentWeek) {
        currentColumnIndex = columns.length;
      }

      columns.push({
        id: `week-${w}-${weekNumber}`,
        startDate: weekStart,
        endDate: weekEnd,
        isCurrent: isCurrentWeek,
        primaryLabel: `W${weekNumber}`,
        secondaryLabel: `${weekStart.getDate()}-${weekEnd.getDate()}`,
        width: colWidth,
      });
    }

    // Group weeks into Months based on Thursday of each week (ISO-8601 month rule)
    const tier1Groups: TimelineTier1Group[] = [];
    let currentMonthKey = '';
    let currentGroup: TimelineTier1Group | null = null;

    columns.forEach((col, idx) => {
      const midWeek = new Date(col.startDate.getTime());
      midWeek.setDate(midWeek.getDate() + 3);
      const monthKey = `${MONTH_NAMES_FULL[midWeek.getMonth()]} ${midWeek.getFullYear()}`;
      const isThisMonthCurrent =
        today.getMonth() === midWeek.getMonth() &&
        today.getFullYear() === midWeek.getFullYear();

      if (monthKey !== currentMonthKey) {
        currentMonthKey = monthKey;
        currentGroup = {
          id: `m-group-${monthKey}-${idx}`,
          label: monthKey,
          isCurrent: isThisMonthCurrent,
          startIndex: idx,
          spanCount: 1,
          width: colWidth,
        };
        tier1Groups.push(currentGroup);
      } else if (currentGroup) {
        currentGroup.spanCount++;
        currentGroup.width += colWidth;
        if (isThisMonthCurrent) {
          currentGroup.isCurrent = true;
        }
      }
    });

    return { columns, tier1Groups, currentColumnIndex };
  }

  // --------------------------------------------------------------------------
  // QUARTER ZOOM (Months granularity)
  // Tier 1: Quarters ("Q3 2026 [Current]", "Q4 2026")
  // Tier 2: Months ("August", "September" with blue badge)
  // --------------------------------------------------------------------------
  const colWidth = COLUMN_WIDTHS.quarter;
  const startMonthDate = new Date(centerDate.getFullYear(), centerDate.getMonth() - 5, 1);
  const totalMonths = 22;

  const columns: TimelineColumn[] = [];
  const tier1Groups: TimelineTier1Group[] = [];
  let currentColumnIndex = -1;

  let currentQuarterKey = '';
  let currentGroup: TimelineTier1Group | null = null;

  for (let m = 0; m < totalMonths; m++) {
    const monthDate = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + m, 1);
    const monthEndDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const isCurrentMonth =
      today.getMonth() === monthDate.getMonth() &&
      today.getFullYear() === monthDate.getFullYear();

    if (isCurrentMonth) {
      currentColumnIndex = columns.length;
    }

    columns.push({
      id: `month-${monthDate.getFullYear()}-${monthDate.getMonth()}`,
      startDate: monthDate,
      endDate: monthEndDate,
      isCurrent: isCurrentMonth,
      primaryLabel: MONTH_NAMES_FULL[monthDate.getMonth()],
      width: colWidth,
    });

    const quarterNumber = Math.floor(monthDate.getMonth() / 3) + 1;
    const quarterKey = `Q${quarterNumber} ${monthDate.getFullYear()}`;
    const isCurrentQuarter =
      Math.floor(today.getMonth() / 3) + 1 === quarterNumber &&
      today.getFullYear() === monthDate.getFullYear();

    if (quarterKey !== currentQuarterKey) {
      currentQuarterKey = quarterKey;
      currentGroup = {
        id: `q-group-${quarterKey}-${m}`,
        label: quarterKey,
        isCurrent: isCurrentQuarter,
        startIndex: m,
        spanCount: 1,
        width: colWidth,
      };
      tier1Groups.push(currentGroup);
    } else if (currentGroup) {
      currentGroup.spanCount++;
      currentGroup.width += colWidth;
      if (isCurrentQuarter) {
        currentGroup.isCurrent = true;
      }
    }
  }

  return { columns, tier1Groups, currentColumnIndex };
}

// ============================================================================
// PIXEL & DATE COORDINATE HELPERS
// ============================================================================

export function getPixelRange(
  start: Date,
  due: Date,
  columns: TimelineColumn[],
  zoom: TimelineZoom
): { left: number; width: number } {
  if (columns.length === 0) return { left: 0, width: 0 };

  const minTime = columns[0].startDate.getTime();
  const maxTime = columns[columns.length - 1].endDate.getTime();

  const effectiveStart = new Date(Math.max(minTime, Math.min(maxTime, start.getTime())));
  const effectiveDue = new Date(Math.max(minTime, Math.min(maxTime, due.getTime())));

  const getPixelForTime = (time: number, isEnd = false) => {
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const colStart = col.startDate.getTime();
      const colEnd = col.endDate.getTime();
      if (time >= colStart && time <= colEnd) {
        const span = Math.max(1, colEnd - colStart);
        const frac = Math.min(1, Math.max(0, (time - colStart) / span));
        let x = i * col.width + frac * col.width;
        if (isEnd) {
          x = Math.max(x, i * col.width + col.width);
        }
        return x;
      }
    }
    if (time < minTime) return 0;
    return columns.length * (columns[0]?.width || COLUMN_WIDTHS[zoom]);
  };

  const left = getPixelForTime(effectiveStart.getTime(), false);
  const dueEndOfDay = new Date(effectiveDue.getTime());
  dueEndOfDay.setHours(23, 59, 59, 999);
  const right = getPixelForTime(dueEndOfDay.getTime(), true);

  const minWidth = Math.max(24, Math.min(columns[0]?.width || 36, 40));
  const width = Math.max(minWidth, right - left);

  return { left, width };
}

export function mapItemToBar(
  item: Item,
  columns: TimelineColumn[],
  zoom: TimelineZoom
): TimelineBarData {
  const start = parseDateOnly(item.startDate);
  const due = parseDateOnly(item.dueDate);
  const duration = calculateDuration(item.startDate, item.dueDate);

  if (!start && !due) {
    return {
      item,
      hasDates: false,
      pixelLeft: 0,
      pixelWidth: 0,
      durationDays: 0,
      durationLabel: '',
    };
  }

  const effectiveStart = start || due!;
  const effectiveDue = due || start!;
  const { left, width } = getPixelRange(effectiveStart, effectiveDue, columns, zoom);

  return {
    item,
    hasDates: true,
    pixelLeft: left,
    pixelWidth: width,
    durationDays: duration.days,
    durationLabel: duration.label,
    effectiveStart,
    effectiveDue,
  };
}

// ============================================================================
// DEPENDENCY LINES
// ============================================================================

export function computeDependencyLines(
  items: Item[],
  barDataMap: Map<string, TimelineBarData>,
): DependencyLine[] {
  const lines: DependencyLine[] = [];
  const itemMap = new Map<string, Item>(items.map((t) => [t.id, t]));
  const rowIndexMap = new Map<string, number>(items.map((t, i) => [t.id, i]));

  const FS_TYPES = new Set(['blocks', 'blocked_by']);
  const SS_TYPES = new Set(['starts_before', 'starts_after']);
  const FF_TYPES = new Set(['finishes_before', 'finishes_after']);

  for (const fromItem of items) {
    const relations = (fromItem.relations as Array<{ targetWorkItemId?: string; targetId?: string; type?: string }>) || [];
    if (!Array.isArray(relations) || relations.length === 0) continue;

    const fromBar = barDataMap.get(fromItem.id);
    const fromRowIdx = rowIndexMap.get(fromItem.id);
    if (!fromBar || fromRowIdx === undefined) continue;

    for (const rel of relations) {
      const relType = rel?.type;
      const toItemId = rel?.targetWorkItemId || rel?.targetId;
      if (!relType || !toItemId) continue;

      if (!FS_TYPES.has(relType) && !SS_TYPES.has(relType) && !FF_TYPES.has(relType)) continue;

      const toItem = itemMap.get(toItemId);
      const toBar = barDataMap.get(toItemId);
      const toRowIdx = rowIndexMap.get(toItemId);
      if (!toItem || !toBar || toRowIdx === undefined) continue;
      if (!fromBar.hasDates || !toBar.hasDates) continue;

      let depType: DepLineType;
      let fromX: number;
      let toX: number;
      let violated: boolean;

      if (FS_TYPES.has(relType)) {
        depType = 'FS';
        fromX = fromBar.pixelLeft + fromBar.pixelWidth;
        toX = toBar.pixelLeft;
        const toStart = parseDateOnly(toItem.startDate);
        const fromDue = parseDateOnly(fromItem.dueDate);
        violated = !!(toStart && fromDue && toStart < fromDue);
      } else if (SS_TYPES.has(relType)) {
        depType = 'SS';
        fromX = fromBar.pixelLeft;
        toX = toBar.pixelLeft;
        const toStart = parseDateOnly(toItem.startDate);
        const fromStart = parseDateOnly(fromItem.startDate);
        violated = !!(toStart && fromStart && toStart < fromStart);
      } else {
        depType = 'FF';
        fromX = fromBar.pixelLeft + fromBar.pixelWidth;
        toX = toBar.pixelLeft + toBar.pixelWidth;
        const toDue = parseDateOnly(toItem.dueDate);
        const fromDue = parseDateOnly(fromItem.dueDate);
        violated = !!(toDue && fromDue && toDue < fromDue);
      }

      const fromY = fromRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
      const toY = toRowIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

      lines.push({ fromItemId: fromItem.id, toItemId, fromX, fromY, toX, toY, type: depType, violated });
    }
  }

  return lines;
}

// ============================================================================
// TOP CONTROLS
// ============================================================================

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
      <span className="text-xs text-muted-foreground font-normal tabular-nums">
        {totalCount} {totalCount === 1 ? 'Work item' : 'Work items'}
      </span>

      {/* 2. Zoom Options (Plane segmented style) */}
      <div className="inline-flex items-center gap-0.5 text-xs">
        {zoomOptions.map((option) => {
          const isActive = zoom === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onZoomChange(option.id)}
              className={cn(
                'px-2.5 py-1 rounded text-xs transition-colors cursor-pointer select-none',
                isActive
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* 3. Today Button */}
      <button
        type="button"
        onClick={onTodayClick}
        className="px-2.5 py-1 text-xs font-normal text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer select-none"
      >
        Today
      </button>

      {/* 4. Fullscreen Button */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors cursor-pointer select-none"
        title={isFullscreen ? 'Exit full screen' : 'Full screen'}
        aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
      >
        {isFullscreen ? (
          <Minimize2 className="size-3.5 shrink-0" />
        ) : (
          <Maximize2 className="size-3.5 shrink-0" />
        )}
      </button>
    </div>
  );
}

// ============================================================================
// SIDEBAR (FROZEN WORK ITEMS LIST)
// ============================================================================

interface TimelineSidebarProps {
  items: Item[];
  columns: ColumnType[];
  onEditCard: (item: Item) => void;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  isReadOnly?: boolean;
  sidebarScrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

function TimelineSidebar({
  items,
  columns,
  onEditCard,
  onAddCard,
  isReadOnly = false,
  sidebarScrollRef,
  onScroll,
}: TimelineSidebarProps) {
  const defaultColumnId = columns[0]?.id || '';

  return (
    <div
      style={{ width: `${SIDEBAR_WIDTH}px` }}
      className="shrink-0 border-r border-border flex flex-col bg-background select-none z-20 h-full overflow-hidden"
    >
      {/* 60px Sidebar Header matching 2-tier timeline header */}
      <div
        className="flex items-end justify-between px-4 pb-2 border-b border-border bg-background text-muted-foreground text-xs font-normal shrink-0"
        style={{ height: `${HEADER_HEIGHT}px` }}
      >
        <span className="text-muted-foreground">Work items</span>
        <span className="text-muted-foreground">Duration</span>
      </div>

      {/* Scrollable Work Item Rows */}
      <div
        ref={sidebarScrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const identifier =
            item.identifier ||
            (item.sequenceNumber ? `PLO-${item.sequenceNumber}` : `PLO-${item.id.slice(0, 4)}`);
          const duration = calculateDuration(item.startDate, item.dueDate);

          return (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              aria-label={`Work item: ${item.title}`}
              onClick={() => onEditCard(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onEditCard(item);
                }
              }}
              className="flex items-center justify-between px-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors group text-xs shrink-0 outline-none focus-visible:bg-muted"
              style={{ height: `${ROW_HEIGHT}px` }}
              title={item.title}
            >
              {/* Left: Identifier + Title */}
              <div className="flex items-center gap-2 min-w-0 flex-1 pr-3">
                <span className="text-xs text-muted-foreground font-normal shrink-0 min-w-[48px]">
                  {identifier}
                </span>
                <span className="truncate text-xs text-foreground font-normal group-hover:text-primary transition-colors">
                  {item.title}
                </span>
              </div>

              {/* Right: Duration (Blank when no dates, clean string when set) */}
              <div className="shrink-0 text-right">
                {duration.label ? (
                  <span className="text-xs text-muted-foreground font-normal">
                    {duration.label}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pinned Bottom "+ New work item" row */}
      {!isReadOnly && (
        <div
          className="border-t border-border flex items-center px-4 bg-background shrink-0 select-none"
          style={{ height: `${ROW_HEIGHT}px` }}
        >
          <button
            type="button"
            onClick={() => onAddCard(defaultColumnId)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer w-full text-left"
          >
            <Plus className="size-3.5 shrink-0" />
            <span>New work item</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TIMELINE GANTT BAR
// ============================================================================

interface TimelineBarProps {
  item: Item;
  barData: TimelineBarData;
  columns: TimelineColumn[];
  zoom: TimelineZoom;
  stateColumn?: ColumnType;
  rowIndex?: number;
  onEditCard: (item: Item) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  onStartConnect?: (itemId: string, side: 'start' | 'end', startX: number, startY: number) => void;
  isConnecting?: boolean;
  isConnectTarget?: boolean;
  isReadOnly?: boolean;
}

function TimelineBar({
  item,
  barData,
  zoom,
  stateColumn,
  rowIndex = 0,
  onEditCard,
  onUpdateCard,
  onStartConnect,
  isConnecting = false,
  isConnectTarget = false,
  isReadOnly = false,
}: TimelineBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [dragging, setDragging] = useState<'move' | 'start' | 'end' | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);
  const startXRef = useRef<number>(0);

  // Drag logic
  const handlePointerDown = (
    event: React.PointerEvent,
    mode: 'move' | 'start' | 'end'
  ) => {
    if (isReadOnly || !onUpdateCard) return;
    event.stopPropagation();
    event.preventDefault();

    setDragging(mode);
    startXRef.current = event.clientX;
    setDragOffsetPx(0);

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startXRef.current;
      setDragOffsetPx(deltaX);
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      const deltaX = upEvent.clientX - startXRef.current;
      setDragging(null);
      setDragOffsetPx(0);

      if (Math.abs(deltaX) < 4) return;

      const pixelsPerDay =
        zoom === 'week'
          ? COLUMN_WIDTHS.week
          : zoom === 'month'
          ? COLUMN_WIDTHS.month / 7
          : COLUMN_WIDTHS.quarter / 30;

      const deltaDays = Math.round(deltaX / pixelsPerDay);
      if (deltaDays === 0) return;

      const currentStart = barData.effectiveStart || new Date();
      const currentDue = barData.effectiveDue || new Date();

      let newStart = new Date(currentStart.getTime());
      let newDue = new Date(currentDue.getTime());

      if (mode === 'move') {
        newStart.setDate(newStart.getDate() + deltaDays);
        newDue.setDate(newDue.getDate() + deltaDays);
      } else if (mode === 'start') {
        newStart.setDate(newStart.getDate() + deltaDays);
        if (newStart > newDue) newStart = new Date(newDue.getTime());
      } else if (mode === 'end') {
        newDue.setDate(newDue.getDate() + deltaDays);
        if (newDue < newStart) newDue = new Date(newStart.getTime());
      }

      onUpdateCard({
        id: item.id,
        startDate: formatToDateStr(newStart),
        dueDate: formatToDateStr(newDue),
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  let visualLeft = barData.pixelLeft;
  let visualWidth = barData.pixelWidth;

  if (dragging === 'move') {
    visualLeft = Math.max(0, barData.pixelLeft + dragOffsetPx);
  } else if (dragging === 'start') {
    const rawLeft = barData.pixelLeft + dragOffsetPx;
    const maxLeft = barData.pixelLeft + barData.pixelWidth - 24;
    visualLeft = Math.min(maxLeft, Math.max(0, rawLeft));
    visualWidth = barData.pixelLeft + barData.pixelWidth - visualLeft;
  } else if (dragging === 'end') {
    visualWidth = Math.max(24, barData.pixelWidth + dragOffsetPx);
  }

  const accentColor = stateColumn?.accentColor || '#3B82F6';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Timeline item: ${item.title}`}
      onKeyDown={(e) => {
        if (!dragging && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onEditCard(item);
        }
      }}
      style={{
        left: `${visualLeft}px`,
        width: `${visualWidth}px`,
        height: '26px',
        top: '6px',
        backgroundColor: accentColor,
      }}
      className={cn(
        'absolute z-10 rounded-md flex items-center px-2 text-white select-none transition-all outline-none shadow-xs',
        dragging ? 'opacity-90 ring-2 ring-primary cursor-grabbing' : 'cursor-pointer hover:brightness-105',
        isConnectTarget && 'ring-2 ring-primary ring-offset-2 scale-[1.02] shadow-md',
        isConnecting && 'ring-2 ring-primary opacity-80'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(event) => {
        if (!dragging) {
          event.stopPropagation();
          onEditCard(item);
        }
      }}
      title={`${item.title} (${item.startDate || 'No start'} → ${item.dueDate || 'No due'})`}
    >
      {/* Left connector handle */}
      {!isReadOnly && onStartConnect && (
        <div
          role="button"
          tabIndex={-1}
          title="Drag to create dependency"
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onStartConnect(item.id, 'start', visualLeft, rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2);
          }}
          className={cn(
            'absolute -left-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-primary ring-2 ring-background cursor-crosshair z-30 transition-all hover:scale-125 flex items-center justify-center',
            isHovered || isConnecting ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="size-1.5 rounded-full bg-primary-foreground" />
        </div>
      )}

      {/* Left resize handle */}
      {!isReadOnly && onUpdateCard && (
        <div
          onPointerDown={(event) => handlePointerDown(event, 'start')}
          className={`absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize rounded-l-md hover:bg-black/20 flex items-center justify-center transition-opacity ${
            isHovered || dragging === 'start' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-0.5 h-3 bg-white/70 rounded-full" />
        </div>
      )}

      {/* Main Bar Content */}
      <div
        className="flex items-center gap-1.5 min-w-0 flex-1 h-full cursor-pointer px-1"
        onPointerDown={(event) => handlePointerDown(event, 'move')}
      >
        <StatusIcon
          title={stateColumn?.title || 'Backlog'}
          group={stateColumn?.slug || stateColumn?.title || 'backlog'}
          color={stateColumn?.accentColor}
          className="size-3 shrink-0 text-white"
        />
        <span className="text-11 font-medium truncate text-white">
          {item.title}
        </span>
      </div>

      {/* Right resize handle */}
      {!isReadOnly && onUpdateCard && (
        <div
          onPointerDown={(event) => handlePointerDown(event, 'end')}
          className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize rounded-r-md hover:bg-black/20 flex items-center justify-center transition-opacity ${
            isHovered || dragging === 'end' ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="w-0.5 h-3 bg-white/70 rounded-full" />
        </div>
      )}

      {/* Right connector handle */}
      {!isReadOnly && onStartConnect && (
        <div
          role="button"
          tabIndex={-1}
          title="Drag to create dependency"
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onStartConnect(item.id, 'end', visualLeft + visualWidth, rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2);
          }}
          className={cn(
            'absolute -right-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-primary ring-2 ring-background cursor-crosshair z-30 transition-all hover:scale-125 flex items-center justify-center',
            isHovered || isConnecting ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="size-1.5 rounded-full bg-primary-foreground" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// DEPENDENCY SVG OVERLAY
// ============================================================================

interface DependencyOverlayProps {
  lines: DependencyLine[];
  totalWidth: number;
  totalHeight: number;
}

function DependencyOverlay({ lines, totalWidth, totalHeight }: DependencyOverlayProps) {
  if (lines.length === 0) return null;
  const ELBOW_OFFSET = 12;

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
          <path d="M0,0 L0,6 L6,3 z" fill="#0070F3" />
        </marker>
        <marker
          id="dep-arrow-violated"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#EF4444" />
        </marker>
      </defs>

      {lines.map((line, idx) => {
        const { fromX, fromY, toX, toY, violated } = line;
        const stroke = violated ? '#EF4444' : '#0070F3';
        const markerId = violated ? 'dep-arrow-violated' : 'dep-arrow-normal';

        let d: string;
        const midX1 = fromX + ELBOW_OFFSET;
        const midX2 = toX - ELBOW_OFFSET;

        if (Math.abs(fromY - toY) < 2) {
          d = `M ${fromX} ${fromY} L ${toX} ${toY}`;
        } else if (midX1 <= midX2) {
          d = `M ${fromX} ${fromY} H ${midX1} V ${toY} H ${toX}`;
        } else {
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

// ============================================================================
// TIMELINE CANVAS
// ============================================================================

interface TimelineCanvasProps {
  items: Item[];
  columns: ColumnType[];
  timelineColumns: TimelineColumn[];
  tier1Groups: TimelineTier1Group[];
  currentColumnIndex: number;
  zoom: TimelineZoom;
  onEditCard: (item: Item) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  isReadOnly?: boolean;
  canvasScrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll?: (event: React.UIEvent<HTMLDivElement>) => void;
}

function TimelineCanvas({
  items,
  columns: stateColumns,
  timelineColumns,
  tier1Groups,
  currentColumnIndex,
  zoom,
  onEditCard,
  onUpdateCard,
  isReadOnly = false,
  canvasScrollRef,
  onScroll,
}: TimelineCanvasProps) {
  const totalWidth = timelineColumns.reduce((acc, col) => acc + col.width, 0);
  const totalRowsHeight = items.length * ROW_HEIGHT;

  const getStateColumn = (item: Item) => {
    return stateColumns.find((col) => col.id === item.columnId);
  };

  // Map item bar data
  const barDataMap = useMemo(() => {
    const map = new Map<string, TimelineBarData>();
    for (const item of items) {
      map.set(item.id, mapItemToBar(item, timelineColumns, zoom));
    }
    return map;
  }, [items, timelineColumns, zoom]);

  // Compute dependency lines
  const depLines = useMemo(
    () => computeDependencyLines(items, barDataMap),
    [items, barDataMap]
  );

  // Quick schedule when clicking empty row cell
  const handleEmptyCellClick = (item: Item, col: TimelineColumn) => {
    if (isReadOnly || !onUpdateCard) return;
    const startStr = formatToDateStr(col.startDate);
    const dueStr = formatToDateStr(col.endDate);
    onUpdateCard({
      id: item.id,
      startDate: startStr,
      dueDate: dueStr,
    });
  };

  // Active dependency dragging state
  interface ActiveConnectionDrag {
    sourceItemId: string;
    sourceType: 'blocks' | 'blocked_by';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    hoveredItemId: string | null;
  }

  const [activeDrag, setActiveDrag] = useState<ActiveConnectionDrag | null>(null);

  const handleStartConnect = (
    sourceItemId: string,
    side: 'start' | 'end',
    startX: number,
    startY: number
  ) => {
    if (isReadOnly) return;
    const sourceType: 'blocks' | 'blocked_by' = side === 'end' ? 'blocks' : 'blocked_by';
    setActiveDrag({
      sourceItemId,
      sourceType,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      hoveredItemId: null,
    });

    const onPointerMove = (e: PointerEvent) => {
      if (!canvasScrollRef.current) return;
      const rect = canvasScrollRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + canvasScrollRef.current.scrollLeft;
      const y = e.clientY - rect.top + canvasScrollRef.current.scrollTop - HEADER_HEIGHT;

      const targetRowIdx = Math.floor(y / ROW_HEIGHT);
      let targetId: string | null = null;
      if (targetRowIdx >= 0 && targetRowIdx < items.length) {
        const candidate = items[targetRowIdx];
        if (candidate && candidate.id !== sourceItemId) {
          targetId = candidate.id;
        }
      }

      setActiveDrag((prev) =>
        prev
          ? {
              ...prev,
              currentX: x,
              currentY: Math.max(0, y),
              hoveredItemId: targetId,
            }
          : null
      );
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      setActiveDrag((currentDrag) => {
        if (
          currentDrag &&
          currentDrag.hoveredItemId &&
          currentDrag.hoveredItemId !== currentDrag.sourceItemId
        ) {
          const fromId =
            currentDrag.sourceType === 'blocks'
              ? currentDrag.sourceItemId
              : currentDrag.hoveredItemId;
          const toId =
            currentDrag.sourceType === 'blocks'
              ? currentDrag.hoveredItemId
              : currentDrag.sourceItemId;

          RelationService.addRelation(fromId, {
            targetId: toId,
            targetWorkItemId: toId,
            type: 'blocks',
          })
            .then(() => {
              toast.success('Created dependency relation', { id: 'work-item-relation' });
              if (onUpdateCard) {
                const src = items.find((t) => t.id === fromId);
                if (src) {
                  onUpdateCard({
                    id: fromId,
                    relations: [
                      ...(src.relations || []),
                      { id: `rel-${Date.now()}`, type: 'blocks', targetId: toId, targetWorkItemId: toId },
                    ],
                  });
                }
              }
            })
            .catch((err: any) => {
              toast.error(err?.message || 'Failed to create relation', { id: 'work-item-relation' });
            });
        }
        return null;
      });
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Current highlighted column bounds
  const currentCol = currentColumnIndex >= 0 ? timelineColumns[currentColumnIndex] : null;
  const currentColLeft =
    currentColumnIndex >= 0
      ? timelineColumns.slice(0, currentColumnIndex).reduce((acc, c) => acc + c.width, 0)
      : 0;
  const currentColWidth = currentCol?.width || 0;

  return (
    <div
      ref={canvasScrollRef}
      onScroll={onScroll}
      className="flex-1 overflow-auto select-none bg-background relative h-full"
    >
      <div style={{ width: `${totalWidth}px` }} className="min-w-full min-h-full relative flex flex-col">
        {/* Sticky Dual-tier Header */}
        <div
          className="sticky top-0 z-30 bg-background border-b border-border select-none shrink-0"
          style={{ height: `${HEADER_HEIGHT}px` }}
        >
          {/* Tier 1 Header (30px) */}
          <div className="flex h-[30px] border-b border-border text-xs text-muted-foreground overflow-hidden">
            {tier1Groups.map((group) => (
              <div
                key={group.id}
                style={{ width: `${group.width}px` }}
                className="shrink-0 px-3 flex items-center justify-between border-r border-border text-xs truncate"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-normal text-foreground truncate">
                    {group.label}
                  </span>
                  {group.isCurrent && (
                    <span className="bg-primary text-primary-foreground text-10 font-medium px-1.5 py-0.5 rounded-md shrink-0">
                      Current
                    </span>
                  )}
                </div>
                {group.subLabel && (
                  <span className="text-11 text-muted-foreground font-normal shrink-0">
                    {group.subLabel}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Tier 2 Header (30px) */}
          <div className="flex h-[30px]">
            {timelineColumns.map((col) => {
              if (zoom === 'week') {
                return (
                  <div
                    key={col.id}
                    style={{ width: `${col.width}px` }}
                    className={cn(
                      "shrink-0 flex items-center justify-center border-r border-border text-xs font-normal transition-colors",
                      col.isWeekend && "bg-muted/10"
                    )}
                  >
                    {col.isCurrent ? (
                      <div className="flex items-center">
                        <span className="bg-primary text-primary-foreground font-medium text-xs rounded-md px-1 min-w-[20px] h-[18px] inline-flex items-center justify-center mr-1">
                          {col.primaryLabel}
                        </span>
                        <span className="text-primary font-medium text-xs">
                          {col.secondaryLabel}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-foreground">
                        <span className="font-normal text-xs">{col.primaryLabel}</span>
                        <span className="text-foreground text-xs font-normal">
                          {col.secondaryLabel}
                        </span>
                      </div>
                    )}
                  </div>
                );
              }

              if (zoom === 'month') {
                return (
                  <div
                    key={col.id}
                    style={{ width: `${col.width}px` }}
                    className="shrink-0 px-2 flex items-center justify-between border-r border-border text-xs transition-colors"
                  >
                    <span
                      className={cn(
                        'text-xs font-normal',
                        col.isCurrent ? 'text-primary font-semibold' : 'text-foreground'
                      )}
                    >
                      {col.primaryLabel}
                    </span>
                    {col.isCurrent ? (
                      <span className="bg-primary text-primary-foreground font-medium text-xs px-1.5 py-0.5 rounded-md">
                        {col.secondaryLabel}
                      </span>
                    ) : (
                      <span className="text-foreground text-xs font-normal">
                        {col.secondaryLabel}
                      </span>
                    )}
                  </div>
                );
              }

              // Quarter Zoom
              return (
                <div
                  key={col.id}
                  style={{ width: `${col.width}px` }}
                  className="shrink-0 px-2 flex items-center justify-center border-r border-border text-xs transition-colors"
                >
                  {col.isCurrent ? (
                    <span className="bg-primary text-primary-foreground font-medium text-xs px-2 py-0.5 rounded-md">
                      {col.primaryLabel}
                    </span>
                  ) : (
                    <span className="text-foreground text-xs font-normal">
                      {col.primaryLabel}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid Body */}
        <div className="relative flex-1 min-h-[calc(100vh-140px)]">
          {/* Vertical Grid Lines */}
          <div className="absolute inset-0 flex pointer-events-none z-0">
            {timelineColumns.map((col) => (
              <div
                key={`grid-${col.id}`}
                style={{ width: `${col.width}px` }}
                className={cn(
                  "shrink-0 border-r border-border h-full",
                  col.isWeekend && "bg-muted/10"
                )}
              />
            ))}
          </div>

          {/* Full-height Soft Blue Highlight Column for Today / Current */}
          {currentCol && (
            <div
              aria-hidden="true"
              style={{ left: `${currentColLeft}px`, width: `${currentColWidth}px` }}
              className="absolute top-0 bottom-0 bg-primary/10 dark:bg-primary/15 border-x border-primary/25 pointer-events-none z-0"
            />
          )}

          {/* Dependency lines SVG overlay */}
          <DependencyOverlay
            lines={depLines}
            totalWidth={totalWidth}
            totalHeight={totalRowsHeight}
          />

          {/* Active interactive dependency dragging line */}
          {activeDrag && (
            <svg
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none z-35"
              width={totalWidth}
              height={totalRowsHeight}
              style={{ overflow: 'visible' }}
            >
              <defs>
                <marker
                  id="live-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,1 L8,4 L0,7 z" fill="#0070F3" />
                </marker>
              </defs>
              <circle
                cx={activeDrag.startX}
                cy={activeDrag.startY}
                r="4"
                fill="#0070F3"
              />
              <path
                d={`M ${activeDrag.startX} ${activeDrag.startY} C ${
                  activeDrag.startX + (activeDrag.currentX - activeDrag.startX) / 2
                } ${activeDrag.startY}, ${
                  activeDrag.startX + (activeDrag.currentX - activeDrag.startX) / 2
                } ${activeDrag.currentY}, ${activeDrag.currentX} ${activeDrag.currentY}`}
                fill="none"
                stroke="#0070F3"
                strokeWidth="2.5"
                strokeDasharray="5 3"
                markerEnd="url(#live-arrow)"
              />
              <circle
                cx={activeDrag.currentX}
                cy={activeDrag.currentY}
                r="5"
                fill={activeDrag.hoveredItemId ? '#0070F3' : 'none'}
                stroke="#0070F3"
                strokeWidth="2"
              />
            </svg>
          )}

          {/* Work Item Rows */}
          <div className="relative z-10 flex flex-col">
            {items.map((item, rowIndex) => {
              const stateCol = getStateColumn(item);
              const barData = barDataMap.get(item.id) ?? mapItemToBar(item, timelineColumns, zoom);
              const isConnectTarget = activeDrag?.hoveredItemId === item.id;

              return (
                <div
                  key={item.id}
                  style={{ height: `${ROW_HEIGHT}px` }}
                  className={cn(
                    'border-b border-border/60 relative flex items-center group/row hover:bg-muted/30 transition-colors',
                    isConnectTarget && 'bg-primary/10 ring-1 ring-inset ring-primary'
                  )}
                >
                  {barData.hasDates ? (
                    <TimelineBar
                      item={item}
                      barData={barData}
                      columns={timelineColumns}
                      zoom={zoom}
                      stateColumn={stateCol}
                      rowIndex={rowIndex}
                      onEditCard={onEditCard}
                      onUpdateCard={onUpdateCard}
                      onStartConnect={handleStartConnect}
                      isConnecting={activeDrag?.sourceItemId === item.id}
                      isConnectTarget={isConnectTarget}
                      isReadOnly={isReadOnly}
                    />
                  ) : (
                    /* Empty row: clickable cells to schedule */
                    <div className="absolute inset-0 flex">
                      {timelineColumns.map((col) => (
                        <div
                          key={`empty-cell-${item.id}-${col.id}`}
                          style={{ width: `${col.width}px` }}
                          onClick={() => handleEmptyCellClick(item, col)}
                          className="h-full cursor-pointer hover:bg-primary/5 transition-colors"
                          title="Click to schedule dates"
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN TIMELINE VIEW COMPONENT
// ============================================================================

export function TimelineView({
  items = [],
  columns,
  onAddCard,
  onEditCard,
  onUpdateCard,
  isReadOnly = false,
}: TimelineViewProps) {
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

  const handleZoomChange = (newZoom: TimelineZoom) => {
    setZoom(newZoom);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flux:timeline_view:zoom', newZoom);
    }
  };

  // Generate timeline columns and header groups based on zoom
  const { columns: timelineColumns, tier1Groups, currentColumnIndex } = useMemo(() => {
    return buildTimelineData(zoom, new Date());
  }, [zoom]);

  // Center timeline on "Today" or current period
  const scrollToToday = useCallback(() => {
    if (!canvasScrollRef.current) return;
    if (currentColumnIndex !== -1) {
      const colWidth = COLUMN_WIDTHS[zoom];
      const targetLeft =
        currentColumnIndex * colWidth -
        canvasScrollRef.current.clientWidth / 2 +
        colWidth / 2;
      canvasScrollRef.current.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    }
  }, [currentColumnIndex, zoom]);

  // Scroll to Today on initial load or zoom switch
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToToday();
    }, 80);
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

  // Fullscreen toggling
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
      className={cn(
        'flex flex-col h-full w-full bg-background select-none',
        isFullscreen && 'fixed inset-0 z-50 bg-background'
      )}
    >
      {/* Top Controls: 7 Work items, Week | Month | Quarter, Today, Fullscreen */}
      <TimelineTopControls
        totalCount={items.length}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onTodayClick={scrollToToday}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Main Grid: Frozen Sidebar + Scrollable Canvas */}
      <div className="flex-1 flex min-h-0 overflow-hidden bg-background">
        <TimelineSidebar
          items={items}
          columns={columns}
          onEditCard={onEditCard}
          onAddCard={onAddCard}
          isReadOnly={isReadOnly}
          sidebarScrollRef={sidebarScrollRef}
          onScroll={handleSidebarScroll}
        />

        <TimelineCanvas
          items={items}
          columns={columns}
          timelineColumns={timelineColumns}
          tier1Groups={tier1Groups}
          currentColumnIndex={currentColumnIndex}
          zoom={zoom}
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
