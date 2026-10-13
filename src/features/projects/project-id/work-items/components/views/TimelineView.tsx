'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react';
import {
  Maximize2,
  Minimize2,
  Plus,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  User,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import {
  StatusIcon,
  UrgentPriorityBoxIcon,
  HighPriorityBoxIcon,
  MediumPriorityBoxIcon,
  LowPriorityBoxIcon,
  NonePriorityBoxIcon,
} from '@/shared/components/icons';
import { cn } from "@/shared/lib/utils";
import { toast } from 'sonner';
import { RelationService } from '../../services/relation.service';
import { ItemHelpers, resolveColumnId, resolveColumnColor } from '../../utils/work-item.utils';
import { TableHorizontalScrollbar } from './TableView';
import {
  analyzeCriticalPath,
  wouldCauseCycle,
  extractNormalizedEdges,
  getPixelForTimeBinarySearch,
} from '../../utils/cpm-graph';
import type {
  Item,
  Column as ColumnType,
  BaseWorkItemViewProps,
  WorkItemCardHandlers,
  Priority,
  ProjectMember,
} from '../../types/work-item.types';

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
  isCritical?: boolean;
}

export interface TimelineViewProps extends BaseWorkItemViewProps, WorkItemCardHandlers {
  items?: Item[];
  columns: ColumnType[];
  projectStates?: ColumnType[];
  projectId?: string;
  members?: ProjectMember[];
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  onUpdateCard?: (item: any) => void;
  isReadOnly?: boolean;
}

// ============================================================================
// CONSTANTS & UTILITIES
// ============================================================================

const EMPTY_ARRAY: never[] = [];

export const ROW_HEIGHT = 36;
export const BAR_HEIGHT = 22; // Golden ratio: 36 * 0.618 ≈ 22.25px
export const BAR_TOP = 7; // (ROW_HEIGHT - BAR_HEIGHT) / 2 = 7px
export const GROUP_HEADER_HEIGHT = 36;
export const HEADER_HEIGHT = 60;
export const DEFAULT_SIDEBAR_WIDTH = 380;

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

