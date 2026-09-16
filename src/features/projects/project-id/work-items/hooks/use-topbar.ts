'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { isSameWeek } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ViewService, type SavedViewRecord } from '../services/view.service';
import { useProperty } from './use-property';
import type {
  Item,
  Column,
  Project,
  Cycle,
  Priority,
  StateGroup,
  DisplayOptions,
  DueDateFilterOption,
  DisplayPropertyKey,
  Filters,
  ProjectMember,
} from '../types/work-item.types';
import {
  DEFAULT_DISPLAY_OPTIONS,
  DEFAULT_FILTERS,
  STATE_GROUPS,
} from '../types/work-item.types';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { ItemHelpers, resolveStateId, inferStateGroup } from '../utils/work-item.utils';

export type ViewMode = 'board' | 'list' | 'calendar' | 'table' | 'timeline' | 'split';

const ITEMS_VIEW_STORAGE_KEY = 'flux:work-items-view-mode';
const DISPLAY_OPTIONS_STORAGE_KEY = 'flux:work-item-display-options';
const VALID_MODES: ViewMode[] = ['board', 'list', 'calendar', 'table', 'timeline', 'split'];

const PRIORITY_WEIGHT: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export type AssigneeFilterOption = {
  id: string;
  name: string;
  avatar?: string;
};

export interface UseTopbarOptions {
  items?: Item[];
  workItems?: Item[];
  columns?: Column[];
  selectedColumnIds?: string[];
  onColumnFilterChange?: (colIds: string[]) => void;
  assignees?: AssigneeFilterOption[];
  members?: ProjectMember[];
  selectedAssigneeIds?: string[];
  onAssigneeFilterChange?: (userIds: string[]) => void;
  cycleId?: string;
  cycles?: Cycle[];
  initialFilters?: Partial<Filters>;
}

