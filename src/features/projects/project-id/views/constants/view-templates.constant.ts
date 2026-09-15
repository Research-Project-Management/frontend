import type { ViewLayoutMode, ViewAccessType } from '../types/view.types';

export interface ViewTemplatePreset {
  id: string;
  name: string;
  description: string;
  layout: ViewLayoutMode;
  access: ViewAccessType;
  badge: string;
  badgeColor: string;
  filters: Record<string, any>;
}

export const RECOMMENDED_VIEW_TEMPLATES: ViewTemplatePreset[] = [
  {
    id: 'active-cycle',
    name: 'Active Sprint',
    description: 'All uncompleted work items in the active sprint cycle',
    layout: 'board',
    access: 'public',
    badge: 'Sprint',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    filters: {
      state_group: ['unstarted', 'started'],
    },
  },
  {
    id: 'critical-bugs',
    name: 'Urgent & Blockers',
    description: 'High-priority items requiring immediate attention and triage',
    layout: 'list',
    access: 'public',
    badge: 'Urgent',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    filters: {
      priority: ['urgent', 'high'],
      state_group: ['unstarted', 'started'],
    },
  },
  {
    id: 'my-tasks',
    name: 'Assigned to Me',
    description: 'Items directly assigned to your account across all cycles',
    layout: 'table',
    access: 'private',
    badge: 'Personal',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    filters: {
      state_group: ['unstarted', 'started'],
    },
  },
  {
    id: 'roadmap-overview',
    name: 'Release Roadmap',
    description: 'Chronological timeline of milestone deliverables and target dates',
    layout: 'timeline',
    access: 'public',
    badge: 'Planning',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    filters: {},
  },
  {
    id: 'completed-archive',
    name: 'Recently Completed',
    description: 'Work items finished and verified within recent milestones',
    layout: 'list',
    access: 'public',
    badge: 'Done',
    badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
    filters: {
      state_group: ['completed'],
    },
  },
];
