import type { TaskMutationInput } from '../types/task.types';

/**
 * Pure domain utility functions for Tasks.
 * Zero side effects, 100% unit-testable.
 */
export const TaskHelpers = {
  getInitials: (name?: string): string => {
    if (!name?.trim()) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() || 'U';
    return `${parts[0]?.[0] || ''}${parts[parts.length - 1]?.[0] || ''}`.toUpperCase();
  },

  formatActivityTime: (dateStr?: string): string => {
    if (!dateStr) return 'Just now';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Just now';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
  },

  formatDate: (val?: string | null): string => {
    if (!val) return '';
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  },

  checkOverdue: (val?: string | null): boolean => {
    if (!val) return false;
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d.getTime() < now.getTime();
  },

  uniqueLabels: (list?: string[]): string[] => Array.from(new Set(list || [])),

  createSnapshot: (data: Partial<TaskMutationInput>): string =>
    JSON.stringify({
      title: data.title,
      content: data.content,
      description: data.description,
      priority: data.priority,
      labels: data.labels,
      startDate: data.startDate,
      dueDate: data.dueDate,
      assigneeId: data.assigneeId,
      columnId: data.columnId,
      checklists: data.checklists,
      attachments: data.attachments,
    }),

  normalizeChecklists: (items: any[]) => {
    if (!Array.isArray(items)) return [];
    return items.map((c, index) => {
      if (!c.items && (c.text || c.title !== undefined)) {
        return {
          title: c.name || 'Checklist',
          items: [
            {
              title: c.text || c.title || '',
              completed: Boolean(c.completed),
              assigneeId: c.assigneeId,
              dueDate: c.dueDate,
            },
          ],
        };
      }
      return {
        title: c.title || `Checklist ${index + 1}`,
        items: (Array.isArray(c.items) ? c.items : []).map((i: any) => ({
          title: i.title || i.text || '',
          completed: Boolean(i.completed),
          assigneeId: i.assigneeId,
          dueDate: i.dueDate,
        })),
      };
    });
  },
};
