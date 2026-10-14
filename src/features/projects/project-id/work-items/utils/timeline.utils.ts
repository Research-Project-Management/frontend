import type { Item, Priority } from '../types/work-item.types';
import type {
  TimelineZoom,
  TimelineColumn,
  TimelineTier1Group,
  TimelineBarData,
  DepLineType,
  DependencyLine,
} from '../types/timeline-view.types';
import { getPixelForTimeBinarySearch } from './cpm-graph';

export const EMPTY_ARRAY: never[] = [];

export const ROW_HEIGHT = 36;
export const BAR_HEIGHT = 22;
export const BAR_TOP = 7;
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
    startMonday.setDate(startMonday.getDate() - 21);

    const targetEndSunday = getEndOfWeek(effectiveMax);
    targetEndSunday.setDate(targetEndSunday.getDate() + 42);

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
    startMonday.setDate(startMonday.getDate() - 56);

    const targetEndSunday = getEndOfWeek(effectiveMax);
    targetEndSunday.setDate(targetEndSunday.getDate() + 140);

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

  // Quarter Zoom
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
