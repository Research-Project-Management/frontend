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
  OrderByOption,
  OrderDirection,
} from '../types/work-item.types';
import {
  DEFAULT_DISPLAY_OPTIONS,
  DEFAULT_FILTERS,
  STATE_GROUPS,
} from '../types/work-item.types';
import { useProjects } from '@/features/projects/shell/hooks/use-project';
import { ItemHelpers, resolveStateId, inferStateGroup } from '../utils/work-item.utils';
import { WorkItemFilterEngine } from '../utils/work-item-filter-engine';

export type ViewMode = 'board' | 'list' | 'calendar' | 'table' | 'timeline' | 'split';

const ITEMS_VIEW_STORAGE_KEY = 'flux:work-items-view-mode';
const DISPLAY_OPTIONS_STORAGE_KEY = 'flux:work-item-display-options';
const VALID_MODES: ViewMode[] = ['board', 'list', 'calendar', 'table', 'timeline', 'split'];

const getDisplayOptionsStorageKey = (projId?: string, currentMode?: ViewMode) => {
  const modeKey = currentMode || 'board';
  return projId
    ? `flux:work-item-display-options:${projId}:${modeKey}`
    : `${DISPLAY_OPTIONS_STORAGE_KEY}:${modeKey}`;
};

const getInitialDisplayOptions = (projId?: string, targetMode: ViewMode = 'board'): DisplayOptions => {
  const defaultGb: GroupByOption = (targetMode === 'table' || targetMode === 'timeline') ? 'none' : 'state';
  if (typeof window !== 'undefined') {
    try {
      const modeKey = getDisplayOptionsStorageKey(projId, targetMode);
      const saved = localStorage.getItem(modeKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, any>;
        const rawGb = parsed.groupBy;
        const rawSubGb = parsed.subGroupBy;
        const groupBy = rawGb && rawGb !== 'null' ? (rawGb as GroupByOption) : defaultGb;
        let subGroupBy = rawSubGb && rawSubGb !== 'null' ? (rawSubGb as SubGroupByOption) : 'none';
        if (subGroupBy === groupBy) subGroupBy = 'none';
        return {
          ...DEFAULT_DISPLAY_OPTIONS,
          ...parsed,
          groupBy,
          subGroupBy,
        };
      }
      // Fallback check legacy key if exists
      const legacyKey = projId ? `flux:work-item-display-options:${projId}` : DISPLAY_OPTIONS_STORAGE_KEY;
      const legacySaved = localStorage.getItem(legacyKey);
      if (legacySaved) {
        const parsed = JSON.parse(legacySaved) as Record<string, any>;
        const groupBy = (targetMode === 'table' || targetMode === 'timeline') ? 'none' : ((parsed.groupBy && parsed.groupBy !== 'null' ? parsed.groupBy : defaultGb) as GroupByOption);
        return {
          ...DEFAULT_DISPLAY_OPTIONS,
          ...parsed,
          groupBy,
        };
      }
    } catch {}
  }
  return {
    ...DEFAULT_DISPLAY_OPTIONS,
    groupBy: defaultGb,
  };
};

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

  // ── View Mode State (SSR-safe initial default to prevent hydration mismatch) ──
  const [mode, setModeState] = useState<ViewMode>('board');

  const setMode = useCallback((newMode: ViewMode) => {
    setModeState(newMode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ITEMS_VIEW_STORAGE_KEY, newMode);
      } catch {}
    }
    // Switch display options to the target mode's layout preferences
    const modeOptions = getInitialDisplayOptions(projectId, newMode);
    setDisplayOptionsState(modeOptions);
    if (projectId) {
      updateProperties({ preferences: { viewMode: newMode } });
    }
  }, [projectId, updateProperties]);

  // Client-side hydration sync for saved view mode & display options
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(ITEMS_VIEW_STORAGE_KEY) as ViewMode;
        const targetMode = saved && VALID_MODES.includes(saved) ? saved : 'board';
        if (targetMode !== 'board') {
          setModeState(targetMode);
        }
        const modeOptions = getInitialDisplayOptions(projectId, targetMode);
        setDisplayOptionsState(modeOptions);
      } catch {}
    }
  }, [projectId]);

  // Sync userProperties into mode and display options on initial load
  useEffect(() => {
    if (userProperties) {
      const prefs = userProperties.preferences as Record<string, unknown> | undefined;
      const savedMode = prefs?.viewMode as ViewMode | undefined;
      if (savedMode && VALID_MODES.includes(savedMode)) {
        setModeState((prev) => (prev !== savedMode ? savedMode : prev));
      }
      const beDisplayProps = userProperties.displayProperties as Record<string, boolean> | undefined;
      const beDisplayFilters = userProperties.displayFilters as Record<string, unknown> | undefined;

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

        setDisplayOptionsState((prev: DisplayOptions): DisplayOptions => {
          const defaultGb: GroupByOption = ((savedMode || mode) === 'table' || (savedMode || mode) === 'timeline') ? 'none' : 'state';
          const nextGroupBy = ((rawGroupBy && rawGroupBy !== 'null' && rawGroupBy !== '')
            ? (rawGroupBy === 'state' && ((savedMode || mode) === 'table' || (savedMode || mode) === 'timeline') ? 'none' : rawGroupBy)
            : (prev.groupBy || defaultGb)) as GroupByOption;
          let nextSubGroupBy = ((rawSubGroupBy && rawSubGroupBy !== 'null' && rawSubGroupBy !== '') ? rawSubGroupBy : (prev.subGroupBy || 'none')) as SubGroupByOption;
          if (nextSubGroupBy === nextGroupBy) {
            nextSubGroupBy = 'none';
          }
          return {
            ...prev,
            ...(beDisplayProps ? { properties: { ...prev.properties, ...beDisplayProps } } : {}),
            groupBy: nextGroupBy,
            subGroupBy: nextSubGroupBy,
            ...(rawOrderBy ? { orderBy: rawOrderBy as OrderByOption } : {}),
            ...(rawOrderDirection ? { orderDirection: rawOrderDirection as OrderDirection } : {}),
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
  const storageKey = useMemo(() => getDisplayOptionsStorageKey(projectId, mode), [projectId, mode]);

  const [displayOptions, setDisplayOptionsState] = useState<DisplayOptions>(() => ({
    ...DEFAULT_DISPLAY_OPTIONS,
    groupBy: 'state',
  }));

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
        displayProperties: properties as Record<string, unknown>,
        displayFilters: {
          ...displayFilters,
          group_by: displayFilters.groupBy,
          sub_group_by: displayFilters.subGroupBy,
          order_by: displayFilters.orderBy,
          order_direction: displayFilters.orderDirection,
          show_empty_groups: displayFilters.showEmptyGroups,
          show_child_work_items: displayFilters.showChildWorkItems,
        } as Record<string, unknown>,
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
        properties: nextProps as unknown as DisplayOptions['properties'],
      };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {}
      }
      if (projectId) {
        updateProperties({ displayProperties: next.properties as Record<string, unknown> });
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
        ...(view.filters as Record<string, unknown>),
      }));
    }
    if (view.displayProperties) {
      setDisplayOptionsState((prev) => ({
        ...prev,
        properties: {
          ...prev.properties,
          ...(view.displayProperties as Record<string, unknown>),
        },
      }));
    }
  }, []);

  const saveCurrentViewMutation = useMutation({
    mutationFn: (name: string) =>
      ViewService.createView(projectId, {
        name,
        layout: mode === 'split' ? 'board' : mode,
        filters: filters as Record<string, unknown>,
        displayProperties: displayOptions.properties as Record<string, unknown>,
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
        const m = member as { id?: string; userId?: string; name?: string; avatar?: string; user?: { id?: string; name?: string; avatar?: string } };
        const id = m.userId || m.user?.id || m.id;
        if (!id) continue;
        const name = m.name || m.user?.name || 'Member';
        const avatar = m.avatar || m.user?.avatar || undefined;
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

  // ── High-Performance Inverted Index & Bitset Filtering Engine ────────────
  const filterEngine = useMemo(() => {
    const rawItems = Array.isArray(items) ? items : [];
    return new WorkItemFilterEngine(rawItems, columns);
  }, [items, columns]);

  const filteredItems = useMemo(() => {
    const rawItems = Array.isArray(items) ? items : [];
    if (rawItems.length === 0) return [];

    let result = filterEngine.executeFilter(filters, '');

    // Mentions filter (post-filter on filtered candidates)
    if (filters.mentions && filters.mentions.length > 0) {
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
  }, [filterEngine, items, filters, assignees, displayOptions]);

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
    <K extends keyof Filters>(key: K, item: Filters[K] extends (infer E)[] ? E : string) => {
      setFilters((prev) => {
        const arr = ((prev[key] as unknown as typeof item[]) ?? []);
        const exists = arr.includes(item);
        const nextArr = exists ? arr.filter((itemElement) => itemElement !== item) : [...arr, item];
        const next = { ...prev, [key]: nextArr };

        if (key === 'state' && propOnColFilterChange) propOnColFilterChange(nextArr as string[]);
        if (key === 'assignees' && propOnUserFilterChange) propOnUserFilterChange(nextArr as string[]);

        return next;
      });
    },
    [propOnColFilterChange, propOnUserFilterChange],
  );

  const removeFilterItem = useCallback(
    <K extends keyof Filters>(key: K, item?: Filters[K] extends (infer E)[] ? E : string) => {
      setFilters((prev) => {
        if (item === undefined) {
          const next = { ...prev, [key]: [] };
          if (key === 'state' && propOnColFilterChange) propOnColFilterChange([]);
          if (key === 'assignees' && propOnUserFilterChange) propOnUserFilterChange([]);
          return next;
        }
        const arr = ((prev[key] as unknown as typeof item[]) ?? []);
        const nextArr = arr.filter((itemElement) => itemElement !== item);
        const next = { ...prev, [key]: nextArr };
        if (key === 'state' && propOnColFilterChange) propOnColFilterChange(nextArr as string[]);
        if (key === 'assignees' && propOnUserFilterChange) propOnUserFilterChange(nextArr as string[]);
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

  const state = useMemo(
    () => ({
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
      projectId,
      savedViews,
      activeViewId,
    }),
    [
      mode,
      filters,
      filteredItems,
      assignees,
      activeCols,
      activeUsers,
      totalFilters,
      projSearch,
      filterOpen,
      displayOpen,
      analyticsOpen,
      displayOptions,
      filteredProjects,
      projectId,
      savedViews,
      activeViewId,
    ]
  );

  const actions = useMemo(
    () => ({
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
    }),
    [
      setMode,
      setFilters,
      toggleFilterItem,
      removeFilterItem,
      clearAllFilters,
      setCols,
      setUsers,
      toggleCol,
      toggleUser,
      togglePriority,
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
      setProjSearch,
      selectProject,
      selectSavedView,
      saveCurrentViewMutation.mutateAsync,
      saveCurrentViewMutation.isPending,
    ],
  );

  return { state, actions };
}
