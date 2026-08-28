import type { WorkItemMutationInput, TaskMutationInput } from '../types/work-item.types';

/**
 * Pure domain utility functions for Work Items / Tasks.
 * Zero side effects, 100% unit-testable.
 */
export const WorkItemHelpers = {
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

  createSnapshot: (data: Partial<WorkItemMutationInput | TaskMutationInput>): string =>
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
    return items.map((checklist: any) => ({
      id: checklist.id || crypto.randomUUID(),
      title: checklist.title || 'Checklist',
      items: Array.isArray(checklist.items)
        ? checklist.items.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            title: item.title || '',
            completed: Boolean(item.completed),
            assigneeId: item.assigneeId,
            dueDate: item.dueDate,
          }))
        : [],
    }));
  },

  isDueSoon: (dueDate?: string | null, daysThreshold = 3): boolean => {
    if (!dueDate) return false;
    const d = new Date(dueDate);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    const diffDays = (d.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= daysThreshold;
  },
};

export const TaskHelpers = WorkItemHelpers;
