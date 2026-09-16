import { describe, it, expect } from 'vitest';
import {
  buildTimelineData,
  calculateDuration,
  formatToDateStr,
  parseDateOnly,
  getStartOfWeek,
  getEndOfWeek,
  getISOWeekNumber,
  mapItemToBar,
  getPixelRange,
  computeDependencyLines,
  type TimelineBarData,
} from '@/features/projects/project-id/work-items/components/views/TimelineView';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';

describe('TimelineView Calculations & Granularity', () => {
  it('formats dates and parses dates correctly', () => {
    const testDate = new Date(2026, 8, 16); // Sept 16, 2026
    const str = formatToDateStr(testDate);
    expect(str).toBe('2026-09-16');

    const parsed = parseDateOnly('2026-09-16');
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(16);
  });

  it('calculates duration correctly including empty strings when no dates', () => {
    expect(calculateDuration(null, null).label).toBe('');
    expect(calculateDuration('2026-09-16', '2026-09-16').label).toBe('1 day');
    expect(calculateDuration('2026-09-16', '2026-09-20').label).toBe('5 days');
    expect(calculateDuration('2026-09-01', '2026-09-07').label).toBe('1 week');
    expect(calculateDuration('2026-09-01', '2026-09-14').label).toBe('2 weeks');
    expect(calculateDuration('2026-09-01', '2026-10-01').label).toBe('1 month');
  });

  it('calculates ISO week and week boundaries', () => {
    const wednesday = new Date(2026, 8, 16); // Sept 16, 2026
    const monday = getStartOfWeek(wednesday);
    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getDate()).toBe(14); // Sept 14, 2026

    const sunday = getEndOfWeek(wednesday);
    expect(sunday.getDay()).toBe(0); // Sunday
    expect(sunday.getDate()).toBe(20); // Sept 20, 2026

    const weekNum = getISOWeekNumber(wednesday);
    expect(weekNum).toBe(38);
  });

  describe('buildTimelineData for Week zoom', () => {
    it('generates 7-day week groups in Tier 1 and individual days in Tier 2', () => {
      const { columns, tier1Groups, currentColumnIndex } = buildTimelineData('week', new Date(2026, 8, 16));

      expect(columns.length).toBe(98); // 14 weeks * 7 days
      expect(tier1Groups.length).toBe(14);

      // Check tier 1
      expect(tier1Groups[0].spanCount).toBe(7);
      expect(tier1Groups[0].subLabel).toMatch(/^Week \d+$/);

      // Check tier 2 columns
      const firstCol = columns[0];
      expect(firstCol.width).toBe(48);
      expect(['Su', 'M', 'T', 'W', 'Th', 'F', 'Sa']).toContain(firstCol.secondaryLabel);
      expect(typeof firstCol.primaryLabel).toBe('string');
    });
  });

  describe('buildTimelineData for Month zoom', () => {
    it('generates Month groups in Tier 1 and Week columns in Tier 2', () => {
      const { columns, tier1Groups } = buildTimelineData('month', new Date(2026, 8, 16));

      expect(columns.length).toBe(28); // 28 weeks
      expect(tier1Groups.length).toBeGreaterThan(0);

      // Tier 2 columns are weeks with W prefix and date ranges
      const col = columns[0];
      expect(col.width).toBe(84);
      expect(col.primaryLabel).toMatch(/^W\d+$/);
      expect(col.secondaryLabel).toMatch(/^\d+-\d+$/);
    });
  });

  describe('buildTimelineData for Quarter zoom', () => {
    it('generates Quarter groups in Tier 1 and Month columns in Tier 2', () => {
      const { columns, tier1Groups } = buildTimelineData('quarter', new Date(2026, 8, 16));

      expect(columns.length).toBe(22); // 22 months
      expect(tier1Groups.length).toBeGreaterThan(0);

      const col = columns[0];
      expect(col.width).toBe(110);
      expect(col.primaryLabel).toBeTruthy();
    });
  });

  describe('getPixelRange and mapItemToBar', () => {
    it('maps items with dates to accurate coordinates', () => {
      const { columns } = buildTimelineData('week', new Date(2026, 8, 16));
      const dummyItem = {
        id: 'item-1',
        title: 'Task 1',
        content: '',
        description: '',
        columnId: 'col-1',
        priority: 'medium',
        relations: [],
        startDate: '2026-09-16',
        dueDate: '2026-09-18',
        labels: [],
        attachments: { pages: [], papers: [], files: [], links: [] },
        completed: false,
      } as unknown as Item;

      const barData = mapItemToBar(dummyItem, columns, 'week');
      expect(barData.hasDates).toBe(true);
      expect(barData.pixelWidth).toBeGreaterThan(0);
      expect(barData.durationLabel).toBe('3 days');
    });

    it('returns hasDates: false for items without dates', () => {
      const { columns } = buildTimelineData('week', new Date(2026, 8, 16));
      const dummyItem = {
        id: 'item-2',
        title: 'Task 2',
        content: '',
        description: '',
        columnId: 'col-1',
        priority: 'none',
        relations: [],
        labels: [],
        attachments: { pages: [], papers: [], files: [], links: [] },
        completed: false,
      } as unknown as Item;

      const barData = mapItemToBar(dummyItem, columns, 'week');
      expect(barData.hasDates).toBe(false);
      expect(barData.durationLabel).toBe('');
    });
  });

  describe('computeDependencyLines', () => {
    it('computes connector lines between related items', () => {
      const itemA = {
        id: 'item-a',
        title: 'Task A',
        content: '',
        description: '',
        columnId: 'col-1',
        priority: 'none',
        relations: [{ id: 'rel-1', type: 'blocks', targetId: 'item-b', targetWorkItemId: 'item-b' }],
        startDate: '2026-09-10',
        dueDate: '2026-09-12',
        labels: [],
        attachments: { pages: [], papers: [], files: [], links: [] },
        completed: false,
      } as unknown as Item;

      const itemB = {
        id: 'item-b',
        title: 'Task B',
        content: '',
        description: '',
        columnId: 'col-1',
        priority: 'none',
        relations: [],
        startDate: '2026-09-14',
        dueDate: '2026-09-16',
        labels: [],
        attachments: { pages: [], papers: [], files: [], links: [] },
        completed: false,
      } as unknown as Item;

      const items = [itemA, itemB];
      const barDataMap = new Map<string, TimelineBarData>();
      barDataMap.set('item-a', {
        item: itemA,
        hasDates: true,
        pixelLeft: 100,
        pixelWidth: 50,
        durationDays: 3,
        durationLabel: '3 days',
      });
      barDataMap.set('item-b', {
        item: itemB,
        hasDates: true,
        pixelLeft: 200,
        pixelWidth: 50,
        durationDays: 3,
        durationLabel: '3 days',
      });

      const lines = computeDependencyLines(items, barDataMap);
      expect(lines.length).toBe(1);
      expect(lines[0].fromItemId).toBe('item-a');
      expect(lines[0].toItemId).toBe('item-b');
      expect(lines[0].type).toBe('FS');
      expect(lines[0].fromX).toBe(150); // 100 + 50
      expect(lines[0].toX).toBe(200);
      expect(lines[0].violated).toBe(false);
    });
  });
});