export function formatTimelineDisplayDate(dateStr?: string | null): string {
  const d = parseDateOnly(dateStr);
  if (!d) return '';
  const month = MONTH_NAMES_SHORT[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
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

export function renderPriorityIcon(priority?: Priority, className?: string) {
  const p = priority || 'none';
  const cls = className || 'size-3.5 shrink-0';
  switch (p) {
    case 'urgent':
      return <UrgentPriorityBoxIcon className={cls} />;
    case 'high':
      return <HighPriorityBoxIcon className={cls} />;
    case 'medium':
      return <MediumPriorityBoxIcon className={cls} />;
    case 'low':
      return <LowPriorityBoxIcon className={cls} />;
    default:
      return <NonePriorityBoxIcon className={cls} />;
  }
}

// ============================================================================
// TIMELINE COLUMN & HEADER BUILDERS (DYNAMIC DATE RANGE)
// ============================================================================

export function buildTimelineData(
  zoom: TimelineZoom,
  centerDate: Date = new Date(),
  items: Item[] = EMPTY_ARRAY
): {
  columns: TimelineColumn[];
  tier1Groups: TimelineTier1Group[];
  currentColumnIndex: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatToDateStr(today);

  // Scan items to find earliest and latest dates for dynamic auto-range
  let minDate = new Date(centerDate.getTime());
  let maxDate = new Date(centerDate.getTime());

  if (Array.isArray(items)) {
    for (const item of items) {
      if (item.startDate) {
        const s = parseDateOnly(item.startDate);
        if (s && !isNaN(s.getTime())) {
          if (s < minDate) minDate = s;
          if (s > maxDate) maxDate = s;
        }
      }
      if (item.dueDate) {
        const d = parseDateOnly(item.dueDate);
        if (d && !isNaN(d.getTime())) {
          if (d < minDate) minDate = d;
          if (d > maxDate) maxDate = d;
        }
      }
    }
  }

  if (zoom === 'week') {
    const colWidth = COLUMN_WIDTHS.week;
    const effectiveMin = minDate < centerDate ? minDate : centerDate;
    const effectiveMax = maxDate > centerDate ? maxDate : centerDate;

    const startMonday = getStartOfWeek(effectiveMin);
    startMonday.setDate(startMonday.getDate() - 21); // 3 weeks prior

    const targetEndSunday = getEndOfWeek(effectiveMax);
    targetEndSunday.setDate(targetEndSunday.getDate() + 42); // 6 weeks future

    const diffDays = Math.round((targetEndSunday.getTime() - startMonday.getTime()) / 86400000);
    const totalWeeks = Math.max(14, Math.ceil(diffDays / 7));

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
    const colWidth = COLUMN_WIDTHS.month;
    const effectiveMin = minDate < centerDate ? minDate : centerDate;
    const effectiveMax = maxDate > centerDate ? maxDate : centerDate;

    const startMonday = getStartOfWeek(effectiveMin);
    startMonday.setDate(startMonday.getDate() - 56); // 8 weeks prior

    const targetEndSunday = getEndOfWeek(effectiveMax);
    targetEndSunday.setDate(targetEndSunday.getDate() + 140); // 20 weeks future

    const diffDays = Math.round((targetEndSunday.getTime() - startMonday.getTime()) / 86400000);
    const totalWeeks = Math.max(28, Math.ceil(diffDays / 7));

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

  // Quarter Zoom (Months granularity)
  const colWidth = COLUMN_WIDTHS.quarter;
  const effectiveMin = minDate < centerDate ? minDate : centerDate;
  const effectiveMax = maxDate > centerDate ? maxDate : centerDate;

  const startMonthDate = new Date(effectiveMin.getFullYear(), effectiveMin.getMonth() - 5, 1);
  const endMonthDate = new Date(effectiveMax.getFullYear(), effectiveMax.getMonth() + 16, 1);
  const totalMonths = Math.max(
    22,
    (endMonthDate.getFullYear() - startMonthDate.getFullYear()) * 12 +
      (endMonthDate.getMonth() - startMonthDate.getMonth()) +
      1
  );

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

  const left = getPixelForTimeBinarySearch(effectiveStart.getTime(), columns, false);
  const dueEndOfDay = new Date(effectiveDue.getTime());
  dueEndOfDay.setHours(23, 59, 59, 999);
  const right = getPixelForTimeBinarySearch(dueEndOfDay.getTime(), columns, true);

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
// DEPENDENCY LINES CALCULATION
// ============================================================================

export function computeDependencyLines(
  items: Item[],
  barDataMap: Map<string, TimelineBarData>,
  rowYMap: Map<string, number>,
  criticalEdges?: Set<string>
): DependencyLine[] {
  const lines: DependencyLine[] = [];
  const itemMap = new Map<string, Item>(items.map((t) => [t.id, t]));
  const seenEdges = new Set<string>();

  const FS_TYPES = new Set(['blocks', 'blocked_by']);
  const SS_TYPES = new Set(['starts_before', 'starts_after']);
  const FF_TYPES = new Set(['finishes_before', 'finishes_after']);

  for (const fromItem of items) {
    const relations =
      (fromItem.relations as Array<{ targetWorkItemId?: string; targetId?: string; type?: string }>) ||
      [];
    if (!Array.isArray(relations) || relations.length === 0) continue;

    const fromBar = barDataMap.get(fromItem.id);
    const fromY = rowYMap.get(fromItem.id);
    if (!fromBar || fromY === undefined || !fromBar.hasDates) continue;

    for (const rel of relations) {
      const relType = rel?.type;
      const targetId = rel?.targetWorkItemId || rel?.targetId;
      if (!relType || !targetId || fromItem.id === targetId) continue;

      let predId: string;
      let succId: string;
      let depType: DepLineType;

      switch (relType) {
        case 'blocks':
          predId = fromItem.id;
          succId = targetId;
          depType = 'FS';
          break;
        case 'blocked_by':
          predId = targetId;
          succId = fromItem.id;
          depType = 'FS';
          break;
        case 'starts_before':
          predId = fromItem.id;
          succId = targetId;
          depType = 'SS';
          break;
        case 'starts_after':
          predId = targetId;
          succId = fromItem.id;
          depType = 'SS';
          break;
        case 'finishes_before':
          predId = fromItem.id;
          succId = targetId;
          depType = 'FF';
          break;
        case 'finishes_after':
          predId = targetId;
          succId = fromItem.id;
          depType = 'FF';
          break;
        default:
          continue;
      }

      const edgeKey = `${predId}->${succId}:${depType}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      const predItem = itemMap.get(predId);
      const succItem = itemMap.get(succId);
      const predBar = barDataMap.get(predId);
      const succBar = barDataMap.get(succId);
      const predY = rowYMap.get(predId);
      const succY = rowYMap.get(succId);

      if (!predItem || !succItem || !predBar || !succBar || predY === undefined || succY === undefined) {
        continue;
      }
      if (!predBar.hasDates || !succBar.hasDates) continue;

      let fromX: number;
      let toX: number;
      let violated: boolean;

      const predStart = parseDateOnly(predItem.startDate);
      const predDue = parseDateOnly(predItem.dueDate);
      const succStart = parseDateOnly(succItem.startDate);
      const succDue = parseDateOnly(succItem.dueDate);

      if (depType === 'FS') {
        fromX = predBar.pixelLeft + predBar.pixelWidth;
        toX = succBar.pixelLeft;
        violated = !!(succStart && predDue && succStart < predDue);
      } else if (depType === 'SS') {
        fromX = predBar.pixelLeft;
        toX = succBar.pixelLeft;
        violated = !!(succStart && predStart && succStart < predStart);
      } else {
        fromX = predBar.pixelLeft + predBar.pixelWidth;
        toX = succBar.pixelLeft + succBar.pixelWidth;
        violated = !!(succDue && predDue && succDue < predDue);
      }

      const isCritical = criticalEdges?.has(`${predId}->${succId}`) ?? false;

      lines.push({
        fromItemId: predId,
        toItemId: succId,
        fromX,
        fromY: predY,
        toX,
        toY: succY,
        type: depType,
        violated,
        isCritical,
      });
    }
  }

  return lines;
}

// ============================================================================
// TOP CONTROLS (ZOOM, TODAY, FULLSCREEN)
// ============================================================================

interface TimelineTopControlsProps {
  totalCount: number;
  zoom: TimelineZoom;
  onZoomChange: (zoom: TimelineZoom) => void;
  onTodayClick: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showCriticalPath?: boolean;
  onToggleCriticalPath?: () => void;
  criticalCount?: number;
}

const TimelineTopControls = memo(function TimelineTopControls({
  totalCount,
  zoom,
  onZoomChange,
  onTodayClick,
  isFullscreen,
  onToggleFullscreen,
  showCriticalPath = false,
  onToggleCriticalPath,
  criticalCount = 0,
}: TimelineTopControlsProps) {
  const zoomOptions: Array<{ id: TimelineZoom; label: string }> = [
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
  ];

  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 border-b border-border bg-background select-none shrink-0">
      {/* 1. Work items Count */}
      <span className="text-xs text-foreground font-normal">
        <span className="font-mono tabular-nums">{totalCount}</span> {totalCount === 1 ? 'Work item' : 'Work items'}
      </span>

      {/* 2. Critical Path Toggle */}
      {onToggleCriticalPath && (
        <button
          type="button"
          onClick={onToggleCriticalPath}
          className={cn(
            'px-2 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer select-none outline-none flex items-center gap-1.5 focus-visible:ring-1 focus-visible:ring-ring',
            showCriticalPath
              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 font-semibold'
              : 'text-foreground/70 hover:text-foreground border-border hover:bg-muted'
          )}
          title="Toggle Critical Path analysis"
        >
          <span className="size-1.5 rounded-full bg-rose-500" />
          <span>Critical path</span>
          {criticalCount > 0 && (
            <span className="px-1 py-0.2 rounded text-10 font-mono bg-rose-500/20 text-rose-500">
              {criticalCount}
            </span>
          )}
        </button>
      )}

      {/* 3. Zoom Options (Plane segmented style) */}
      <div className="inline-flex items-center gap-0.5 text-xs bg-muted p-0.5 rounded-md">
        {zoomOptions.map((option) => {
          const isActive = zoom === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onZoomChange(option.id)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring',
                isActive
                  ? 'bg-background text-foreground font-medium shadow-xs'
                  : 'text-foreground/70 hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* 4. Today Button */}
      <button
        type="button"
        onClick={onTodayClick}
        className="px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted border border-border rounded-md transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        Today
      </button>

      {/* 4. Fullscreen Button */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="p-1 text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
});

// ============================================================================
// TIMELINE GANTT BAR
// ============================================================================

interface TimelineBarProps {
  item: Item;
  barData: TimelineBarData;
  columns: TimelineColumn[];
  zoom: TimelineZoom;
  stateColumn?: ColumnType;
  rowY: number;
  onEditCard: (item: Item) => void;
  onUpdateCard?: (item: { id: string } & Partial<Item>) => void;
  onStartConnect?: (itemId: string, side: 'start' | 'end', startX: number, startY: number) => void;
  isConnecting?: boolean;
  isConnectTarget?: boolean;
  isReadOnly?: boolean;
  isCritical?: boolean;
}

const TimelineBar = memo(function TimelineBar({
  item,
  barData,
  zoom,
  stateColumn,
  rowY,
  onEditCard,
  onUpdateCard,
  onStartConnect,
  isConnecting = false,
  isConnectTarget = false,
  isReadOnly = false,
  isCritical = false,
}: TimelineBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [dragging, setDragging] = useState<'move' | 'start' | 'end' | null>(null);
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);
  const startXRef = useRef<number>(0);

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

  const showText = visualWidth >= 60;
  const accentColor = resolveColumnColor(stateColumn, item.state?.color || '#0969DA');

  const identifier =
    item.identifier ||
    (item.sequenceNumber ? `PLO-${item.sequenceNumber}` : item.id ? `PLO-${item.id.slice(0, 4)}` : '');
  const startFormatted = formatTimelineDisplayDate(item.startDate);
  const dueFormatted = formatTimelineDisplayDate(item.dueDate);
  const dateRangeStr =
    startFormatted && dueFormatted
      ? `${startFormatted} → ${dueFormatted}`
      : startFormatted
      ? `Starts ${startFormatted}`
      : dueFormatted
      ? `Due ${dueFormatted}`
      : 'No dates set';
  const statusStr = stateColumn?.title || 'Backlog';
  const duration = calculateDuration(item.startDate, item.dueDate);
  const durationStr = duration.label ? ` (${duration.label})` : '';

  const barTooltip = `${identifier ? `[${identifier}] ` : ''}${item.title}\nSchedule: ${dateRangeStr}${durationStr}\nStatus: ${statusStr}`;

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
        height: `${BAR_HEIGHT}px`,
        top: `${BAR_TOP}px`,
        backgroundColor: accentColor,
      }}
      className={cn(
        'absolute z-10 rounded-md flex items-center px-1.5 text-white select-none transition-all outline-none',
        dragging ? 'opacity-90 ring-2 ring-foreground cursor-grabbing' : 'cursor-pointer hover:brightness-105',
        isConnectTarget && 'ring-2 ring-primary ring-offset-1',
        isConnecting && 'ring-2 ring-foreground opacity-80',
        isCritical && 'ring-2 ring-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(event) => {
        if (!dragging) {
          event.stopPropagation();
          onEditCard(item);
        }
      }}
      title={barTooltip}
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
            onStartConnect(item.id, 'start', visualLeft, rowY);
          }}
          className={cn(
            'absolute -left-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-foreground ring-2 ring-background cursor-crosshair z-30 transition-all hover:scale-125 flex items-center justify-center',
            isHovered || isConnecting ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="size-1.5 rounded-full bg-background" />
        </div>
      )}

      {/* Left resize handle */}
      {!isReadOnly && onUpdateCard && visualWidth >= 40 && (
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
        className={cn(
          'flex items-center min-w-0 flex-1 h-full cursor-pointer',
          showText ? 'gap-1.5 px-1 justify-start' : 'justify-center px-0.5'
        )}
        onPointerDown={(event) => handlePointerDown(event, 'move')}
      >
        <StatusIcon
          title={stateColumn?.title || 'Backlog'}
          group={stateColumn?.group || stateColumn?.slug || stateColumn?.title || 'backlog'}
          color={stateColumn?.color || stateColumn?.accentColor}
          className="size-3 shrink-0 text-white"
        />
        {showText && (
          <span className="text-11 font-medium truncate text-white">
            {item.title}
          </span>
        )}
        {isCritical && showText && (
          <span className="ml-auto px-1 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white shrink-0 tracking-wider">
            CP
          </span>
        )}
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
            onStartConnect(item.id, 'end', visualLeft + visualWidth, rowY);
          }}
          className={cn(
            'absolute -right-2 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-foreground ring-2 ring-background cursor-crosshair z-30 transition-all hover:scale-125 flex items-center justify-center',
            isHovered || isConnecting ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
        >
          <div className="size-1.5 rounded-full bg-background" />
        </div>
      )}
    </div>
  );
});

// ============================================================================
// DEPENDENCY SVG OVERLAY (WITH VIOLATED RED VISUALS)
// ============================================================================

interface DependencyOverlayProps {
  lines: DependencyLine[];
  totalWidth: number;
  totalHeight: number;
}

const DependencyOverlay = memo(function DependencyOverlay({
  lines,
  totalWidth,
  totalHeight,
}: DependencyOverlayProps) {
  if (lines.length === 0) return null;
  const ELBOW_OFFSET = 12;

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-10"
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
          <path d="M0,0 L0,6 L6,3 z" fill="var(--foreground)" />
        </marker>
        <marker
          id="dep-arrow-violated"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#CF222E" />
        </marker>
        <marker
          id="dep-arrow-critical"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#f43f5e" />
        </marker>
      </defs>

      {lines.map((line, idx) => {
        const { fromX, fromY, toX, toY, violated, isCritical } = line;
        const stroke = violated ? '#CF222E' : isCritical ? '#f43f5e' : 'var(--foreground)';
        const markerId = violated ? 'dep-arrow-violated' : isCritical ? 'dep-arrow-critical' : 'dep-arrow-normal';

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
            strokeWidth={violated ? 2 : isCritical ? 2.5 : 1.5}
            fill="none"
            strokeDasharray={violated ? '5,3' : undefined}
            markerEnd={`url(#${markerId})`}
            opacity={violated ? 0.95 : isCritical ? 1 : 0.8}
          />
        );
      })}
    </svg>
  );
});

// ── Timeline Pinned Bottom Add Bar (Plane.so Parity) ──────────────────────
export const TimelineBottomAddBar = memo(function TimelineBottomAddBar({
  defaultColId,
  onAddCard,
  sidebarWidth,
}: {
  defaultColId: string;
  onAddCard: (columnId: string, title?: string, dueDate?: string) => void;
  sidebarWidth?: number;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      inputRef.current?.focus();
    }
  }, [isAdding]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setIsAdding(false);
      return;
    }
    onAddCard(defaultColId, trimmed);
    setTitle('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsAdding(false);
      setTitle('');
    }
  };

  return (
    <div className="h-9 flex items-center bg-background select-none shrink-0">
      {!isAdding ? (
        <div
          onClick={() => setIsAdding(true)}
          style={sidebarWidth ? { width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` } : undefined}
          className={cn(
            "h-full px-3 flex items-center gap-2 bg-background cursor-pointer group/bottom-add",
            !sidebarWidth && "w-auto max-w-sm"
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsAdding(true);
            }}
            className="flex items-center gap-2 text-13 text-foreground font-normal cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Plus className="size-3.5 shrink-0" />
            <span>New work item</span>
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={sidebarWidth ? { width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px` } : undefined}
          className={cn(
            "h-full px-3 flex items-center gap-2 transition-colors bg-background",
            !sidebarWidth && "w-auto max-w-sm"
          )}
        >
          <Plus className="size-3.5 text-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={title}
            aria-label="New work item title"
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!title.trim()) setIsAdding(false);
            }}
            placeholder="New work item"
            className="flex-1 min-w-0 bg-transparent text-13 text-foreground placeholder:text-foreground/50 outline-none font-normal px-1"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setTitle('');
              }}
              className="h-6 px-2 text-xs text-foreground hover:text-foreground/80 transition-colors cursor-pointer rounded-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="h-6 px-2.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer rounded-sm"
            >
              Save
            </button>
          </div>
        </form>
      )}
      <div className="flex-1 h-full bg-background" />
    </div>
  );
});

