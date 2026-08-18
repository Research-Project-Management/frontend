import { describe, it, expect } from 'vitest';
import { TaskHelpers } from '@/features/workspaces/projects/project-id/tasks/utils/tasks.util';

describe('TaskHelpers Domain Utilities (tasks.util.ts)', () => {
  it('extracts initials correctly from user names', () => {
    expect(TaskHelpers.getInitials('John Doe')).toBe('JD');
    expect(TaskHelpers.getInitials('Alice')).toBe('AL');
    expect(TaskHelpers.getInitials('')).toBe('U');
    expect(TaskHelpers.getInitials(undefined)).toBe('U');
  });

  it('formats activity time relative to now', () => {
    expect(TaskHelpers.formatActivityTime(undefined)).toBe('Just now');
    expect(TaskHelpers.formatActivityTime('invalid-date')).toBe('Just now');

    const tenSecAgo = new Date(Date.now() - 10000).toISOString();
    expect(TaskHelpers.formatActivityTime(tenSecAgo)).toBe('Just now');

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(TaskHelpers.formatActivityTime(fiveMinAgo)).toBe('5m ago');

    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(TaskHelpers.formatActivityTime(threeHoursAgo)).toBe('3h ago');
  });

  it('formats date strings', () => {
    expect(TaskHelpers.formatDate(null)).toBe('');
    expect(TaskHelpers.formatDate('2026-05-15T00:00:00Z')).toMatch(/\d{2}[-/]\d{2}/);
  });

  it('detects overdue dates accurately', () => {
    expect(TaskHelpers.checkOverdue(null)).toBe(false);
    expect(TaskHelpers.checkOverdue('2020-01-01T00:00:00Z')).toBe(true);

    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
    expect(TaskHelpers.checkOverdue(futureDate)).toBe(false);
  });

  it('deduplicates labels', () => {
    const labels = ['bug', 'urgent', 'bug', 'feature'];
    expect(TaskHelpers.uniqueLabels(labels)).toEqual(['bug', 'urgent', 'feature']);
  });

  it('normalizes checklists safely', () => {
    expect(TaskHelpers.normalizeChecklists(null as any)).toEqual([]);

    const raw = [
      {
        title: 'Checklist 1',
        items: [{ title: 'Item 1', completed: true }],
      },
    ];
    const normalized = TaskHelpers.normalizeChecklists(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]!.title).toBe('Checklist 1');
    expect(normalized[0]!.items[0]!.completed).toBe(true);
  });
});
