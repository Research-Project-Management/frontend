import { describe, it, expect } from 'vitest';
import { deriveStatus, groupCyclesByStatus } from '@/features/workspaces/projects/project-id/cycles/utils/cycles.util';
import type { Cycle } from '@/features/workspaces/projects/project-id/cycles/types/cycle.types';

describe('Cycles Domain Utilities (cycles.util.ts)', () => {
  it('derives explicit status first', () => {
    expect(deriveStatus({ status: 'completed' })).toBe('completed');
    expect(deriveStatus({ status: 'active' })).toBe('active');
  });

  it('falls back to date calculation when status is omitted', () => {
    expect(deriveStatus({})).toBe('planned');
    expect(deriveStatus({ startDate: null, endDate: null })).toBe('planned');

    const pastDate = new Date(Date.now() - 86400000 * 20).toISOString();
    const olderDate = new Date(Date.now() - 86400000 * 10).toISOString();
    expect(deriveStatus({ startDate: pastDate, endDate: olderDate })).toBe('completed');

    const recentPast = new Date(Date.now() - 86400000).toISOString();
    const future = new Date(Date.now() + 86400000 * 5).toISOString();
    expect(deriveStatus({ startDate: recentPast, endDate: future })).toBe('active');
  });

  it('groups cycles accurately by status', () => {
    const mockCycles: Cycle[] = [
      {
        id: '1',
        name: 'Sprint 1',
        description: 'First sprint',
        project: 'p1',
        status: 'active',
        phase: 'active',
        milestones: [],
        deliverables: [],
        author: { id: 'u1', name: 'User 1' },
      },
      {
        id: '2',
        name: 'Sprint 2',
        description: 'Second sprint',
        project: 'p1',
        status: 'completed',
        phase: 'completed',
        milestones: [],
        deliverables: [],
        author: { id: 'u1', name: 'User 1' },
      },
      {
        id: '3',
        name: 'Sprint 3',
        description: 'Third sprint',
        project: 'p1',
        status: 'planned',
        phase: 'planned',
        milestones: [],
        deliverables: [],
        author: { id: 'u1', name: 'User 1' },
      },
    ];

    const grouped = groupCyclesByStatus(mockCycles);
    expect(grouped.active).toHaveLength(1);
    expect(grouped.active[0]!.name).toBe('Sprint 1');
    expect(grouped.completed).toHaveLength(1);
    expect(grouped.completed[0]!.name).toBe('Sprint 2');
    expect(grouped.upcoming).toHaveLength(1);
    expect(grouped.upcoming[0]!.name).toBe('Sprint 3');
  });

  it('filters cycles by search term', () => {
    const mockCycles: Cycle[] = [
      {
        id: '1',
        name: 'Alpha Release',
        description: '',
        project: 'p1',
        status: 'active',
        phase: 'active',
        milestones: [],
        deliverables: [],
        author: { id: 'u1', name: 'User 1' },
      },
      {
        id: '2',
        name: 'Beta Testing',
        description: '',
        project: 'p1',
        status: 'completed',
        phase: 'completed',
        milestones: [],
        deliverables: [],
        author: { id: 'u1', name: 'User 1' },
      },
    ];

    const grouped = groupCyclesByStatus(mockCycles, 'Alpha');
    expect(grouped.active).toHaveLength(1);
    expect(grouped.completed).toHaveLength(0);
  });
});