// ============================================================================
// MAIN TIMELINE VIEW COMPONENT
// ============================================================================

export const TimelineView = memo(function TimelineView({
  items = EMPTY_ARRAY,
  columns,
  projectStates,
  projectId = '',
  members = EMPTY_ARRAY,
  displayOptions,
  onAddCard,
  onEditCard,
  onUpdateCard,
  isReadOnly = false,
}: TimelineViewProps) {
  // ── Grouping definition (Guaranteed top-of-component scope) ─────────────────
  const isGrouped = false;
  const effectiveGroupBy: 'state' | 'priority' | 'assignee' | null =
    (displayOptions?.groupBy as 'state' | 'priority' | 'assignee' | null) ?? null;

  // Zoom state with localStorage persistence (SSR-safe to prevent hydration mismatch)
  const [zoom, setZoom] = useState<TimelineZoom>('week');

  // Critical Path Method (CPM) calculation & toggle
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const cpmAnalysis = useMemo(() => analyzeCriticalPath(items), [items]);

  // Resizable sidebar width with localStorage persistence (SSR-safe)
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_SIDEBAR_WIDTH);

  // Sync saved preferences on client mount without breaking hydration
  useEffect(() => {
    try {
      const savedZoom = localStorage.getItem('flux:timeline_view:zoom') as TimelineZoom;
      if (savedZoom === 'week' || savedZoom === 'month' || savedZoom === 'quarter') {
        setZoom(savedZoom);
      }
      const savedWidth = localStorage.getItem('flux:timeline_view:sidebar_width');
      if (savedWidth) {
        const val = parseInt(savedWidth, 10);
        if (!isNaN(val) && val >= 180 && val <= 650) {
          if (val === 280) {
            setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
          } else {
            setSidebarWidth(val);
          }
        }
      }
    } catch {}
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const handleZoomChange = (newZoom: TimelineZoom) => {
    setZoom(newZoom);
    if (typeof window !== 'undefined') {
      localStorage.setItem('flux:timeline_view:zoom', newZoom);
    }
  };

  // Sidebar resize drag handler
  const handleSidebarResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(650, Math.max(200, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      try {
        localStorage.setItem('flux:timeline_view:sidebar_width', String(sidebarWidth));
      } catch {}
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Generate dynamic timeline columns and header groups based on zoom and all items
  const { columns: timelineColumns, tier1Groups, currentColumnIndex } = useMemo(() => {
    return buildTimelineData(zoom, new Date(), items);
  }, [zoom, items]);

  const totalTimelineWidth = useMemo(
    () => timelineColumns.reduce((acc, col) => acc + col.width, 0),
    [timelineColumns]
  );

  // Map item bar data
  const barDataMap = useMemo(() => {
    const map = new Map<string, TimelineBarData>();
    for (const item of items) {
      map.set(item.id, mapItemToBar(item, timelineColumns, zoom));
    }
    return map;
  }, [items, timelineColumns, zoom]);

  // Center timeline on "Today" or current period
  const scrollToToday = useCallback(() => {
    if (!mainScrollRef.current) return;
    if (currentColumnIndex !== -1) {
      const colWidth = COLUMN_WIDTHS[zoom];
      const targetLeft =
        sidebarWidth +
        currentColumnIndex * colWidth -
        mainScrollRef.current.clientWidth / 2 +
        colWidth / 2;
      mainScrollRef.current.scrollTo({
        left: Math.max(0, targetLeft),
        behavior: 'smooth',
      });
    }
  }, [currentColumnIndex, zoom, sidebarWidth]);

  // Scroll to Today on initial load or zoom switch
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToToday();
    }, 80);
    return () => clearTimeout(timer);
  }, [zoom, scrollToToday]);

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

  // ── Grouping & Hierarchy Logic ─────────────────────────────────────────────
  // (isGrouped and effectiveGroupBy defined at top of component)

  const [collapsedGroupKeys, setCollapsedGroupKeys] = useState<Set<string>>(new Set());
  const toggleGroupCollapse = useCallback((groupKey: string) => {
    setCollapsedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Sub-items Tree State & Toggle
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set());
  const toggleExpandChildren = useCallback((parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

  const showChildWorkItems = displayOptions?.showChildWorkItems ?? true;

  const buildTreeRows = useCallback(
    (sortedList: Item[]): Array<{
      item: Item;
      isSubItem: boolean;
      hasChildren: boolean;
      isChildrenExpanded: boolean;
    }> => {
      if (!showChildWorkItems) {
        return sortedList
          .filter((item) => !item.parentId && !item.parentItemId && !item.parentWorkItemId)
          .map((item) => ({
            item,
            isSubItem: false,
            hasChildren: false,
            isChildrenExpanded: true,
          }));
      }

      const itemMap = new Map<string, Item>();
      sortedList.forEach((it) => itemMap.set(it.id, it));

      const childrenByParentId = new Map<string, Item[]>();
      const rootItems: Item[] = [];

      sortedList.forEach((it) => {
        const pId = it.parentId || it.parentItemId || it.parentWorkItemId;
        if (pId && itemMap.has(pId)) {
          const arr = childrenByParentId.get(pId) || [];
          arr.push(it);
          childrenByParentId.set(pId, arr);
        } else {
          rootItems.push(it);
        }
      });

      const result: Array<{
        item: Item;
        isSubItem: boolean;
        hasChildren: boolean;
        isChildrenExpanded: boolean;
      }> = [];
      const visited = new Set<string>();

      const appendItemAndChildren = (it: Item, depth: number) => {
        if (visited.has(it.id)) return;
        visited.add(it.id);

        const children = childrenByParentId.get(it.id) || [];
        const hasChildren = children.length > 0;
        const isChildrenExpanded = !collapsedParentIds.has(it.id);

        result.push({
          item: it,
          isSubItem: depth > 0,
          hasChildren,
          isChildrenExpanded,
        });

        if (hasChildren && isChildrenExpanded) {
          children.forEach((child) => appendItemAndChildren(child, depth + 1));
        }
      };

      rootItems.forEach((root) => appendItemAndChildren(root, 0));

      return result;
    },
    [showChildWorkItems, collapsedParentIds]
  );

  const stateList = useMemo(
    () => (projectStates && projectStates.length > 0 ? projectStates : columns),
    [projectStates, columns]
  );

  const groups = useMemo(() => {
    if (!isGrouped) return [];

    if (effectiveGroupBy === 'priority') {
      const priorityConfigs: Array<{ key: Priority; title: string }> = [
        { key: 'urgent', title: 'Urgent' },
        { key: 'high', title: 'High' },
        { key: 'medium', title: 'Medium' },
        { key: 'low', title: 'Low' },
        { key: 'none', title: 'No priority' },
      ];

      return priorityConfigs.map((p) => {
        const groupItems = items.filter((item) => (item.priority || 'none') === p.key);
        return {
          key: p.key,
          title: p.title,
          color: undefined,
          icon: renderPriorityIcon(p.key),
          items: groupItems,
        };
      });
    }

    if (effectiveGroupBy === 'assignee') {
      const memberGroups = (members || []).map((m) => {
        const mem = m as typeof m & { user?: { id?: string; name?: string } };
        const userId = mem.userId || mem.user?.id || mem.id || '';
        const name = mem.name || mem.user?.name || 'Member';
        const groupItems = items.filter(
          (item) => ItemHelpers.resolveAssigneeId(item) === userId
        );
        return {
          key: userId,
          title: name,
          color: undefined,
          icon: (
            <Avatar className="size-4 shrink-0">
              <AvatarImage src={mem.avatar || mem.user?.avatar} />
              <AvatarFallback className="text-11 font-mono font-medium bg-muted">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ),
          items: groupItems,
        };
      });

      const unassignedItems = items.filter((item) => !ItemHelpers.resolveAssigneeId(item));
      memberGroups.push({
        key: '__unassigned__',
        title: 'Unassigned',
        color: undefined,
        icon: <User className="size-3.5 shrink-0 text-muted-foreground" />,
        items: unassignedItems,
      });

      return memberGroups;
    }

    // Default: Group by State
    return stateList.map((col) => {
      const colId = resolveColumnId(col);
      const groupItems = items.filter((i) => i.columnId === colId);
      const colColor = col.color || col.accentColor || '#6B7280';
      const colTitle = col.title || col.name || 'Group';

      return {
        key: colId,
        title: colTitle,
        color: colColor,
        icon: (
          <StatusIcon
            id={colId}
            title={colTitle}
            group={col.group || col.slug || colTitle}
            color={colColor}
            className="size-3.5 shrink-0"
          />
        ),
        items: groupItems,
      };
    });
  }, [isGrouped, effectiveGroupBy, items, stateList, members]);

  // Flattened vertical layout rows and Y-coordinate mapping for dependency lines
  const { visibleRowElements, rowYMap, totalContentHeight } = useMemo(() => {
    const yMap = new Map<string, number>();
    const rows: Array<
      | {
          type: 'group';
          key: string;
          title: string;
          color?: string;
          icon?: React.ReactNode;
          count: number;
          isExpanded: boolean;
          y: number;
        }
      | {
          type: 'item';
          item: Item;
          isSubItem: boolean;
          hasChildren: boolean;
          isChildrenExpanded: boolean;
          y: number;
        }
    > = [];

    let currentY = 0;

    if (isGrouped) {
      for (const group of groups) {
        if (group.items.length === 0 && !displayOptions?.showEmptyGroups) continue;
        const isExpanded = !collapsedGroupKeys.has(group.key);

        rows.push({
          type: 'group',
          key: group.key,
          title: group.title,
          color: group.color,
          icon: group.icon,
          count: group.items.length,
          isExpanded,
          y: currentY,
        });
        currentY += GROUP_HEADER_HEIGHT;

        if (isExpanded) {
          const treeRows = buildTreeRows(group.items);
          for (const row of treeRows) {
            yMap.set(row.item.id, currentY + ROW_HEIGHT / 2);
            rows.push({
              type: 'item',
              item: row.item,
              isSubItem: row.isSubItem,
              hasChildren: row.hasChildren,
              isChildrenExpanded: row.isChildrenExpanded,
              y: currentY,
            });
            currentY += ROW_HEIGHT;
          }
        }
      }
    } else {
      const treeRows = buildTreeRows(items);
      for (const row of treeRows) {
        yMap.set(row.item.id, currentY + ROW_HEIGHT / 2);
        rows.push({
          type: 'item',
          item: row.item,
          isSubItem: row.isSubItem,
          hasChildren: row.hasChildren,
          isChildrenExpanded: row.isChildrenExpanded,
          y: currentY,
        });
        currentY += ROW_HEIGHT;
      }
    }

    return {
      visibleRowElements: rows,
      rowYMap: yMap,
      totalContentHeight: Math.max(currentY, 400),
    };
  }, [isGrouped, groups, displayOptions?.showEmptyGroups, collapsedGroupKeys, buildTreeRows, items]);

  // Compute dependency lines with accurate Y coordinates
  const depLines = useMemo(
    () =>
      computeDependencyLines(
        items,
        barDataMap,
        rowYMap,
        showCriticalPath ? cpmAnalysis.criticalEdges : undefined
      ),
    [items, barDataMap, rowYMap, showCriticalPath, cpmAnalysis.criticalEdges]
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
      if (!mainScrollRef.current) return;
      const rect = mainScrollRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + mainScrollRef.current.scrollLeft - sidebarWidth;
      const y = e.clientY - rect.top + mainScrollRef.current.scrollTop - HEADER_HEIGHT;

      // Find hovered item based on yOffset in visibleRowElements
      let targetId: string | null = null;
      for (const row of visibleRowElements) {
        if (row.type === 'item' && y >= row.y && y < row.y + ROW_HEIGHT) {
          if (row.item.id !== sourceItemId) {
            targetId = row.item.id;
          }
          break;
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

          // Prevent circular dependencies prior to API dispatch
          const currentEdges = extractNormalizedEdges(items);
          if (wouldCauseCycle(fromId, toId, currentEdges)) {
            toast.error('Cannot create dependency: circular dependency detected', {
              id: 'work-item-relation',
            });
            return null;
          }

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

  const defaultColId = useMemo(() => {
    const defaultCol = columns.find((c) => c.isDefault) || columns[0];
    return defaultCol ? resolveColumnId(defaultCol) : 'backlog';
  }, [columns]);

  // Current highlighted column bounds for Today highlight & line
  const currentCol = currentColumnIndex >= 0 ? timelineColumns[currentColumnIndex] : null;
  const currentColLeft =
    currentColumnIndex >= 0
      ? timelineColumns.slice(0, currentColumnIndex).reduce((acc, c) => acc + c.width, 0)
      : 0;
  const currentColWidth = currentCol?.width || 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex flex-col flex-1 h-full w-full min-h-0 select-none relative',
        isFullscreen && 'fixed inset-0 z-50 bg-background'
      )}
    >
      {/* 1. Top Controls Bar */}
      <TimelineTopControls
        totalCount={items.length}
        zoom={zoom}
        onZoomChange={handleZoomChange}
        onTodayClick={scrollToToday}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
        showCriticalPath={showCriticalPath}
        onToggleCriticalPath={() => setShowCriticalPath((prev) => !prev)}
        criticalCount={cpmAnalysis.criticalPathItemIds.size}
      />

      {/* 2. Unified Master Scroll Container (Native 60/120fps sync) */}
      <div
        ref={mainScrollRef}
        className="flex-1 overflow-auto select-none bg-background relative min-h-0 interactive-scrollbar scrollbar-x-none"
      >
        <div
          style={{ minWidth: `${sidebarWidth + totalTimelineWidth}px` }}
          className="relative flex flex-col min-h-full"
        >
          {/* Main Sticky Dual-tier Header */}
          <div
            className="sticky top-0 z-30 flex bg-background border-b border-border select-none shrink-0"
            style={{ height: `${HEADER_HEIGHT}px` }}
          >
            {/* Top-Left Corner (Sticky Left + Sticky Top = z-40) */}
            <div
              style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, left: 0 }}
              className="sticky left-0 z-40 flex items-end justify-between px-3 pb-2 bg-background text-foreground text-xs font-medium shrink-0 group/sidebar-header border-r border-border"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-foreground font-medium text-xs truncate">Work items</span>
                <span className="w-16 shrink-0 text-right font-mono text-11 text-foreground tabular-nums">
                  Duration
                </span>
              </div>

              {/* Sidebar Resize Splitter */}
              <div
                className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-50 hover:bg-primary/20 transition-colors"
                onMouseDown={handleSidebarResizeMouseDown}
                aria-label="Drag to resize sidebar width"
              />
            </div>

            {/* Top Timeline Header (Tier 1 + Tier 2) */}
            <div
              className="flex flex-col shrink-0"
              style={{ width: `${totalTimelineWidth}px` }}
            >
              {/* Tier 1 Header (30px) */}
              <div className="flex h-[30px] border-b border-border text-xs text-foreground overflow-hidden">
                {tier1Groups.map((group) => (
                  <div
                    key={group.id}
                    style={{ width: `${group.width}px` }}
                    className="shrink-0 px-3 flex items-center justify-between border-r border-border text-xs truncate"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono text-xs font-medium text-foreground tabular-nums truncate">
                        {group.label}
                      </span>
                      {group.isCurrent && (
                        <span className="bg-primary text-primary-foreground font-mono text-11 font-medium px-1.5 py-0.5 rounded-md shrink-0 tabular-nums">
                          Current
                        </span>
                      )}
                    </div>
                    {group.subLabel && (
                      <span className="font-mono text-11 text-foreground/70 font-normal shrink-0 tabular-nums">
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
                            <span className="bg-primary text-primary-foreground font-mono font-medium text-xs rounded-md px-1 min-w-[20px] h-[18px] inline-flex items-center justify-center mr-1 tabular-nums">
                              {col.primaryLabel}
                            </span>
                            <span className="text-foreground font-mono font-semibold text-xs tabular-nums">
                              {col.secondaryLabel}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-foreground">
                            <span className="font-mono font-normal text-xs tabular-nums">{col.primaryLabel}</span>
                            <span className="text-foreground font-mono text-xs font-normal tabular-nums">
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
                            'text-xs font-mono tabular-nums font-normal',
                            col.isCurrent ? 'text-foreground font-semibold' : 'text-foreground'
                          )}
                        >
                          {col.primaryLabel}
                        </span>
                        {col.isCurrent ? (
                          <span className="bg-primary text-primary-foreground font-mono font-medium text-xs px-1.5 py-0.5 rounded-md tabular-nums">
                            {col.secondaryLabel}
                          </span>
                        ) : (
                          <span className="text-foreground font-mono text-xs font-normal tabular-nums">
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
                        <span className="bg-primary text-primary-foreground font-mono font-medium text-xs px-2 py-0.5 rounded-md tabular-nums">
                          {col.primaryLabel}
                        </span>
                      ) : (
                        <span className="text-foreground font-mono text-xs font-normal tabular-nums">
                          {col.primaryLabel}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Grid Canvas Body */}
          <div className="relative flex-1 min-h-[calc(100vh-140px)] flex flex-col justify-between">
            {/* Background Grid Lines & Today Marker across the entire canvas */}
            <div
              style={{ left: `${sidebarWidth}px`, width: `${totalTimelineWidth}px` }}
              className="absolute top-0 bottom-0 pointer-events-none z-0 flex"
            >
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

              {/* Full-height Soft Highlight Column for Today / Current */}
              {currentCol && (
                <div
                  aria-hidden="true"
                  style={{ left: `${currentColLeft}px`, width: `${currentColWidth}px` }}
                  className="absolute top-0 bottom-0 bg-muted/30 border-x border-border pointer-events-none z-0"
                />
              )}

              {/* Primer Blue Today Indicator Vertical Line */}
              {currentCol && (
                <div
                  aria-hidden="true"
                  style={{ left: `${currentColLeft + currentColWidth / 2}px` }}
                  className="absolute top-0 bottom-0 w-[2px] bg-primary/80 pointer-events-none z-15"
                >
                  <div className="size-2 rounded-full bg-primary -ml-[3px] -mt-1" />
                </div>
              )}
            </div>

            {/* Dependency Lines SVG Overlay */}
            <div
              style={{ left: `${sidebarWidth}px`, width: `${totalTimelineWidth}px`, height: `${totalContentHeight}px` }}
              className="absolute top-0 pointer-events-none z-10"
            >
              <DependencyOverlay
                lines={depLines}
                totalWidth={totalTimelineWidth}
                totalHeight={totalContentHeight}
              />

              {/* Active Interactive Dependency Dragging Line */}
              {activeDrag && (
                <svg
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none z-15"
                  width={totalTimelineWidth}
                  height={totalContentHeight}
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
                      <path d="M0,1 L8,4 L0,7 z" fill="var(--foreground)" />
                    </marker>
                  </defs>
                  <circle
                    cx={activeDrag.startX}
                    cy={activeDrag.startY}
                    r="4"
                    fill="var(--foreground)"
                  />
                  <path
                    d={`M ${activeDrag.startX} ${activeDrag.startY} C ${
                      activeDrag.startX + (activeDrag.currentX - activeDrag.startX) / 2
                    } ${activeDrag.startY}, ${
                      activeDrag.startX + (activeDrag.currentX - activeDrag.startX) / 2
                    } ${activeDrag.currentY}, ${activeDrag.currentX} ${activeDrag.currentY}`}
                    fill="none"
                    stroke="var(--foreground)"
                    strokeWidth="2.5"
                    strokeDasharray="5 3"
                    markerEnd="url(#live-arrow)"
                  />
                  <circle
                    cx={activeDrag.currentX}
                    cy={activeDrag.currentY}
                    r="5"
                    fill={activeDrag.hoveredItemId ? 'var(--foreground)' : 'none'}
                    stroke="var(--foreground)"
                    strokeWidth="2"
                  />
                </svg>
              )}
            </div>

            {/* Unified Rows Container */}
            <div className="relative z-10 flex flex-col">
              {visibleRowElements.map((rowElement) => {
                if (rowElement.type === 'group') {
                  return (
                    <div
                      key={rowElement.key}
                      role="row"
                      onClick={() => toggleGroupCollapse(rowElement.key)}
                      style={{ height: `${GROUP_HEADER_HEIGHT}px` }}
                      className="sticky top-[60px] z-25 flex items-center border-b border-border bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer select-none text-xs font-medium text-foreground w-full"
                    >
                      {/* Sticky Left Group Label */}
                      <div
                        style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, left: 0 }}
                        className="sticky left-0 z-26 flex items-center gap-2 px-3 h-full shrink-0 bg-muted/50 border-r border-border"
                      >
                        {rowElement.icon}
                        <span className="font-semibold text-foreground truncate">{rowElement.title}</span>
                        <span className="rounded-md bg-background border border-border px-1.5 py-0.5 text-11 font-mono font-medium text-muted-foreground tabular-nums">
                          {rowElement.count}
                        </span>
                      </div>

                      {/* Right Timeline Group Fill */}
                      <div
                        style={{ width: `${totalTimelineWidth}px` }}
                        className="h-full shrink-0"
                      />
                    </div>
                  );
                }

                // Item Row
                const { item, isSubItem, hasChildren, isChildrenExpanded, y } = rowElement;
                const stateCol = stateList.find((col) => col.id === item.columnId);
                const barData = barDataMap.get(item.id) ?? mapItemToBar(item, timelineColumns, zoom);
                const isConnectTarget = activeDrag?.hoveredItemId === item.id;
                const identifier =
                  item.identifier ||
                  (item.sequenceNumber ? `PLO-${item.sequenceNumber}` : `PLO-${item.id.slice(0, 4)}`);
                const duration = calculateDuration(item.startDate, item.dueDate);

                return (
                  <div
                    key={item.id}
                    style={{ height: `${ROW_HEIGHT}px` }}
                    className={cn(
                      'flex items-center group/row hover:bg-muted/30 transition-colors w-full relative',
                      isConnectTarget && 'bg-muted ring-1 ring-inset ring-border'
                    )}
                  >
                    {/* Left Sticky Sidebar Cell */}
                    <div
                      style={{ width: `${sidebarWidth}px`, minWidth: `${sidebarWidth}px`, left: 0 }}
                      className={cn(
                        'sticky left-0 z-20 flex items-center justify-between px-3 h-full shrink-0 bg-background group-hover/row:bg-muted/30 transition-colors cursor-pointer border-r border-border',
                        isSubItem && 'pl-7'
                      )}
                      onClick={() => onEditCard(item)}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                        {/* Subitem connector indicator */}
                        {isSubItem && (
                          <CornerDownRight className="size-3 text-foreground shrink-0 mr-0.5" />
                        )}

                        {/* Parent item expand/collapse chevron */}
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandChildren(item.id);
                            }}
                            className="p-0.5 -ml-1 mr-0.5 text-foreground hover:text-foreground transition-colors cursor-pointer rounded-sm"
                            aria-label={isChildrenExpanded ? 'Collapse sub-items' : 'Expand sub-items'}
                          >
                            {isChildrenExpanded ? (
                              <ChevronDown className="size-3 shrink-0" />
                            ) : (
                              <ChevronRight className="size-3 shrink-0" />
                            )}
                          </button>
                        )}

                        {/* Identifier */}
                        <span className="font-mono text-11 text-foreground font-medium shrink-0 min-w-[40px] tabular-nums">
                          {identifier}
                        </span>

                        {/* Title */}
                        <span className="truncate text-xs text-foreground font-normal transition-colors">
                          {item.title}
                        </span>
                      </div>

                      {/* Duration */}
                      <div className="w-16 shrink-0 text-right font-mono text-11 text-foreground tabular-nums">
                        {duration.label ? (
                          duration.label
                        ) : (
                          <span className="text-foreground/30 select-none">—</span>
                        )}
                      </div>
                    </div>

                    {/* Right Gantt Bar Cell (width = totalTimelineWidth) */}
                    <div
                      style={{ width: `${totalTimelineWidth}px` }}
                      className="relative h-full shrink-0 flex items-center"
                    >
                      {barData.hasDates ? (
                        <TimelineBar
                          item={item}
                          barData={barData}
                          columns={timelineColumns}
                          zoom={zoom}
                          stateColumn={stateCol}
                          rowY={y + ROW_HEIGHT / 2}
                          onEditCard={onEditCard}
                          onUpdateCard={onUpdateCard}
                          onStartConnect={handleStartConnect}
                          isConnecting={activeDrag?.sourceItemId === item.id}
                          isConnectTarget={isConnectTarget}
                          isReadOnly={isReadOnly}
                          isCritical={showCriticalPath && cpmAnalysis.criticalPathItemIds.has(item.id)}
                        />
                      ) : (
                        /* Empty row: clickable cells to schedule */
                        <div className="absolute inset-0 flex">
                          {timelineColumns.map((col) => (
                            <div
                              key={`empty-cell-${item.id}-${col.id}`}
                              style={{ width: `${col.width}px` }}
                              onClick={() => handleEmptyCellClick(item, col)}
                              className="h-full cursor-pointer hover:bg-muted/40 transition-colors"
                              aria-label={`Schedule for ${col.primaryLabel}${col.secondaryLabel ? ` (${col.secondaryLabel})` : ''}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      </div>

      {/* Sleek Horizontal Scrollbar - placed ABOVE TimelineBottomAddBar */}
      <TableHorizontalScrollbar scrollRef={mainScrollRef} />

      {/* Pinned Bottom "+ New work item" Row (Plane.so Parity) */}
      {!isReadOnly && (
        <TimelineBottomAddBar
          defaultColId={defaultColId}
          onAddCard={onAddCard}
          sidebarWidth={sidebarWidth}
        />
      )}
    </div>
  );
});

export default TimelineView;
