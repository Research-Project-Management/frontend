import { describe, it, expect } from 'vitest';
import { TaskHelpers } from '@/features/workspaces/projects/project-id/work-items/utils/util';

describe('TaskHelpers / WorkItemHelpers Domain Utilities', () => {
  describe('countAttachments', () => {
    it('should return 0 for null or undefined', () => {
      expect(TaskHelpers.countAttachments(null)).toBe(0);
      expect(TaskHelpers.countAttachments(undefined)).toBe(0);
    });

    it('should return array length for legacy TaskAttachment[] format', () => {
      const legacyAttachments = [
        { id: 'att-1', name: 'diagram.png', url: '/files/1' },
        { id: 'att-2', name: 'notes.pdf', url: '/files/2' },
      ];
      expect(TaskHelpers.countAttachments(legacyAttachments)).toBe(2);
    });

    it('should calculate total across pages, papers, files, links in 4-category format', () => {
      const modernAttachments = {
        pages: [{ id: 'p-1', title: 'Doc Page' }],
        papers: [{ id: 'pap-1', title: 'Research Paper' }, { id: 'pap-2', title: 'Survey' }],
        files: [{ id: 'f-1', name: 'data.csv', url: '/f1' }],
        links: [{ title: 'Google', url: 'https://google.com' }],
      };
      expect(TaskHelpers.countAttachments(modernAttachments)).toBe(5);
    });

    it('should handle partial/missing arrays in 4-category format', () => {
      const partialAttachments = {
        files: [{ id: 'f-1', name: 'spec.pdf', url: '/f1' }],
      };
      expect(TaskHelpers.countAttachments(partialAttachments)).toBe(1);
    });
  });

  describe('resolveAssignee and resolveAssigneeId', () => {
    it('should resolve standard assignee object', () => {
      const task = {
        assigneeId: 'user-1',
        assignee: { id: 'user-1', name: 'Alice', avatar: 'https://avatar.png' },
      };
      expect(TaskHelpers.resolveAssignee(task)).toEqual({
        id: 'user-1',
        name: 'Alice',
        avatar: 'https://avatar.png',
      });
      expect(TaskHelpers.resolveAssigneeId(task)).toBe('user-1');
    });

    it('should resolve polymorphic assigneeId object', () => {
      const task = {
        assigneeId: { id: 'user-2', name: 'Bob', avatar: null },
      };
      expect(TaskHelpers.resolveAssignee(task)).toEqual({
        id: 'user-2',
        name: 'Bob',
        avatar: null,
      });
      expect(TaskHelpers.resolveAssigneeId(task)).toBe('user-2');
    });

    it('should return undefined id and null assignee for unassigned task', () => {
      const task = { assigneeId: null, assignee: null };
      expect(TaskHelpers.resolveAssignee(task)).toBeNull();
      expect(TaskHelpers.resolveAssigneeId(task)).toBeUndefined();
    });
  });

  describe('calculateProgressRollup', () => {
    it('should calculate completion percentage from subtasks', () => {
      const subtasks = [
        { completed: true },
        { columnId: 'done' },
        { completed: false, columnId: 'in-progress' },
        { completed: false, columnId: 'todo' },
      ];
      expect(TaskHelpers.calculateProgressRollup(subtasks)).toBe(50);
    });

    it('should return 0 for empty subtasks', () => {
      expect(TaskHelpers.calculateProgressRollup([])).toBe(0);
    });
  });

  describe('getInitials', () => {
    it('should extract correct initials from Vietnamese and international names', () => {
      expect(TaskHelpers.getInitials('Nguyen Van A')).toBe('NA');
      expect(TaskHelpers.getInitials('Alice Smith')).toBe('AS');
      expect(TaskHelpers.getInitials('Admin')).toBe('AD');
      expect(TaskHelpers.getInitials('')).toBe('U');
    });
  });
});
