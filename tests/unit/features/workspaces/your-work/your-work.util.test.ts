import { describe, it, expect } from 'vitest';
import {
  createProjectMap,
  createTaskProjectMap,
  getTaskProjectId,
  getTaskProject,
  categorizeTasks,
  getDefaultStatusBreakdown,
  getDefaultPriorityBreakdown,
} from '@/features/workspaces/projects/your-work/utils/your-work.util';

describe('your-work.util', () => {
  describe('createProjectMap & createTaskProjectMap', () => {
    it('creates a map of projects keyed by id', () => {
      const projects = [
        { id: 'proj-1', name: 'Project Alpha' },
        { _id: 'proj-2', name: 'Project Beta' },
      ];
      const map = createProjectMap(projects);
      expect(map).toEqual({
        'proj-1': { id: 'proj-1', name: 'Project Alpha' },
        'proj-2': { id: 'proj-2', name: 'Project Beta' },
      });
      // Alias test
      expect(createTaskProjectMap(projects)).toEqual(map);
    });

    it('ignores projects without id or _id', () => {
      const projects = [{ name: 'No ID' } as any];
      const map = createProjectMap(projects);
      expect(map).toEqual({});
    });
  });

  describe('getTaskProjectId', () => {
    it('extracts string projectId', () => {
      expect(getTaskProjectId({ projectId: 'p-123' })).toBe('p-123');
    });

    it('extracts object projectId with id or _id', () => {
      expect(getTaskProjectId({ projectId: { id: 'p-456' } })).toBe('p-456');
      expect(getTaskProjectId({ projectId: { _id: 'p-789' } })).toBe('p-789');
    });

    it('extracts project field fallback', () => {
      expect(getTaskProjectId({ project: 'p-str' })).toBe('p-str');
      expect(getTaskProjectId({ project: { id: 'p-obj' } })).toBe('p-obj');
    });

    it('returns null for empty or missing project', () => {
      expect(getTaskProjectId(null)).toBeNull();
      expect(getTaskProjectId({})).toBeNull();
      expect(getTaskProjectId({ projectId: '   ' })).toBeNull();
    });
  });

  describe('getTaskProject', () => {
    const projectMap = {
      'p-1': { id: 'p-1', name: 'Alpha' },
      'p-2': { id: 'p-2', name: 'Beta' },
    };

    it('returns embedded project name if present', () => {
      const task = { project: { id: 'p-custom', name: 'Custom Project' } };
      expect(getTaskProject(task, projectMap)).toEqual({
        id: 'p-custom',
        name: 'Custom Project',
      });
    });

    it('resolves project from projectMap by projectId', () => {
      const task = { id: 'task-100', projectId: 'p-1', title: 'Task Title' };
      expect(getTaskProject(task, projectMap)).toEqual({
        id: 'p-1',
        name: 'Alpha',
      });
    });

    it('returns null if project cannot be resolved', () => {
      const task = { id: 'task-100', projectId: 'p-unknown' };
      expect(getTaskProject(task, projectMap)).toBeNull();
    });
  });

  describe('categorizeTasks', () => {
    it('returns empty collections when currentUserId is null or undefined', () => {
      const result = categorizeTasks([{ id: '1', title: 'Task' }], null);
      expect(result.assigned).toEqual([]);
      expect(result.created).toEqual([]);
      expect(result.subscribed).toEqual([]);
      expect(result.statusBreakdown).toEqual(getDefaultStatusBreakdown());
      expect(result.priorityBreakdown).toEqual(getDefaultPriorityBreakdown());
    });

    it('accurately categorizes assigned, created, and subscribed tasks', () => {
      const userId = 'user-1';
      const tasks = [
        // Assigned to user
        {
          id: 't-1',
          title: 'Assigned Task 1',
          assigneeId: 'user-1',
          columnId: 'doing',
          priority: 'high',
        },
        // Created by user (not assigned)
        {
          id: 't-2',
          title: 'Created Task 1',
          author: { id: 'user-1' },
          assignee: { id: 'user-2' },
          columnId: 'todo',
        },
        // Subscribed: neither assignee nor author, but has comments
        {
          id: 't-3',
          title: 'Subscribed Task 1',
          authorId: 'user-2',
          assigneeId: 'user-3',
          commentCount: 4,
          columnId: 'review',
        },
        // Both assigned and created
        {
          id: 't-4',
          title: 'Assigned & Created',
          authorId: 'user-1',
          assigneeId: 'user-1',
          columnId: 'done',
          priority: 'urgent',
        },
      ];

      const result = categorizeTasks(tasks, userId);

      expect(result.assigned.map((t) => t.id)).toEqual(['t-1', 't-4']);
      expect(result.created.map((t) => t.id)).toEqual(['t-2', 't-4']);
      expect(result.subscribed.map((t) => t.id)).toEqual(['t-3']);

      // Status breakdown of assigned tasks
      expect(result.statusBreakdown.doing).toBe(1);
      expect(result.statusBreakdown.done).toBe(1);
      expect(result.statusBreakdown.todo).toBe(0);

      // Priority breakdown of assigned tasks
      expect(result.priorityBreakdown.high).toBe(1);
      expect(result.priorityBreakdown.urgent).toBe(1);
      expect(result.priorityBreakdown.medium).toBe(0);
    });
  });
});