export function useTopbar({
  items: propItems,
  workItems: propWorkItems,

  columns = [],
  selectedColumnIds: propColIds,
  onColumnFilterChange: propOnColFilterChange,
  assignees: propUsers,
  members,
  selectedAssigneeIds: propUserIds,
  onAssigneeFilterChange: propOnUserFilterChange,
  cycleId,
  cycles = [],
  initialFilters,
}: UseTopbarOptions = {}) {
  const items = propItems || propWorkItems || [];
  const { projectId } = useParams() as { projectId: string };
  const workspaceId = projectId;
  const router = useRouter();
  const pathname = usePathname();
  const { projects = [] } = useProjects();
  const queryClient = useQueryClient();

  // ── Saved Views Query ──────────────────────────────────────────────────────
  const { data: savedViews = [] } = useQuery({
    queryKey: ['project-saved-views', projectId],
    queryFn: () => ViewService.getViews(projectId),
    enabled: Boolean(projectId),
  });

  const [activeViewId, setActiveViewId] = useState<string | undefined>(undefined);

  // ── User Project Properties Query (Delegated to dedicated useProperty hook) ──
  const { userProperties, updateProperties } = useProperty(projectId);

  // ── View Mode State ───────────────────────────────────────────────────────
  const [mode, setModeState] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(ITEMS_VIEW_STORAGE_KEY) as ViewMode;
        if (saved && VALID_MODES.includes(saved)) return saved;
      } catch {}
    }
    return 'board';
  });

  const setMode = useCallback((newMode: ViewMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ITEMS_VIEW_STORAGE_KEY, newMode);
      } catch {}
    }
    if (projectId) {
      updateProperties({ preferences: { viewMode: newMode } });
    }
  }, [projectId, updateProperties]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(ITEMS_VIEW_STORAGE_KEY) as ViewMode;
        if (saved && VALID_MODES.includes(saved)) {
          setModeState((prev) => (saved !== prev ? saved : prev));
        }
      } catch {}
    }
  }, []);

  // Sync userProperties into mode and display options on initial load
  useEffect(() => {
    if (userProperties) {
      const savedMode = (userProperties.preferences as any)?.viewMode as ViewMode | undefined;
      if (savedMode && VALID_MODES.includes(savedMode)) {
        setModeState((prev) => (prev !== savedMode ? savedMode : prev));
      }
      const beDisplayProps = userProperties.displayProperties as Record<string, boolean> | undefined;
      const beDisplayFilters = userProperties.displayFilters as Record<string, any> | undefined;

      if (
        (beDisplayProps && Object.keys(beDisplayProps).length > 0) ||
        (beDisplayFilters && Object.keys(beDisplayFilters).length > 0)
      ) {
        setDisplayOptionsState((prev) => ({
          ...prev,
          ...(beDisplayProps ? { properties: { ...prev.properties, ...beDisplayProps } } : {}),
          ...(beDisplayFilters?.groupBy ? { groupBy: beDisplayFilters.groupBy } : {}),
          ...(beDisplayFilters?.subGroupBy ? { subGroupBy: beDisplayFilters.subGroupBy } : {}),
          ...(beDisplayFilters?.orderBy ? { orderBy: beDisplayFilters.orderBy } : {}),
          ...(beDisplayFilters?.orderDirection ? { orderDirection: beDisplayFilters.orderDirection } : {}),
          ...(beDisplayFilters?.showEmptyGroups !== undefined ? { showEmptyGroups: Boolean(beDisplayFilters.showEmptyGroups) } : {}),
          ...(beDisplayFilters?.showChildWorkItems !== undefined ? { showChildWorkItems: Boolean(beDisplayFilters.showChildWorkItems) } : {}),
        }));
      }
    }
  }, [userProperties]);

  // ── Unified Filter State ──────────────────────────────────────────────────
  const [localFilters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    ...(initialFilters || {}),
  }));

  // Derived filter state: derive controlled props directly without useEffect (rerender-derived-state-no-effect)
  const filters = useMemo<Filters>(
    () => ({
      ...localFilters,
      ...(propColIds !== undefined ? { state: propColIds } : {}),
      ...(propUserIds !== undefined ? { assignees: propUserIds } : {}),
    }),
    [localFilters, propColIds, propUserIds],
  );

  // ── Popover & Drawer Open States ──────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // ── Display Options State ─────────────────────────────────────────────────
  const [displayOptions, setDisplayOptionsState] = useState<DisplayOptions>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DISPLAY_OPTIONS_STORAGE_KEY);
        if (saved) return { ...DEFAULT_DISPLAY_OPTIONS, ...(JSON.parse(saved) as Partial<DisplayOptions>) };
      } catch {}
    }
    return DEFAULT_DISPLAY_OPTIONS;
  });

  const setDisplayOptions = useCallback((options: DisplayOptions) => {
    setDisplayOptionsState(options);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(options));
      } catch {}
    }
    if (projectId) {
      const { properties, ...displayFilters } = options;
      updateProperties({
        displayProperties: properties as any,
        displayFilters: displayFilters as any,
      });
    }
  }, [projectId, updateProperties]);

  const updateDisplayProperty = useCallback((key: DisplayPropertyKey, value: boolean) => {
    setDisplayOptionsState((prev) => {
      const nextProps: Record<string, boolean> = {
        ...prev.properties,
        [key]: value,
      };
      if (key === 'subWorkItemCount') {
        nextProps.subWorkItemCount = value;
      }
      if (key === 'attachmentCount' || key === 'attach') {
        nextProps.attachmentCount = value;
        nextProps.attach = value;
      }
      if (key === 'link' || key === 'dependencies') {
        nextProps.link = value;
        nextProps.dependencies = value;
      }
      const next = {
        ...prev,
        properties: nextProps as any,
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }
      if (projectId) {
        updateProperties({ displayProperties: next.properties as any });
      }
      return next;
    });
  }, [projectId, updateProperties]);

  // ── Saved View Controller Actions ─────────────────────────────────────────
  const selectSavedView = useCallback((view: SavedViewRecord) => {
    setActiveViewId(view.id);
    if (view.layout && VALID_MODES.includes(view.layout as ViewMode)) {
      setModeState(view.layout as ViewMode);
    }
    if (view.filters) {
      setFilters((prev) => ({
        ...prev,
        ...(view.filters as any),
      }));
    }
    if (view.displayProperties) {
      setDisplayOptionsState((prev) => ({
        ...prev,
        properties: {
          ...prev.properties,
          ...(view.displayProperties as any),
        },
      }));
    }
  }, []);

  const saveCurrentViewMutation = useMutation({
    mutationFn: (name: string) =>
      ViewService.createView(projectId, {
        name,
        layout: mode,
        filters: filters as any,
        displayProperties: displayOptions.properties as any,
        access: 'public',
      }),
    onSuccess: (newView: SavedViewRecord) => {
      queryClient.invalidateQueries({ queryKey: ['project-saved-views', projectId] });
      setActiveViewId(newView.id);
      toast.success(`Saved view "${newView.name}"`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save view');
    },
  });

  // ── Dropdown Search States ────────────────────────────────────────────────
  const [projSearch, setProjSearch] = useState('');
  const [cycleSearch, setCycleSearch] = useState('');

  // ── Assignees List with Unassigned Option ─────────────────────────────────
  const assignees = useMemo(() => {
    const map = new Map<string, AssigneeFilterOption>();
    let hasUnassigned = false;

    // 1. If explicit propUsers provided, start with them
    if (propUsers && propUsers.length > 0) {
      for (const user of propUsers) {
        if (user.id !== '__unassigned__' && user.id !== 'unassigned') {
          map.set(user.id, user);
        } else {
          hasUnassigned = true;
        }
      }
    }

    // 2. Add project members
    if (Array.isArray(members) && members.length > 0) {
      for (const member of members) {
        const id = (member as any).userId || (member as any).user?.id || member.id;
        if (!id) continue;
        const name = member.name || (member as any).user?.name || 'Member';
        const avatar = member.avatar || (member as any).user?.avatar || undefined;
        if (!map.has(id)) {
          map.set(id, { id, name, avatar });
        }
      }
    }

    // 3. Scan items for any assignees not already in map
    if (Array.isArray(items)) {
      for (const item of items) {
        const assignee = ItemHelpers.resolveAssignee(item);
        const assigneeUserId = ItemHelpers.resolveAssigneeId(item);

        if (assigneeUserId && assignee) {
          if (!map.has(assigneeUserId)) {
            map.set(assigneeUserId, {
              id: assigneeUserId,
              name: assignee.name || 'Unknown',
              avatar: assignee.avatar || undefined,
            });
          }
        } else if (!assigneeUserId) {
          hasUnassigned = true;
        }
      }
    }
    const list = Array.from(map.values()).sort((first, second) =>
      (first.name || '').localeCompare(first.name || '', 'vi')
    );
    if (hasUnassigned || list.length > 0) list.push({ id: '__unassigned__', name: 'Unassigned' });
    return list;
  }, [items, propUsers, members]);

  // ── Comprehensive Filtering Engine ───────────────────────────────────────
  const filteredItems = useMemo(() => {
    let result = Array.isArray(items) ? items : [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. State (Column) filter
    if (filters.state.length > 0) {
      result = result.filter((item) => item?.columnId && filters.state.includes(item.columnId));
    }

    // 3. State Group filter
    if (filters.state_group.length > 0) {
      result = result.filter((item) => {
        if (!item?.columnId) return false;
        const column = columns.find((col) => resolveStateId(col) === item.columnId);
        const group =
          column?.group && (STATE_GROUPS as readonly string[]).includes(column.group)
            ? column.group
            : inferStateGroup(item.columnId, column?.title || '');
        return filters.state_group.includes(group as StateGroup);
      });
    }

    // 4. Priority filter
    if (filters.priority.length > 0) {
      result = result.filter((item) => filters.priority.includes(item.priority || 'none'));
    }

    // 5. Assignees filter
    if (filters.assignees.length > 0) {
      const hasUnassignedFilter =
        filters.assignees.includes('__unassigned__') || filters.assignees.includes('unassigned');
      const specificUserIds = filters.assignees.filter(
        (id) => id !== '__unassigned__' && id !== 'unassigned',
      );

      result = result.filter((item) => {
        const assigneeUserId = ItemHelpers.resolveAssigneeId(item);

        if (!assigneeUserId) {
          return hasUnassignedFilter;
        }
        return specificUserIds.includes(assigneeUserId);
      });
    }

    // 6. Mentions filter
    if (filters.mentions.length > 0) {
      result = result.filter((item) => {
        const text = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.toLowerCase();
        return filters.mentions.some((userId) => {
          const user = assignees.find((assignee) => assignee.id === userId);
          if (user?.name && text.includes(`@${user.name.toLowerCase()}`)) return true;
          const assigneeUserId = ItemHelpers.resolveAssigneeId(item);
          return assigneeUserId === userId;
        });
      });
    }

    // 7. Created by filter
    if (filters.created_by.length > 0) {
      result = result.filter((item) => {
        const author = item.authorId || (item as any).createdBy;
        return author && filters.created_by.includes(author);
      });
    }

    // 8. Labels filter (supports both string[] and object[] labels)
    if (filters.labels.length > 0) {
      result = result.filter((item) => {
        if (!Array.isArray(item.labels) || item.labels.length === 0) return false;
        return item.labels.some((labelItem: any) => {
          if (typeof labelItem === 'string') {
            return filters.labels.includes(labelItem);
          }
          if (typeof labelItem === 'object' && labelItem !== null) {
            return (
              (labelItem.id && filters.labels.includes(labelItem.id)) ||
              (labelItem.name && filters.labels.includes(labelItem.name))
            );
          }
          return false;
        });
      });
    }

    // 9. Cycle filter
    if (filters.cycle.length > 0) {
      const hasNoCycle =
        filters.cycle.includes('__no_cycle__') || filters.cycle.includes('no_cycle');
      const specificCycles = filters.cycle.filter(
        (id) => id !== '__no_cycle__' && id !== 'no_cycle',
      );

      result = result.filter((item) => {
        const targetCycleId =
          (item as any).cycleId ||
          (typeof (item as any).cycle === 'object' && (item as any).cycle !== null
            ? (item as any).cycle?.id
            : (item as any).cycle);
        if (!targetCycleId) return hasNoCycle;
        return specificCycles.includes(targetCycleId);
      });
    }

    // 10. Attach filter
    if (filters.attach.length > 0) {
      result = result.filter((item) => {
        const attachments = item.attachments;
        const hasPages = Array.isArray((attachments as any)?.pages) && (attachments as any).pages.length > 0;
        const hasPapers = Array.isArray((attachments as any)?.papers) && (attachments as any).papers.length > 0;
        const hasFiles =
          (Array.isArray((attachments as any)?.files) && (attachments as any).files.length > 0) ||
          (Array.isArray(attachments) && attachments.length > 0);
        const hasLinks = Array.isArray((attachments as any)?.links) && (attachments as any).links.length > 0;
        const hasAny = hasPages || hasPapers || hasFiles || hasLinks;

        return filters.attach.some((attFilter) => {
          if (attFilter === 'has:attach' || attFilter === 'has_attachments') return hasAny;
          if (attFilter === 'attach:pages' || attFilter === 'pages') return hasPages;
          if (attFilter === 'attach:papers' || attFilter === 'papers') return hasPapers;
          if (attFilter === 'attach:files' || attFilter === 'files') return hasFiles;
          if (attFilter === 'attach:links' || attFilter === 'links') return hasLinks;
          return false;
        });
      });
    }

    // 11. Work items filter
    const activeWorkItemFilterIds = [
      ...(filters.work_items || []),
    ];
    if (activeWorkItemFilterIds.length > 0) {
      result = result.filter(
        (item) =>
          activeWorkItemFilterIds.includes(item.id) ||
          (item.identifier && activeWorkItemFilterIds.includes(item.identifier)),
      );
    }

    // 12. Parent filter
    if (filters.parent.length > 0) {
      const hasNone =
        filters.parent.includes('__none__') || filters.parent.includes('parent:none');
      const specificParents = filters.parent.filter(
        (id) => id !== '__none__' && id !== 'parent:none',
      );

      result = result.filter((item) => {
        const rawParent =
          (item as any).parentWorkItemId ||
          (item as any).parentItemId ||
          item.parentItem?.id ||
          item.parentWorkItem?.id;
        const parentId =
          typeof rawParent === 'object' ? rawParent?.id : rawParent;
        if (!parentId) return hasNone;
        return specificParents.includes(parentId);
      });
    }

    // 13. Due Date filter
    if (filters.due_date.length > 0) {
      result = result.filter((item) => {
        if (!item.dueDate) return filters.due_date.includes('no_date');
        const due = new Date(item.dueDate);
        return filters.due_date.some((option) => {
          if (option === 'all') return true;
          if (option === 'overdue') return due < todayStart && !item.completed;
          if (option === 'today') return due.toDateString() === now.toDateString();
          if (option === 'this_week') return isSameWeek(due, now, { weekStartsOn: 1 });
          if (option === 'this_month')
            return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
          return false;
        });
      });
    }

    // 14. Start Date filter
    if (filters.start_date.length > 0) {
      result = result.filter((item) => {
        if (!item.startDate) return filters.start_date.includes('no_date');
        const start = new Date(item.startDate);
        return filters.start_date.some((option) => {
          if (option === 'today') return start.toDateString() === now.toDateString();
          if (option === 'this_week') return isSameWeek(start, now, { weekStartsOn: 1 });
          if (option === 'this_month')
            return (
              start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()
            );
          return false;
        });
      });
    }

    // 15. Created At filter
    if (filters.created_at.length > 0) {
      result = result.filter((item) => {
        if (!item.createdAt) return false;
        const created = new Date(item.createdAt);
        return filters.created_at.some((option) => {
          const lower = option.toLowerCase();
          if (lower === 'today') return created.toDateString() === now.toDateString();
          if (lower === 'this_week') return isSameWeek(created, now, { weekStartsOn: 1 });
          if (lower === 'this_month')
            return (
              created.getFullYear() === now.getFullYear() &&
              created.getMonth() === now.getMonth()
            );
          if (lower === 'this_year') return created.getFullYear() === now.getFullYear();
          return false;
        });
      });
    }

    // 16. Updated At filter
    if (filters.updated_at.length > 0) {
      result = result.filter((item) => {
        if (!item.updatedAt) return false;
        const updated = new Date(item.updatedAt);
        return filters.updated_at.some((option) => {
          const lower = option.toLowerCase();
          if (lower === 'today') return updated.toDateString() === now.toDateString();
          if (lower === 'this_week') return isSameWeek(updated, now, { weekStartsOn: 1 });
          if (lower === 'this_month')
            return (
              updated.getFullYear() === now.getFullYear() &&
              updated.getMonth() === now.getMonth()
            );
          if (lower === 'this_year') return updated.getFullYear() === now.getFullYear();
          return false;
        });
      });
    }

    // 17. Subscribers filter
    if (filters.subscribers && filters.subscribers.length > 0) {
      const hasMe = filters.subscribers.includes('__me__');
      const specificIds = filters.subscribers.filter((id) => id !== '__me__');
      result = result.filter((item) => {
        const subs: string[] = Array.isArray((item as any).subscriberIds)
          ? (item as any).subscriberIds
          : [];
        if (hasMe) {
          // 'me' = current user — handled by ID match if user ID is in list
        }
        return specificIds.some((id) => subs.includes(id));
      });
    }

    // 17. Ordering (Sorting)
    const direction = displayOptions.orderDirection === 'desc' ? -1 : 1;
    result = [...result].sort((first, second) => {
      if (displayOptions.orderBy === 'priority') {
        const weightA = PRIORITY_WEIGHT[first.priority || 'none'] ?? 0;
        const weightB = PRIORITY_WEIGHT[second.priority || 'none'] ?? 0;
        return (weightA - weightB) * direction;
      }
      if (displayOptions.orderBy === 'dueDate') {
        if (!first.dueDate && !second.dueDate) return 0;
        if (!first.dueDate) return 1;
        if (!second.dueDate) return -1;
        return (new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime()) * direction;
      }
      if (displayOptions.orderBy === 'startDate') {
        if (!first.startDate && !second.startDate) return 0;
        if (!first.startDate) return 1;
        if (!second.startDate) return -1;
        return (new Date(first.startDate).getTime() - new Date(second.startDate).getTime()) * direction;
      }
      if (displayOptions.orderBy === 'createdAt') {
        const timeA = first.createdAt ? new Date(first.createdAt).getTime() : 0;
        const timeB = second.createdAt ? new Date(second.createdAt).getTime() : 0;
        return (timeA - timeB) * direction;
      }
      if (displayOptions.orderBy === 'updatedAt') {
        const timeA = first.updatedAt ? new Date(first.updatedAt).getTime() : 0;
        const timeB = second.updatedAt ? new Date(second.updatedAt).getTime() : 0;
        return (timeA - timeB) * direction;
      }
      if (displayOptions.orderBy === 'title') {
        const titleA = (first.title || '').toLowerCase();
        const titleB = (second.title || '').toLowerCase();
        return titleA.localeCompare(titleB, 'vi', { sensitivity: 'base' }) * direction;
      }
      return ((first.rank ?? 0) - (second.rank ?? 0)) * direction;
    });

    return result;
  }, [items, filters, columns, assignees, displayOptions]);

  // ── Projects & Cycles Search ──────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return (projects as Project[]).filter((project) =>
      (project?.name || '').toLowerCase().includes((projSearch || '').toLowerCase()),
    );
  }, [projects, projSearch]);

  const filteredCycles = useMemo(() => {
    if (!Array.isArray(cycles)) return [];
    return cycles.filter((cycle: Cycle) =>
      (cycle?.name || '').toLowerCase().includes((cycleSearch || '').toLowerCase()),
    );
  }, [cycles, cycleSearch]);

  const activeCols = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    return columns.filter((column) => filters.state.includes(resolveStateId(column)));
  }, [columns, filters.state]);

  const activeUsers = useMemo(() => {
    if (!Array.isArray(assignees)) return [];
    return assignees.filter((assignee) => filters.assignees.includes(assignee.id));
  }, [assignees, filters.assignees]);

  // Total active filter counts across all 16 criteria
  const totalFilters = useMemo(() => {
    return (
      filters.state.length +
      filters.state_group.length +
      filters.priority.length +
      filters.assignees.length +
      filters.mentions.length +
      filters.created_by.length +
      filters.labels.length +
      filters.cycle.length +
      filters.attach.length +
      (filters.work_items?.length ?? 0) +
      filters.parent.length +
      filters.due_date.length +
      filters.start_date.length +
      filters.created_at.length +
      filters.updated_at.length +
      (filters.subscribers?.length ?? 0)
    );
  }, [filters]);

  // ── Filter Mutation Actions ───────────────────────────────────────────────
  const toggleFilterItem = useCallback(
    <K extends keyof Filters>(key: K, item: any) => {
      setFilters((prev) => {
        const arr = (prev[key] as any[]) || [];
        const exists = arr.includes(item);
        const nextArr = exists ? arr.filter((itemElement) => itemElement !== item) : [...arr, item];
        const next = { ...prev, [key]: nextArr };

        if (key === 'state' && propOnColFilterChange) propOnColFilterChange(nextArr);
        if (key === 'assignees' && propOnUserFilterChange) propOnUserFilterChange(nextArr);

        return next;
      });
    },
    [propOnColFilterChange, propOnUserFilterChange],
  );

  const removeFilterItem = useCallback(
    <K extends keyof Filters>(key: K, item?: any) => {
      setFilters((prev) => {
        if (item === undefined) {
          const next = { ...prev, [key]: [] };
          if (key === 'state' && propOnColFilterChange) propOnColFilterChange([]);
          if (key === 'assignees' && propOnUserFilterChange) propOnUserFilterChange([]);
          return next;
        }
        const arr = (prev[key] as any[]) || [];
        const nextArr = arr.filter((itemElement) => itemElement !== item);
        const next = { ...prev, [key]: nextArr };
        if (key === 'state' && propOnColFilterChange) propOnColFilterChange(nextArr);
        if (key === 'assignees' && propOnUserFilterChange) propOnUserFilterChange(nextArr);
        return next;
      });
    },
    [propOnColFilterChange, propOnUserFilterChange],
  );

  const clearAllFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    if (propOnColFilterChange) propOnColFilterChange([]);
    if (propOnUserFilterChange) propOnUserFilterChange([]);
  }, [propOnColFilterChange, propOnUserFilterChange]);

  const setCols = useCallback(
    (newCols: string[]) => {
      setFilters((prev) => ({ ...prev, state: newCols }));
      if (propOnColFilterChange) propOnColFilterChange(newCols);
    },
    [propOnColFilterChange],
  );

  const setUsers = useCallback(
    (newUsers: string[]) => {
      setFilters((prev) => ({ ...prev, assignees: newUsers }));
      if (propOnUserFilterChange) propOnUserFilterChange(newUsers);
    },
    [propOnUserFilterChange],
  );

  const toggleCol = useCallback(
    (id: string) => {
      toggleFilterItem('state', id);
    },
    [toggleFilterItem],
  );

  const toggleUser = useCallback(
    (id: string) => {
      toggleFilterItem('assignees', id);
    },
    [toggleFilterItem],
  );

  const togglePriority = useCallback(
    (priority: Priority) => {
      toggleFilterItem('priority', priority);
    },
    [toggleFilterItem],
  );

  const removeColumnFilter = useCallback(
    (id: string) => {
      removeFilterItem('state', id);
    },
    [removeFilterItem],
  );

  const removeAssigneeFilter = useCallback(
    (id: string) => {
      removeFilterItem('assignees', id);
    },
    [removeFilterItem],
  );

  const removePriorityFilter = useCallback(
    (priority: Priority) => {
      removeFilterItem('priority', priority);
    },
    [removeFilterItem],
  );

  const setDueDateFilter = useCallback((option: DueDateFilterOption) => {
    setFilters((prev) => ({
      ...prev,
      due_date: option === 'all' ? [] : [option],
    }));
  }, []);

  const removeDueDateFilter = useCallback(() => {
    removeFilterItem('due_date');
  }, [removeFilterItem]);

  const selectProject = useCallback(
    (project: Project) => {
      if (project.id === projectId) return;
      router.push(`/projects/${project.id}/work-items`);
    },
    [projectId, router],
  );

  const selectCycle = useCallback(
    (selectedCycleId: string) => {
      router.push(`/projects/${projectId}/cycles/${selectedCycleId}`);
      setCycleSearch('');
    },
    [router, projectId],
  );

  const state = {
    viewMode: mode,
    filters,
    selectedColumnIds: filters.state,
    selectedAssigneeIds: filters.assignees,
    selectedPriorities: filters.priority,
    dueDateFilter: (filters.due_date[0] as DueDateFilterOption) || 'all',
    items: filteredItems,
    filteredItems,
    assignees,
    activeColumns: activeCols,
    activeAssignees: activeUsers,
    totalActiveFilters: totalFilters,
    hasActiveFilters: totalFilters > 0,
    projectSearch: projSearch,
    cycleSearch,
    filterOpen,
    displayOpen,
    analyticsOpen,
    displayOptions,
    filteredProjects,
    filteredCycles,
    currentModule: 'work-items',
    workspaceId,
    projectId,
    cycleId,
    savedViews,
    activeViewId,
  };

  const actions = {
    setViewMode: setMode,
    // Universal Filter Engine Actions
    setFilters,
    toggleFilterItem,
    removeFilterItem,
    clearAllFilters,
    // Legacy Compatible Actions
    setColumnFilter: setCols,
    setAssigneeFilter: setUsers,
    setSelectedColumnIds: setCols,
    setSelectedAssigneeIds: setUsers,
    toggleColumnFilter: toggleCol,
    toggleAssigneeFilter: toggleUser,
    togglePriorityFilter: togglePriority,
    setDueDateFilter,
    removeColumnFilter,
    removeAssigneeFilter,
    removePriorityFilter,
    removeDueDateFilter,
    setFilterOpen,
    setDisplayOpen,
    setAnalyticsOpen,
    setDisplayOptions,
    updateDisplayProperty,
    setProjectSearch: setProjSearch,
    setCycleSearch,
    handleProjectClick: selectProject,
    handleCycleSelect: selectCycle,
    selectSavedView,
    saveCurrentView: saveCurrentViewMutation.mutateAsync,
    isSavingCurrentView: saveCurrentViewMutation.isPending,
  };

  return { state, actions };
}
