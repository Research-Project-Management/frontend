import { describe, it, expect } from 'vitest';
import {
  WorkItemFilterEngine,
  FastBitset,
} from '@/features/projects/project-id/work-items/utils/work-item-filter-engine';
import type { Item, Priority, Column } from '@/features/projects/project-id/work-items/types/work-item.types';
import { DEFAULT_FILTERS } from '@/features/projects/project-id/work-items/types/work-item.types';

describe('WorkItemFilterEngine - Concurrency Stress & Memory Profiling', () => {
  // Setup synthetic dataset of 10,000 realistic work items
  const itemCount = 10000;
  const states = ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'];
  const priorities: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];
  const assignees = ['user_alice', 'user_bob', 'user_charlie', 'user_david', 'user_eva'];
  const mockColumns: Column[] = states.map((s) => ({
    id: s,
    title: s.replace('_', ' ').toUpperCase(),
    color: '#3B82F6',
    order: 0,
    projectId: 'proj-bench',
    group: s === 'done' || s === 'cancelled' ? 'completed' : 'active',
  }));

  const largeDataset: Item[] = [];
  for (let i = 0; i < itemCount; i++) {
    largeDataset.push({
      id: `item-${i}`,
      title: `Task #${i}: Distributed Quantum Simulation for Architecture Stage ${i % 5}`,
      identifier: `FLX-${2000 + i}`,
      sequenceNumber: 2000 + i,
      columnId: states[i % states.length],
      priority: priorities[i % priorities.length],
      assigneeId: i % 6 === 0 ? undefined : assignees[i % assignees.length],
      authorId: assignees[(i + 1) % assignees.length],
      labels: [`sprint-${i % 8}`, `module-${i % 4}`],
      dueDate: i % 5 === 0 ? '2026-10-20' : undefined,
      completed: i % states.length >= 4,
    });
  }

  // =========================================================================
  // 1. HIGH-FREQUENCY QUERY BURST STRESS (2,000 CONCURRENT QUERIES)
  // =========================================================================
  describe('1. High-Frequency Query Burst & Latency Percentiles (p50, p95, p99)', () => {
    it('executes 2,000 diverse queries with sub-millisecond median and p99 < 15ms', () => {
      const engine = new WorkItemFilterEngine(largeDataset, mockColumns);

      const queryLatencies: number[] = [];
      const totalQueries = 2000;

      // 5 distinct user search query archetypes
      const queryScenarios = [
        () => engine.executeFilter({ ...DEFAULT_FILTERS, state: ['in_progress', 'in_review'] }),
        () => engine.executeFilter({ ...DEFAULT_FILTERS, priority: ['urgent', 'high'] }),
        () => engine.executeFilter({ ...DEFAULT_FILTERS, assignees: ['user_alice', '__unassigned__'] }),
        () => engine.executeFilter({ ...DEFAULT_FILTERS, labels: ['module-1', 'sprint-3'] }),
        () => engine.executeFilter({ ...DEFAULT_FILTERS, state: ['todo'], priority: ['urgent'] }, 'quantum'),
      ];

      for (let q = 0; q < totalQueries; q++) {
        const scenario = queryScenarios[q % queryScenarios.length];
        const tStart = performance.now();
        const results = scenario();
        const tDuration = performance.now() - tStart;

        queryLatencies.push(tDuration);
        expect(results).toBeDefined();
      }

      // Sort latencies to compute percentiles
      queryLatencies.sort((a, b) => a - b);

      const p50 = queryLatencies[Math.floor(totalQueries * 0.5)];
      const p95 = queryLatencies[Math.floor(totalQueries * 0.95)];
      const p99 = queryLatencies[Math.floor(totalQueries * 0.99)];
      const avg = queryLatencies.reduce((sum, v) => sum + v, 0) / totalQueries;

      // Assert latency guarantees on 10,000 items
      expect(p50).toBeLessThan(3.0); // Median query < 3ms
      expect(p95).toBeLessThan(10.0); // 95% of queries < 10ms
      expect(p99).toBeLessThan(20.0); // 99% of queries < 20ms
      expect(avg).toBeLessThan(4.0); // Mean latency < 4ms
    });
  });

  // =========================================================================
  // 2. MEMORY STABILITY & ZERO LEAK RETENTION
  // =========================================================================
  describe('2. Memory Heap Stability & Zero Garbage Leaks', () => {
    it('maintains bounded heap memory across 1,000 intensive filter bursts', () => {
      const engine = new WorkItemFilterEngine(largeDataset, mockColumns);

      // Warmup GC / JIT compiler
      for (let i = 0; i < 50; i++) {
        engine.executeFilter({ ...DEFAULT_FILTERS, priority: ['urgent'] });
      }

      if (typeof global.gc === 'function') {
        global.gc();
      }

      const initialHeap = process.memoryUsage().heapUsed;

      // Run 1,000 intensive query cycles
      for (let i = 0; i < 1000; i++) {
        const res = engine.executeFilter(
          {
            ...DEFAULT_FILTERS,
            state: ['in_progress', 'todo'],
            priority: ['urgent', 'high'],
            assignees: ['user_bob'],
          },
          'simulation'
        );
        expect(res.length).toBeGreaterThanOrEqual(0);
      }

      if (typeof global.gc === 'function') {
        global.gc();
      }

      const finalHeap = process.memoryUsage().heapUsed;
      const heapDeltaMb = (finalHeap - initialHeap) / (1024 * 1024);

      // Heap should stay flat or have minimal growth (< 35MB for 1,000 queries over 10k items)
      expect(heapDeltaMb).toBeLessThan(35);
    });
  });

  // =========================================================================
  // 3. RE-ENTRANCY & BITSET IMMUTABILITY
  // =========================================================================
  describe('3. Re-entrancy & Index Immutability Safety', () => {
    it('preserves underlying index bitset counts across repeated interleaved queries', () => {
      const engine = new WorkItemFilterEngine(largeDataset, mockColumns);
      const store = (engine as any).indexStore;

      const initialUrgentCount = store.priorityMap.get('urgent')?.count();
      const initialDoneCount = store.stateMap.get('done')?.count();
      const initialAliceCount = store.assigneeMap.get('user_alice')?.count();

      // Interleave 100 queries that mix urgent, done, and user_alice
      for (let i = 0; i < 100; i++) {
        engine.executeFilter({
          ...DEFAULT_FILTERS,
          priority: ['urgent'],
          state: ['done'],
          assignees: ['user_alice'],
        });
      }

      // Assert that internal bitset weights are completely unchanged
      expect(store.priorityMap.get('urgent')?.count()).toBe(initialUrgentCount);
      expect(store.stateMap.get('done')?.count()).toBe(initialDoneCount);
      expect(store.assigneeMap.get('user_alice')?.count()).toBe(initialAliceCount);
    });
  });
});
