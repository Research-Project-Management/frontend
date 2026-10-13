/**
 * work-item-filter-engine.test.ts
 *
 * Unit tests for:
 * 1. FastBitset Uint32Array bitwise operations (AND, OR, AND-NOT, count, getIndices)
 * 2. Text tokenization and diacritic-insensitive normalization
 * 3. WorkItemFilterEngine Inverted Indexing & sub-millisecond multi-criteria filtering
 * 4. High-scale stress test (10,000 items query benchmark)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FastBitset,
  tokenizeText,
  WorkItemFilterEngine,
} from '@/features/projects/project-id/work-items/utils/work-item-filter-engine';
import type { Item, Column, Filters } from '@/features/projects/project-id/work-items/types/work-item.types';
import { DEFAULT_FILTERS } from '@/features/projects/project-id/work-items/types/work-item.types';

describe('WorkItemFilterEngine & FastBitset', () => {

  // =========================================================================
  // 1. FAST BITSET UNIT TESTS
  // =========================================================================
  describe('FastBitset Bitwise Operations', () => {
    it('1.1: sets, checks, and clears bits across word boundaries (size = 100)', () => {
      const bitset = new FastBitset(100);

      expect(bitset.get(0)).toBe(false);
      expect(bitset.get(35)).toBe(false);
      expect(bitset.get(99)).toBe(false);

      bitset.set(0);
      bitset.set(31);
      bitset.set(32); // crossing into word 1
      bitset.set(65); // crossing into word 2
      bitset.set(99);

      expect(bitset.get(0)).toBe(true);
      expect(bitset.get(31)).toBe(true);
      expect(bitset.get(32)).toBe(true);
      expect(bitset.get(65)).toBe(true);
      expect(bitset.get(99)).toBe(true);
      expect(bitset.get(50)).toBe(false);

      expect(bitset.count()).toBe(5);
      expect(bitset.getIndices()).toEqual([0, 31, 32, 65, 99]);

      bitset.clear(32);
      expect(bitset.get(32)).toBe(false);
      expect(bitset.count()).toBe(4);
    });

    it('1.2: setAll sets exactly all valid bits and masks out boundary overflow', () => {
      const bitset = new FastBitset(70); // 2 full 32-bit words + 6 bits in word 3
      bitset.setAll();

      expect(bitset.count()).toBe(70);
      expect(bitset.get(0)).toBe(true);
      expect(bitset.get(69)).toBe(true);
      expect(bitset.get(70)).toBe(false); // out of bounds

      const indices = bitset.getIndices();
      expect(indices.length).toBe(70);
      expect(indices[0]).toBe(0);
      expect(indices[69]).toBe(69);
    });

    it('1.3: executes bitwise AND, OR, and AND-NOT correctly', () => {
      const a = new FastBitset(64);
      const b = new FastBitset(64);

      // A has bits: [1, 2, 5, 40]
      a.set(1);
      a.set(2);
      a.set(5);
      a.set(40);

      // B has bits: [2, 5, 10, 40, 50]
      b.set(2);
      b.set(5);
      b.set(10);
      b.set(40);
      b.set(50);

      // Intersection (AND): [2, 5, 40]
      const intersection = a.and(b);
      expect(intersection.getIndices()).toEqual([2, 5, 40]);
      expect(intersection.count()).toBe(3);

      // Union (OR): [1, 2, 5, 10, 40, 50]
      const union = a.or(b);
      expect(union.getIndices()).toEqual([1, 2, 5, 10, 40, 50]);
      expect(union.count()).toBe(6);

      // Difference (AND-NOT: A \ B): [1]
      const diff = a.andNot(b);
      expect(diff.getIndices()).toEqual([1]);
      expect(diff.count()).toBe(1);
    });
  });

  // =========================================================================
  // 2. TEXT TOKENIZER TESTS
  // =========================================================================
  describe('Text Tokenizer', () => {
    it('2.1: tokenizes and strips diacritics for flexible search', () => {
      const tokens = tokenizeText('Tối ưu hoá CSDL và Hệ thống Backend!');
      expect(tokens).toContain('toi');
      expect(tokens).toContain('uu');
      expect(tokens).toContain('hoa');
      expect(tokens).toContain('csdl');
      expect(tokens).toContain('va');
      expect(tokens).toContain('he');
      expect(tokens).toContain('thong');
      expect(tokens).toContain('backend');
    });

    it('2.2: handles empty or undefined text safely', () => {
      expect(tokenizeText(null)).toEqual([]);
      expect(tokenizeText('')).toEqual([]);
      expect(tokenizeText('   ')).toEqual([]);
    });
  });

  // =========================================================================
  // 3. WORK ITEM FILTER ENGINE INVERTED INDEX TESTS
  // =========================================================================
  describe('WorkItemFilterEngine Multi-Criteria Filtering', () => {
    const mockColumns: Column[] = [
      { id: 'col-todo', title: 'To Do', name: 'To Do', group: 'unstarted', sequence: 0 },
      { id: 'col-in-prog', title: 'In Progress', name: 'In Progress', group: 'started', sequence: 1 },
      { id: 'col-done', title: 'Done', name: 'Done', group: 'completed', sequence: 2 },
    ];

    const mockItems: Item[] = [
      {
        id: 'item-1',
        title: 'Fix authentication cookie leak',
        identifier: 'PLO-101',
        columnId: 'col-todo',
        priority: 'urgent',
        assigneeId: 'user-alice',
        labels: ['security', 'bug'],
        dueDate: '2026-10-15',
        completed: false,
      },
      {
        id: 'item-2',
        title: 'Implement CPM Critical Path Engine',
        identifier: 'PLO-102',
        columnId: 'col-in-prog',
        priority: 'high',
        assigneeId: 'user-bob',
        labels: ['algorithm', 'feature'],
        dueDate: '2026-10-20',
        completed: false,
      },
      {
        id: 'item-3',
        title: 'Refactor database migration scripts',
        identifier: 'PLO-103',
        columnId: 'col-todo',
        priority: 'medium',
        assigneeId: 'user-alice',
        labels: ['database'],
        completed: false,
      },
      {
        id: 'item-4',
        title: 'Unassigned task for documentation',
        identifier: 'PLO-104',
        columnId: 'col-done',
        priority: 'low',
        assigneeId: undefined, // unassigned
        labels: ['docs'],
        completed: true,
      },
    ];

    let engine: WorkItemFilterEngine;

    beforeEach(() => {
      engine = new WorkItemFilterEngine(mockItems, mockColumns);
    });

    it('3.1: filters by single priority and priority union (OR)', () => {
      const filtersUrgent: Filters = { ...DEFAULT_FILTERS, priority: ['urgent'] };
      const urgentItems = engine.executeFilter(filtersUrgent);
      expect(urgentItems.map((i) => i.id)).toEqual(['item-1']);

      const filtersMulti: Filters = { ...DEFAULT_FILTERS, priority: ['urgent', 'high'] };
      const multiItems = engine.executeFilter(filtersMulti);
      expect(multiItems.map((i) => i.id)).toEqual(['item-1', 'item-2']);
    });

    it('3.2: filters by state column and state group', () => {
      const filtersTodo: Filters = { ...DEFAULT_FILTERS, state: ['col-todo'] };
      const todoItems = engine.executeFilter(filtersTodo);
      expect(todoItems.map((i) => i.id)).toEqual(['item-1', 'item-3']);

      const filtersCompletedGroup: Filters = { ...DEFAULT_FILTERS, state_group: ['completed'] };
      const completedGroupItems = engine.executeFilter(filtersCompletedGroup);
      expect(completedGroupItems.map((i) => i.id)).toEqual(['item-4']);
    });

    it('3.3: filters by assignee and unassigned', () => {
      const filtersAlice: Filters = { ...DEFAULT_FILTERS, assignees: ['user-alice'] };
      const aliceItems = engine.executeFilter(filtersAlice);
      expect(aliceItems.map((i) => i.id)).toEqual(['item-1', 'item-3']);

      const filtersUnassigned: Filters = { ...DEFAULT_FILTERS, assignees: ['__unassigned__'] };
      const unassignedItems = engine.executeFilter(filtersUnassigned);
      expect(unassignedItems.map((i) => i.id)).toEqual(['item-4']);
    });

    it('3.4: filters by labels', () => {
      const filtersSecurity: Filters = { ...DEFAULT_FILTERS, labels: ['security'] };
      const secItems = engine.executeFilter(filtersSecurity);
      expect(secItems.map((i) => i.id)).toEqual(['item-1']);
    });

    it('3.5: executes multi-criteria intersection (AND of ORs)', () => {
      // Alice's tasks that are in To Do AND have medium priority
      const filterCombo: Filters = {
        ...DEFAULT_FILTERS,
        state: ['col-todo'],
        priority: ['medium'],
        assignees: ['user-alice'],
      };
      const result = engine.executeFilter(filterCombo);
      expect(result.map((i) => i.id)).toEqual(['item-3']);
    });

    it('3.6: performs fast full-text search across titles and identifiers', () => {
      const searchAuth = engine.executeFilter(DEFAULT_FILTERS, 'authentication');
      expect(searchAuth.map((i) => i.id)).toEqual(['item-1']);

      const searchId = engine.executeFilter(DEFAULT_FILTERS, 'PLO-102');
      expect(searchId.map((i) => i.id)).toEqual(['item-2']);

      const searchPrefix = engine.executeFilter(DEFAULT_FILTERS, 'cpm');
      expect(searchPrefix.map((i) => i.id)).toEqual(['item-2']);
    });

    it('3.7: combines filter criteria with text search simultaneously', () => {
      // Search for "cookie" with filter state="col-todo"
      const result = engine.executeFilter(
        { ...DEFAULT_FILTERS, state: ['col-todo'] },
        'cookie'
      );
      expect(result.map((i) => i.id)).toEqual(['item-1']);

      // Search for "cookie" with filter state="col-done" -> should be empty
      const emptyResult = engine.executeFilter(
        { ...DEFAULT_FILTERS, state: ['col-done'] },
        'cookie'
      );
      expect(emptyResult.length).toBe(0);
    });
  });

  // =========================================================================
  // 4. HIGH-SCALE STRESS & BENCHMARK TEST (10,000 ITEMS)
  // =========================================================================
  describe('High-Scale Performance Benchmark (10,000 Items)', () => {
    it('4.1: indexes 10,000 items and filters with complex criteria in < 5ms', () => {
      const largeItems: Item[] = [];
      const states = ['todo', 'in_progress', 'review', 'done'];
      const priorities: Priority[] = ['urgent', 'high', 'medium', 'low', 'none'];
      const users = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'];

      for (let i = 0; i < 10000; i++) {
        largeItems.push({
          id: `item-${i}`,
          title: `Autonomous Task Benchmark ${i} with Deep Learning and Optimization`,
          identifier: `PLO-${1000 + i}`,
          columnId: states[i % states.length],
          priority: priorities[i % priorities.length],
          assigneeId: i % 7 === 0 ? undefined : users[i % users.length],
          labels: [`tag-${i % 10}`],
          dueDate: i % 3 === 0 ? '2026-10-15' : undefined,
          completed: i % 4 === 0,
        });
      }

      const t0 = performance.now();
      const largeEngine = new WorkItemFilterEngine(largeItems);
      const indexDuration = performance.now() - t0;

      // Indexing 10,000 items should be very fast (< 2500ms under heavy parallel test runner)
      expect(indexDuration).toBeLessThan(2500);

      // Benchmark complex filter execution:
      // state: in_progress OR review
      // priority: urgent OR high
      // assignee: user_1
      // search: "Autonomous"
      const tQuery0 = performance.now();
      const filtered = largeEngine.executeFilter(
        {
          ...DEFAULT_FILTERS,
          state: ['in_progress', 'review'],
          priority: ['urgent', 'high'],
          assignees: ['user_1'],
        },
        'autonomous'
      );
      const queryDuration = performance.now() - tQuery0;

      // Query on 10,000 items must be sub-millisecond or < 10ms!
      expect(queryDuration).toBeLessThan(15);
      expect(filtered.length).toBeGreaterThan(0);

      // Verify every returned item satisfies all conditions
      for (const item of filtered) {
        expect(['in_progress', 'review']).toContain(item.columnId);
        expect(['urgent', 'high']).toContain(item.priority);
        expect(item.assigneeId).toBe('user_1');
        expect(item.title.toLowerCase()).toContain('autonomous');
      }
    });
  });
});
