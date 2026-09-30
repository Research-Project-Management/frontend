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
  Priority,
  StateGroup,
  DisplayOptions,
  DueDateFilterOption,
  DisplayPropertyKey,
  Filters,
  ProjectMember,
  GroupByOption,
  SubGroupByOption,
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
const getDisplayOptionsStorageKey = (projId?: string) =>
  projId ? `flux:work-item-display-options:${projId}` : DISPLAY_OPTIONS_STORAGE_KEY;
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
        const rawGroupBy = beDisplayFilters?.groupBy ?? beDisplayFilters?.group_by;
        const rawSubGroupBy = beDisplayFilters?.subGroupBy ?? beDisplayFilters?.sub_group_by;
        const rawOrderBy = beDisplayFilters?.orderBy ?? beDisplayFilters?.order_by;
        const rawOrderDirection = beDisplayFilters?.orderDirection ?? beDisplayFilters?.order_direction;
        const rawShowEmpty = beDisplayFilters?.showEmptyGroups ?? beDisplayFilters?.show_empty_groups;
        const rawShowChild = beDisplayFilters?.showChildWorkItems ?? beDisplayFilters?.show_child_work_items;

        setDisplayOptionsState((prev) => {
          const nextGroupBy = (rawGroupBy && rawGroupBy !== 'null' && rawGroupBy !== '') ? rawGroupBy : (prev.groupBy || 'state');
          let nextSubGroupBy = (rawSubGroupBy && rawSubGroupBy !== 'null' && rawSubGroupBy !== '') ? rawSubGroupBy : (prev.subGroupBy || 'none');
          if (nextSubGroupBy === nextGroupBy) {
            nextSubGroupBy = 'none';
          }
          return {
            ...prev,
            ...(beDisplayProps ? { properties: { ...prev.properties, ...beDisplayProps } } : {}),
            groupBy: nextGroupBy,
            subGroupBy: nextSubGroupBy,
            ...(rawOrderBy ? { orderBy: rawOrderBy } : {}),
            ...(rawOrderDirection ? { orderDirection: rawOrderDirection } : {}),
            ...(rawShowEmpty !== undefined ? { showEmptyGroups: Boolean(rawShowEmpty) } : {}),
            ...(rawShowChild !== undefined ? { showChildWorkItems: Boolean(rawShowChild) } : {}),
          };
        });
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
  const storageKey = useMemo(() => getDisplayOptionsStorageKey(projectId), [projectId]);

  const [displayOptions, setDisplayOptionsState] = useState<DisplayOptions>(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = getDisplayOptionsStorageKey(projectId);
        const saved = localStorage.getItem(key) || (projectId ? localStorage.getItem(DISPLAY_OPTIONS_STORAGE_KEY) : null);
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, any>;
          const rawGb = parsed.groupBy;
          const rawSubGb = parsed.subGroupBy;
          const groupBy = rawGb && rawGb !== 'null' ? (rawGb as GroupByOption) : 'state';
          let subGroupBy = rawSubGb && rawSubGb !== 'null' ? (rawSubGb as SubGroupByOption) : 'none';
          if (subGroupBy === groupBy) {
            subGroupBy = 'none';
          }
          return {
            ...DEFAULT_DISPLAY_OPTIONS,
            ...parsed,
            groupBy,
            subGroupBy,
          };
        }
      } catch {}
    }
    return DEFAULT_DISPLAY_OPTIONS;
  });

  const setDisplayOptions = useCallback((options: DisplayOptions) => {
    setDisplayOptionsState(options);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(options));
      } catch {}
    }
    if (projectId) {
      const { properties, ...displayFilters } = options;
      updateProperties({
        displayProperties: properties as any,
        displayFilters: {
          ...displayFilters,
          group_by: displayFilters.groupBy,
          sub_group_by: displayFilters.subGroupBy,
          order_by: displayFilters.orderBy,
          order_direction: displayFilters.orderDirection,
          show_empty_groups: displayFilters.showEmptyGroups,
          show_child_work_items: displayFilters.showChildWorkItems,
        } as any,
      });
    }
  }, [projectId, storageKey, updateProperties]);

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
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
      }
      if (projectId) {
        updateProperties({ displayProperties: next.properties as any });
      }
      return next;
    });
  }, [projectId, storageKey, updateProperties]);

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
      toast.success(`Saved view "${newView.name}"`, { id: 'work-item-view-action' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to save view', { id: 'work-item-view-action' });
    },
  });

  // ── Dropdown Search States ────────────────────────────────────────────────
  const [projSearch, setProjSearch] = useState('');

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
      (first.name || '').localeCompare(second.name || '', 'vi')
    );
    if (hasUnassigned || list.length > 0) list.push({ id: '__unassigned__', name: 'Unassigned' });
    return list;
  }, [items, propUsers, members]);

  // ── Optimized Single-Pass Filtering Engine ───────────────────────────────
  const filteredItems = useMemo(() => {
    const rawItems = Array.isArray(items) ? items : [];
    if (rawItems.length === 0) return [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Pre-computed Sets and Maps for O(1) lookups
    const hasStateFilter = filters.state.length > 0;
    const stateSet = new Set(filters.state);

    const hasStateGroupFilter = filters.state_group.length > 0;
    const stateGroupSet = new Set(filters.state_group);
    const columnGroupMap = new Map<string, string>();
    if (hasStateGroupFilter) {
      for (const col of columns) {
        const id = resolveStateId(col);
        if (id) {
          const group =
            col?.group && (STATE_GROUPS as readonly string[]).includes(col.group)
              ? col.group
              : inferStateGroup(id, col?.title || '');
          columnGroupMap.set(id, group);
        }
      }
    }

    const hasPriorityFilter = filters.priority.length > 0;
    const prioritySet = new Set(filters.priority);

    const hasAssigneeFilter = filters.assignees.length > 0;
    const hasUnassignedFilter =
      hasAssigneeFilter &&
      (filters.assignees.includes('__unassigned__') || filters.assignees.includes('unassigned'));
    const specificAssigneeSet = new Set(
      filters.assignees.filter((id) => id !== '__unassigned__' && id !== 'unassigned')
    );

    const hasMentionsFilter = filters.mentions.length > 0;

    const hasCreatedByFilter = filters.created_by.length > 0;
    const createdBySet = new Set(filters.created_by);

    const hasLabelsFilter = filters.labels.length > 0;
    const labelSet = new Set(filters.labels);

    const hasAttachFilter = filters.attach.length > 0;
    const attachSet = new Set(filters.attach);

    const activeWorkItemFilterIds = [
      ...(filters.work_items || []),
      ...((filters as any).sub_work_items || []),
      ...((filters as any).item || []),
      ...((filters as any).items || []),
    ];
    const hasWorkItemFilter = activeWorkItemFilterIds.length > 0;
    const workItemSet = new Set(activeWorkItemFilterIds);

    const hasParentFilter = filters.parent.length > 0;
    const hasNoParent =
      hasParentFilter &&
      (filters.parent.includes('__none__') || filters.parent.includes('parent:none'));
    const parentSet = new Set(
      filters.parent.filter((id) => id !== '__none__' && id !== 'parent:none')
    );

    const hasDueDateFilter = filters.due_date.length > 0;
    const hasStartDateFilter = filters.start_date.length > 0;
    const hasCreatedAtFilter = filters.created_at.length > 0;
    const hasUpdatedAtFilter = filters.updated_at.length > 0;

    const hasSubscribersFilter = Boolean(filters.subscribers && filters.subscribers.length > 0);
    const specificSubscriberSet = new Set(
      (filters.subscribers || []).filter((id) => id !== '__me__')
    );

    // Single-pass filter with O(1) checks and early short-circuiting
    const result = rawItems.filter((item) => {
      if (!item) return false;

      // 1. State (Column) filter
      if (hasStateFilter && (!item.columnId || !stateSet.has(item.columnId))) {
        return false;
      }

      // 2. State Group filter
      if (hasStateGroupFilter) {
        if (!item.columnId) return false;
        let group = columnGroupMap.get(item.columnId);
        if (!group) {
          const col = columns.find((c) => resolveStateId(c) === item.columnId);
          group =
            col?.group && (STATE_GROUPS as readonly string[]).includes(col.group)
              ? col.group
              : inferStateGroup(item.columnId, col?.title || '');
          columnGroupMap.set(item.columnId, group);
        }
        if (!stateGroupSet.has(group as StateGroup)) {
          return false;
        }
      }

      // 3. Priority filter
      if (hasPriorityFilter && !prioritySet.has(item.priority || 'none')) {
        return false;
      }

      // 4. Assignees filter
      if (hasAssigneeFilter) {
        const assigneeUserId = ItemHelpers.resolveAssigneeId(item);
        if (!assigneeUserId) {
          if (!hasUnassignedFilter) return false;
        } else if (!specificAssigneeSet.has(assigneeUserId)) {
          return false;
        }
      }

      // 5. Created by filter
      if (hasCreatedByFilter) {
        const author = item.authorId || (item as any).createdBy;
        if (!author || !createdBySet.has(author)) {
          return false;
        }
      }

      // 6. Labels filter
      if (hasLabelsFilter) {
        if (!Array.isArray(item.labels) || item.labels.length === 0) return false;
        const hasMatchingLabel = item.labels.some((labelItem: any) => {
          if (typeof labelItem === 'string') return labelSet.has(labelItem);
          if (typeof labelItem === 'object' && labelItem !== null) {
            return (
              (labelItem.id && labelSet.has(labelItem.id)) ||
              (labelItem.name && labelSet.has(labelItem.name))
            );
          }
          return false;
        });
        if (!hasMatchingLabel) return false;
      }

      // 7. Attachments filter
      if (hasAttachFilter) {
        const attachments = item.attachments;
        const hasPages = Array.isArray((attachments as any)?.pages) && (attachments as any).pages.length > 0;
        const hasPapers = Array.isArray((attachments as any)?.papers) && (attachments as any).papers.length > 0;
        const hasFiles =
          (Array.isArray((attachments as any)?.files) && (attachments as any).files.length > 0) ||
          (Array.isArray(attachments) && attachments.length > 0);
        const hasLinks = Array.isArray((attachments as any)?.links) && (attachments as any).links.length > 0;
        const hasAny = hasPages || hasPapers || hasFiles || hasLinks;

        let matchAttach = false;
        if (attachSet.has('has:attach') || attachSet.has('has_attachments')) matchAttach = matchAttach || hasAny;
        if (attachSet.has('attach:pages') || attachSet.has('pages')) matchAttach = matchAttach || hasPages;
        if (attachSet.has('attach:papers') || attachSet.has('papers')) matchAttach = matchAttach || hasPapers;
        if (attachSet.has('attach:files') || attachSet.has('files')) matchAttach = matchAttach || hasFiles;
        if (attachSet.has('attach:links') || attachSet.has('links')) matchAttach = matchAttach || hasLinks;
        if (!matchAttach) return false;
      }

      // 9. Work items filter
      if (hasWorkItemFilter) {
        const matchesId = workItemSet.has(item.id);
        const matchesIdentifier = item.identifier ? workItemSet.has(item.identifier) : false;
        if (!matchesId && !matchesIdentifier) return false;
      }

      // 10. Parent filter
      if (hasParentFilter) {
        const rawParent =
          (item as any).parentWorkItemId ||
          (item as any).parentItemId ||
          item.parentItem?.id ||
          item.parentWorkItem?.id;
        const parentId = typeof rawParent === 'object' ? rawParent?.id : rawParent;
        if (!parentId) {
          if (!hasNoParent) return false;
        } else if (!parentSet.has(parentId)) {
          return false;
        }
      }

      // 11. Due Date filter
      if (hasDueDateFilter) {
        if (!item.dueDate) {
          if (!filters.due_date.includes('no_date')) return false;
        } else {
          const due = new Date(item.dueDate);
          const matched = filters.due_date.some((option) => {
            if (option === 'all') return true;
            if (option === 'overdue') return due < todayStart && !item.completed;
            if (option === 'today') return due.toDateString() === now.toDateString();
            if (option === 'this_week') return isSameWeek(due, now, { weekStartsOn: 1 });
            if (option === 'this_month')
              return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
            return false;
          });
          if (!matched) return false;
        }
      }

      // 12. Start Date filter
      if (hasStartDateFilter) {
        if (!item.startDate) {
          if (!filters.start_date.includes('no_date')) return false;
        } else {
          const start = new Date(item.startDate);
          const matched = filters.start_date.some((option) => {
            if (option === 'today') return start.toDateString() === now.toDateString();
            if (option === 'this_week') return isSameWeek(start, now, { weekStartsOn: 1 });
            if (option === 'this_month')
              return (
                start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()
              );
            return false;
          });
          if (!matched) return false;
        }
      }

      // 13. Created At filter
      if (hasCreatedAtFilter) {
        if (!item.createdAt) return false;
        const created = new Date(item.createdAt);
        const matched = filters.created_at.some((option) => {
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
        if (!matched) return false;
      }

      // 14. Updated At filter
      if (hasUpdatedAtFilter) {
        if (!item.updatedAt) return false;
        const updated = new Date(item.updatedAt);
        const matched = filters.updated_at.some((option) => {
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
        if (!matched) return false;
      }

      // 15. Mentions filter
      if (hasMentionsFilter) {
        const text = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.toLowerCase();
        const matched = filters.mentions.some((userId) => {
          const user = assignees.find((assignee) => assignee.id === userId);
          if (user?.name && text.includes(`@${user.name.toLowerCase()}`)) return true;
          const assigneeUserId = ItemHelpers.resolveAssigneeId(item);
          return assigneeUserId === userId;
        });
        if (!matched) return false;
      }

      // 16. Subscribers filter
      if (hasSubscribersFilter) {
        const subs: string[] = Array.isArray((item as any).subscriberIds)
          ? (item as any).subscriberIds
          : [];
        const matched = subs.some((id) => specificSubscriberSet.has(id));
        if (!matched) return false;
      }

      return true;
    });

    // 17. Ordering (In-place sort on the single newly allocated filtered array)
    const direction = displayOptions.orderDirection === 'desc' ? -1 : 1;
    result.sort((first, second) => {
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

  // ── Projects Search ───────────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return (projects as Project[]).filter((project) =>
      (project?.name || '').toLowerCase().includes((projSearch || '').toLowerCase()),
    );
  }, [projects, projSearch]);

  const activeCols = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    return columns.filter((column) => filters.state.includes(resolveStateId(column)));
  }, [columns, filters.state]);

  const activeUsers = useMemo(() => {
    if (!Array.isArray(assignees)) return [];
    return assignees.filter((assignee) => filters.assignees.includes(assignee.id));
  }, [assignees, filters.assignees]);

  // Total active filter counts across all criteria
  const totalFilters = useMemo(() => {
    return (
      filters.state.length +
      filters.state_group.length +
      filters.priority.length +
      filters.assignees.length +
      filters.mentions.length +
      filters.created_by.length +
      filters.labels.length +
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
    filterOpen,
    displayOpen,
    analyticsOpen,
    displayOptions,
    filteredProjects,
    currentModule: 'work-items',
    workspaceId,
    projectId,
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
    handleProjectClick: selectProject,
    selectSavedView,
    saveCurrentView: saveCurrentViewMutation.mutateAsync,
    isSavingCurrentView: saveCurrentViewMutation.isPending,
  };

  return { state, actions };
}
