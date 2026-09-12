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
    const targetDate = new Date(dateStr);
    if (Number.isNaN(targetDate.getTime())) return 'Just now';
    const diff = Math.floor((Date.now() - targetDate.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return targetDate.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
  },

  formatDate: (val?: string | null): string => {
    if (!val) return '';
    const targetDate = new Date(val);
    if (Number.isNaN(targetDate.getTime())) return '';
    return targetDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  },

  checkOverdue: (val?: string | null): boolean => {
    if (!val) return false;
    const targetDate = new Date(val);
    if (Number.isNaN(targetDate.getTime())) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return targetDate.getTime() < now.getTime();
  },

  uniqueLabels: (list?: string[]): string[] => Array.from(new Set(list || [])),

  countAttachments: (attachments: any): number => {
    if (!attachments) return 0;
    if (Array.isArray(attachments)) return attachments.length;
    if (typeof attachments === 'object') {
      const pages = Array.isArray(attachments.pages) ? attachments.pages.length : 0;
      const papers = Array.isArray(attachments.papers) ? attachments.papers.length : 0;
      const files = Array.isArray(attachments.files) ? attachments.files.length : 0;
      const links = Array.isArray(attachments.links) ? attachments.links.length : 0;
      return pages + papers + files + links;
    }
    return 0;
  },

  resolveAssignee: (item: { assignee?: any; assigneeId?: any } | null | undefined): { id: string; name?: string | null; avatar?: string | null } | null => {
    if (!item) return null;
    if (item.assignee && typeof item.assignee === 'object' && item.assignee.id) {
      return item.assignee;
    }
    if (typeof item.assigneeId === 'object' && item.assigneeId !== null && item.assigneeId.id) {
      return item.assigneeId;
    }
    return null;
  },

  resolveAssigneeId: (item: { assignee?: any; assigneeId?: any } | null | undefined): string | undefined => {
    if (!item) return undefined;
    if (typeof item.assigneeId === 'string' && item.assigneeId) {
      return item.assigneeId;
    }
    if (item.assignee && typeof item.assignee === 'object' && item.assignee.id) {
      return item.assignee.id;
    }
    if (typeof item.assigneeId === 'object' && item.assigneeId !== null && item.assigneeId.id) {
      return item.assigneeId.id;
    }
    return undefined;
  },

  createSnapshot: (data: any): string =>
    JSON.stringify({
      title: data.title,
      content: data.content,
      priority: data.priority,
      relations: data.relations,
      labels: data.labels,
      startDate: data.startDate,
      dueDate: data.dueDate,
      assigneeId: data.assigneeId,
      columnId: data.columnId,
      attachments: data.attachments,
    }),

  calculateProgressRollup: (
    subtasks: Array<{ completed?: boolean; columnId?: string }> = [],
  ): number => {
    if (!Array.isArray(subtasks) || subtasks.length === 0) return 0;
    let completed = 0;
    for (const sub of subtasks) {
      if (sub.completed || sub.columnId === 'done') completed++;
    }
    return Math.round((completed / subtasks.length) * 100);
  },

  isDueSoon: (dueDate?: string | null, daysThreshold = 3): boolean => {
    if (!dueDate) return false;
    const targetDate = new Date(dueDate);
    if (Number.isNaN(targetDate.getTime())) return false;
    const now = new Date();
    const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= daysThreshold;
  },
};

export const WorkItemHelpers = TaskHelpers;
export const Helpers = TaskHelpers;
