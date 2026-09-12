import { describe, it, expect } from 'vitest';
import {
  STATE_GROUPS,
  STATE_GROUP_CONFIG,
  inferStateGroup,
  resolveStateColor,
  resolveStateTitle,
  RELATION_TYPE_CONFIG,
  DEFAULT_WORK_ITEM_FILTERS,
  DEFAULT_DISPLAY_OPTIONS,
} from '@/features/workspaces/projects/project-id/work-items/types/types';

describe('Work Item State Domain', () => {
  it('should contain exactly 5 standard state groups', () => {
    expect(STATE_GROUPS).toEqual([
      'backlog',
      'unstarted',
      'started',
      'completed',
      'cancelled',
    ]);
  });

  it('should map state groups to their configurations', () => {
    expect(STATE_GROUP_CONFIG.backlog.label).toBe('Backlog');
    expect(STATE_GROUP_CONFIG.unstarted.label).toBe('To Do');
    expect(STATE_GROUP_CONFIG.started.label).toBe('In Progress');
    expect(STATE_GROUP_CONFIG.completed.label).toBe('Done');
    expect(STATE_GROUP_CONFIG.cancelled.label).toBe('Cancelled');
  });

  it('should infer correct state group from column id or title', () => {
    expect(inferStateGroup('backlog', 'Backlog')).toBe('backlog');
    expect(inferStateGroup('todo', 'To Do')).toBe('unstarted');
    expect(inferStateGroup('col-123', 'In Progress')).toBe('started');
    expect(inferStateGroup('col-456', 'Code Review')).toBe('started');
    expect(inferStateGroup('done', 'Done')).toBe('completed');
    expect(inferStateGroup('col-789', 'Closed')).toBe('completed');
    expect(inferStateGroup('cancelled', 'Rejected')).toBe('cancelled');
  });

  it('should resolve state color with fallbacks', () => {
    expect(resolveStateColor({ id: 'done', color: '#22C55E', group: 'completed', name: 'Done', sequence: 1000, isDefault: false })).toBe('#22C55E');
    expect(resolveStateColor('backlog')).toBe('#8A9093');
    expect(resolveStateColor(null)).toBe('#8A9093');
  });

  it('should resolve state title correctly', () => {
    expect(resolveStateTitle({ name: 'In Progress' })).toBe('In Progress');
    expect(resolveStateTitle({ title: 'Review' })).toBe('Review');
    expect(resolveStateTitle(null)).toBe('');
  });
});

describe('Work Item Relations (Bidirectional)', () => {
  it('should define blocks, blocked_by, relates_to, and duplicate_of', () => {
    expect(RELATION_TYPE_CONFIG.blocks).toBeDefined();
    expect(RELATION_TYPE_CONFIG.blocked_by).toBeDefined();
    expect(RELATION_TYPE_CONFIG.relates_to).toBeDefined();
    expect(RELATION_TYPE_CONFIG.duplicate_of).toBeDefined();
  });
});

describe('Default Filter & Display Configurations', () => {
  it('should provide default filter engine configuration', () => {
    expect(DEFAULT_WORK_ITEM_FILTERS.search).toBe('');
    expect(DEFAULT_WORK_ITEM_FILTERS.state).toEqual([]);
    expect(DEFAULT_WORK_ITEM_FILTERS.mentions).toEqual([]);
    expect(DEFAULT_WORK_ITEM_FILTERS.created_by).toEqual([]);
  });

  it('should provide default display options with state group by', () => {
    expect(DEFAULT_DISPLAY_OPTIONS.groupBy).toBe('state');
    expect(DEFAULT_DISPLAY_OPTIONS.properties.priority).toBe(true);
    expect(DEFAULT_DISPLAY_OPTIONS.properties.state).toBe(true);
  });
});
