import { describe, it, expect } from 'vitest';
import {
  analyzeCriticalPath,
  detectGraphCycles,
  extractNormalizedEdges,
  getPixelForTimeBinarySearch,
  calculateTaskDuration,
  wouldCauseCycle,
} from '@/features/projects/project-id/work-items/utils/cpm-graph';
import type { Item } from '@/features/projects/project-id/work-items/types/work-item.types';

describe('CPM (Critical Path Method) & DAG Graph Engine', () => {
  function createTestItem(
    id: string,
    title: string,
    startStr: string,
    dueStr: string,
    relations: Array<{ type: string; targetWorkItemId: string }> = []
  ): Item {
    return {
      id,
      title,
      identifier: `TASK-${id}`,
      columnId: 'todo',
      startDate: startStr,
      dueDate: dueStr,
      relations: relations.map((r, i) => ({
        id: `rel-${id}-${i}`,
        type: r.type as any,
        targetWorkItemId: r.targetWorkItemId,
      })),
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  describe('Relation Normalization & Inversion Symmetry', () => {
    it('normalizes "blocks" from A to B as edge A -> B', () => {
      const items = [
        createTestItem('A', 'Task A', '2026-01-01', '2026-01-05', [
          { type: 'blocks', targetWorkItemId: 'B' },
        ]),
        createTestItem('B', 'Task B', '2026-01-06', '2026-01-10'),
      ];

      const edges = extractNormalizedEdges(items);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual({ fromId: 'A', toId: 'B', type: 'FS' });
    });

    it('inverts "blocked_by" from B to A so edge is correctly A -> B (A precedes B)', () => {
      // Task B is blocked by Task A => Task A is the predecessor!
      const items = [
        createTestItem('A', 'Task A', '2026-01-01', '2026-01-05'),
        createTestItem('B', 'Task B', '2026-01-06', '2026-01-10', [
          { type: 'blocked_by', targetWorkItemId: 'A' },
        ]),
      ];

      const edges = extractNormalizedEdges(items);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual({ fromId: 'A', toId: 'B', type: 'FS' });
    });

    it('deduplicates reciprocal relations (A blocks B AND B is blocked_by A)', () => {
      const items = [
        createTestItem('A', 'Task A', '2026-01-01', '2026-01-05', [
          { type: 'blocks', targetWorkItemId: 'B' },
        ]),
        createTestItem('B', 'Task B', '2026-01-06', '2026-01-10', [
          { type: 'blocked_by', targetWorkItemId: 'A' },
        ]),
      ];

      const edges = extractNormalizedEdges(items);
      expect(edges).toHaveLength(1);
      expect(edges[0]).toEqual({ fromId: 'A', toId: 'B', type: 'FS' });
    });
  });

  describe('Cycle Detection (DFS 3-color)', () => {
    it('detects no cycle in a valid linear DAG', () => {
      const items = [
        createTestItem('A', 'Task A', '2026-01-01', '2026-01-02', [
          { type: 'blocks', targetWorkItemId: 'B' },
        ]),
        createTestItem('B', 'Task B', '2026-01-03', '2026-01-04', [
          { type: 'blocks', targetWorkItemId: 'C' },
        ]),
        createTestItem('C', 'Task C', '2026-01-05', '2026-01-06'),
      ];

      const result = analyzeCriticalPath(items);
      expect(result.hasCycle).toBe(false);
      expect(result.cycleNodeIds).toEqual([]);
      expect(result.topologicalOrder).toEqual(['A', 'B', 'C']);
    });

    it('detects cycle in circular dependencies A -> B -> C -> A gracefully', () => {
      const items = [
        createTestItem('A', 'Task A', '2026-01-01', '2026-01-02', [
          { type: 'blocks', targetWorkItemId: 'B' },
        ]),
        createTestItem('B', 'Task B', '2026-01-03', '2026-01-04', [
          { type: 'blocks', targetWorkItemId: 'C' },
        ]),
        createTestItem('C', 'Task C', '2026-01-05', '2026-01-06', [
          { type: 'blocks', targetWorkItemId: 'A' },
        ]),
      ];

      const result = analyzeCriticalPath(items);
      expect(result.hasCycle).toBe(true);
      expect(result.cycleNodeIds.length).toBeGreaterThanOrEqual(3);
      expect(result.criticalPathItemIds.size).toBe(0);
    });
  });

  describe('Critical Path Method (Forward/Backward Pass & Slack)', () => {
    it('identifies entire linear sequence as critical path', () => {
      // A (2 days) -> B (3 days) -> C (4 days) => Total = 9 days, all on critical path
      const items = [
        createTestItem('A', 'Task A', '2026-01-01', '2026-01-02', [
          { type: 'blocks', targetWorkItemId: 'B' },
        ]),
        createTestItem('B', 'Task B', '2026-01-03', '2026-01-05', [
          { type: 'blocks', targetWorkItemId: 'C' },
        ]),
        createTestItem('C', 'Task C', '2026-01-06', '2026-01-09'),
      ];

      const result = analyzeCriticalPath(items);
      expect(result.hasCycle).toBe(false);
      expect(result.projectDurationDays).toBe(9); // 2 + 3 + 4 = 9

      const nodeA = result.nodes.get('A')!;
      const nodeB = result.nodes.get('B')!;
      const nodeC = result.nodes.get('C')!;

      expect(nodeA.slackDays).toBe(0);
      expect(nodeB.slackDays).toBe(0);
      expect(nodeC.slackDays).toBe(0);

      expect(result.criticalPathItemIds.has('A')).toBe(true);
      expect(result.criticalPathItemIds.has('B')).toBe(true);
      expect(result.criticalPathItemIds.has('C')).toBe(true);
    });

    it('correctly calculates positive slack on non-critical parallel branch', () => {
      // Diamond Graph:
      // Start node: A (duration = 2)
      // Branch 1: B (duration = 2) -> Total A + B = 4
      // Branch 2: C (duration = 6) -> Total A + C = 8 (Longer!)
      // End node: D (duration = 3), depends on both B and C
      // Total project = A(2) + C(6) + D(3) = 11 days
      // Critical path: A -> C -> D
      // Non-critical node: B has slack = 6 - 2 = 4 days!
      const items = [
        createTestItem('A', 'Start', '2026-01-01', '2026-01-02', [
          { type: 'blocks', targetWorkItemId: 'B' },
          { type: 'blocks', targetWorkItemId: 'C' },
        ]),
        createTestItem('B', 'Short branch', '2026-01-03', '2026-01-04', [
          { type: 'blocks', targetWorkItemId: 'D' },
        ]),
        createTestItem('C', 'Long branch', '2026-01-03', '2026-01-08', [
          { type: 'blocks', targetWorkItemId: 'D' },
        ]),
        createTestItem('D', 'End', '2026-01-09', '2026-01-11'),
      ];

      const result = analyzeCriticalPath(items);
      expect(result.hasCycle).toBe(false);
      expect(result.projectDurationDays).toBe(11);

      const nodeB = result.nodes.get('B')!;
      const nodeC = result.nodes.get('C')!;

      expect(nodeC.slackDays).toBe(0);
      expect(nodeC.isCritical).toBe(true);

      // Node B should have 4 days of slack
      expect(nodeB.slackDays).toBe(4);
      expect(nodeB.isCritical).toBe(false);

      expect(result.criticalPathItemIds.has('A')).toBe(true);
      expect(result.criticalPathItemIds.has('C')).toBe(true);
      expect(result.criticalPathItemIds.has('D')).toBe(true);
      expect(result.criticalPathItemIds.has('B')).toBe(false);

      // Critical edges
      expect(result.criticalEdges.has('A->C')).toBe(true);
      expect(result.criticalEdges.has('C->D')).toBe(true);
      expect(result.criticalEdges.has('A->B')).toBe(false);
    });

    it('handles isolated tasks with no dependencies gracefully', () => {
      const items = [
        createTestItem('A', 'Task A', '2026-01-01', '2026-01-05'),
        createTestItem('B', 'Task B', '2026-01-06', '2026-01-10'),
      ];

      const result = analyzeCriticalPath(items);
      expect(result.hasCycle).toBe(false);
      expect(result.criticalPathItemIds.size).toBe(0); // No critical dependencies
    });
  });

  describe('High-Speed Coordinate Lookup (Binary Search vs Linear)', () => {
    it('produces identical coordinate output to linear calculation in O(log C)', () => {
      // Build 100 days of columns
      const startDate = new Date(2026, 0, 1);
      const columns = Array.from({ length: 100 }, (_, i) => {
        const s = new Date(startDate.getTime() + i * 86400000);
        const e = new Date(s.getTime() + 86400000 - 1);
        return {
          startDate: s,
          endDate: e,
          width: 50,
        };
      });

      // Test random timestamp at day 45
      const testTime = startDate.getTime() + 45.5 * 86400000;
      const pixelX = getPixelForTimeBinarySearch(testTime, columns, false);

      // Day 45 * 50px + 0.5 * 50px = 2250 + 25 = 2275px
      expect(pixelX).toBeCloseTo(2275, 1);

      // Test boundary times
      const beforeMin = startDate.getTime() - 100000;
      expect(getPixelForTimeBinarySearch(beforeMin, columns, false)).toBe(0);

      const afterMax = startDate.getTime() + 150 * 86400000;
      expect(getPixelForTimeBinarySearch(afterMax, columns, false)).toBe(100 * 50);
    });
  });

  describe('Pre-connection Cycle Prevention (wouldCauseCycle)', () => {
    it('prevents circular dependency before API dispatch', () => {
      // Existing chain: A -> B -> C
      const existingEdges = [
        { fromId: 'A', toId: 'B', type: 'FS' as const },
        { fromId: 'B', toId: 'C', type: 'FS' as const },
      ];

      // Connecting C -> A would close the loop A -> B -> C -> A
      expect(wouldCauseCycle('C', 'A', existingEdges)).toBe(true);

      // Connecting B -> A would close the loop A -> B -> A
      expect(wouldCauseCycle('B', 'A', existingEdges)).toBe(true);

      // Self-loop A -> A
      expect(wouldCauseCycle('A', 'A', existingEdges)).toBe(true);

      // Valid new branch: C -> D or A -> D
      expect(wouldCauseCycle('C', 'D', existingEdges)).toBe(false);
      expect(wouldCauseCycle('A', 'D', existingEdges)).toBe(false);
    });
  });
});
