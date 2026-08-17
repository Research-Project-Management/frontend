import { describe, it, expect } from 'vitest';
import {
  yourWorkItemSchema,
  yourWorkTaskSchema,
  yourWorkActivityEventSchema,
  yourWorkSummaryResponseSchema,
} from '@/features/workspaces/projects/your-work/schemas/your-work.schema';

describe('your-work.schema', () => {
  it('validates a yourWorkItem', () => {
    const validItem = {
      id: 'item-1',
      type: 'task',
      title: 'Design Wireframes',
      projectId: 'proj-1',
      projectName: 'Main Project',
      updatedAt: '2026-08-17T00:00:00.000Z',
    };
    const parsed = yourWorkItemSchema.safeParse(validItem);
    expect(parsed.success).toBe(true);
  });

  it('validates a yourWorkTask with defaults', () => {
    const task = {
      title: 'Implement Task List',
    };
    const parsed = yourWorkTaskSchema.safeParse(task);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.columnId).toBe('todo');
      expect(parsed.data.priority).toBe('none');
      expect(parsed.data.commentCount).toBe(0);
      expect(parsed.data.subtasks).toEqual([]);
    }
  });

  it('validates a yourWorkActivityEvent', () => {
    const event = {
      id: 'act-1',
      type: 'task_updated',
      actorName: 'Alice',
      actionVerb: 'completed',
      targetIdentifier: 'TASK-102',
      targetTitle: 'Refactor UI',
      time: '2026-08-17T10:00:00.000Z',
      itemId: 'task-102',
      project: { id: 'p-1', name: 'Alpha' },
      user: { name: 'Alice', avatar: null },
    };
    const parsed = yourWorkActivityEventSchema.safeParse(event);
    expect(parsed.success).toBe(true);
  });

  it('validates a yourWorkSummaryResponse with default empty arrays', () => {
    const emptyResponse = {};
    const parsed = yourWorkSummaryResponseSchema.safeParse(emptyResponse);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.assigned).toEqual([]);
      expect(parsed.data.created).toEqual([]);
      expect(parsed.data.subscribed).toEqual([]);
      expect(parsed.data.activity).toEqual([]);
    }
  });
});
