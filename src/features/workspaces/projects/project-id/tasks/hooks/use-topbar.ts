'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import type { Task, Column, Project, Cycle } from '../types/task.types';
import { resolveTaskColumnId } from '../types/task.types';
import { useTaskWorkspaceProjects } from './use-task';

export type ViewMode = 'board' | 'list' | 'calendar';

export type AssigneeFilterOption = {
  id: string;
  name: string;
  avatar?: string;
};

export interface UseTopbarOptions {
  tasks?: Task[];
  columns?: Column[];
  selectedColumnIds?: string[];
  onColumnFilterChange?: (colIds: string[]) => void;
  assignees?: AssigneeFilterOption[];
  selectedAssigneeIds?: string[];
  onAssigneeFilterChange?: (userIds: string[]) => void;
  cycleId?: string;
  cycles?: Cycle[];
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function useTopbar({
  tasks = [],
  columns = [],
  selectedColumnIds: propColIds,
  onColumnFilterChange: propOnColFilterChange,
  assignees: propUsers,
  selectedAssigneeIds: propUserIds,
  onAssigneeFilterChange: propOnUserFilterChange,
  cycleId,
  cycles = [],
  searchQuery: propSearchQuery,
  onSearchChange: propOnSearchChange,
}: UseTopbarOptions = {}) {
  const { workspaceId, projectId } = useParams() as { workspaceId: string; projectId: string };
  const router = useRouter();
  const pathname = usePathname();
  const { data: projects = [] } = useTaskWorkspaceProjects(workspaceId);

  const [mode, setMode] = useState<ViewMode>('board');
  const [colIds, setColIds] = useState<string[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [internalSearch, setInternalSearch] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [projSearch, setProjSearch] = useState('');
  const [cycleSearch, setCycleSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const searchQuery = propSearchQuery ?? internalSearch;
  const selCols = propColIds ?? colIds;
  const selUsers = propUserIds ?? userIds;

  const moduleName = useMemo(() => {
    const parts = pathname.split('/');
    const idx = parts.findIndex((s) => s === 'projects');
    return idx !== -1 && parts.length > idx + 2 ? parts[idx + 2] : 'tasks';
  }, [pathname]);

  const assignees = useMemo<AssigneeFilterOption[]>(() => {
    if (propUsers?.length) return propUsers;
    const map = new Map<string, AssigneeFilterOption>();
    let hasUnassigned = false;

    if (Array.isArray(tasks)) {
      for (const t of tasks) {
        if (!t) continue;
        if (t.assigneeId?.id) {
          map.set(t.assigneeId.id, {
            id: t.assigneeId.id,
            name: t.assigneeId.name || 'Unknown',
            avatar: t.assigneeId.avatar,
          });
        } else {
          hasUnassigned = true;
        }
      }
    }

    const list = Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    if (hasUnassigned) list.push({ id: '__unassigned__', name: 'Unassigned' });
    return list;
  }, [tasks, propUsers]);

  const filteredTasks = useMemo(() => {
    let result = Array.isArray(tasks) ? tasks : [];

    // Search query filter
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          (t?.title || '').toLowerCase().includes(q) ||
          (t?.description || '').toLowerCase().includes(q) ||
          (t?.content || '').toLowerCase().includes(q),
      );
    }

    const safeCols = Array.isArray(selCols) ? selCols : [];
    const safeUsers = Array.isArray(selUsers) ? selUsers : [];

    // Column and assignee filters
    if (!safeCols.length && !safeUsers.length) return result;

    return result.filter((t: any) => {
      if (safeCols.length && !safeCols.includes(t?.columnId)) return false;
      if (safeUsers.length) {
        const uId = t?.assigneeId?.id ?? '__unassigned__';
        if (!safeUsers.includes(uId)) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, selCols, selUsers]);

  const filteredProjects = useMemo(() => {
    if (!Array.isArray(projects)) return [];
    return projects.filter((p: Project) => (p?.name || '').toLowerCase().includes((projSearch || '').toLowerCase()));
  }, [projects, projSearch]);

  const filteredCycles = useMemo(() => {
    if (!Array.isArray(cycles)) return [];
    return cycles.filter((c: Cycle) => (c?.name || '').toLowerCase().includes((cycleSearch || '').toLowerCase()));
  }, [cycles, cycleSearch]);

  const activeCols = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    const safeCols = Array.isArray(selCols) ? selCols : [];
    return columns.filter((c) => safeCols.includes(resolveTaskColumnId(c)));
  }, [columns, selCols]);

  const activeUsers = useMemo(() => {
    if (!Array.isArray(assignees)) return [];
    const safeUsers = Array.isArray(selUsers) ? selUsers : [];
    return assignees.filter((a) => safeUsers.includes(a.id));
  }, [assignees, selUsers]);

  const totalFilters = (Array.isArray(selCols) ? selCols.length : 0) + (Array.isArray(selUsers) ? selUsers.length : 0);

  const handleSearchChange = useCallback(
    (query: string) => {
      if (propOnSearchChange) propOnSearchChange(query);
      else setInternalSearch(query);
    },
    [propOnSearchChange],
  );

  const handleClearSearch = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      handleSearchChange('');
      setIsSearchExpanded(false);
    },
    [handleSearchChange],
  );

  const expandSearch = useCallback(() => {
    setIsSearchExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const collapseSearch = useCallback(
    (currentQuery?: string) => {
      const q = currentQuery ?? searchQuery;
      if (!q.trim()) {
        setIsSearchExpanded(false);
      }
    },
    [searchQuery],
  );

  const setCols = useCallback(
    (newCols: string[]) => {
      if (propOnColFilterChange) propOnColFilterChange(newCols);
      else setColIds(newCols);
    },
    [propOnColFilterChange],
  );

  const setUsers = useCallback(
    (newUsers: string[]) => {
      if (propOnUserFilterChange) propOnUserFilterChange(newUsers);
      else setUserIds(newUsers);
    },
    [propOnUserFilterChange],
  );

  const toggleCol = useCallback(
    (id: string) => {
      setCols(selCols.includes(id) ? selCols.filter((c) => c !== id) : [...selCols, id]);
    },
    [selCols, setCols],
  );

  const toggleUser = useCallback(
    (id: string) => {
      setUsers(selUsers.includes(id) ? selUsers.filter((u) => u !== id) : [...selUsers, id]);
    },
    [selUsers, setUsers],
  );

  const clearFilters = useCallback(() => {
    setCols([]);
    setUsers([]);
  }, [setCols, setUsers]);

  const selectProject = useCallback(
    (p: Project) => {
      if (p.id === projectId) return;
      router.push(`/${workspaceId}/projects/${p.id}/${moduleName || 'tasks'}`);
    },
    [projectId, router, workspaceId, moduleName],
  );

  const selectCycle = useCallback(
    (cId: string) => {
      router.push(`/${workspaceId}/projects/${projectId}/cycles/${cId}`);
      setCycleSearch('');
    },
    [router, workspaceId, projectId],
  );

  const state = {
    viewMode: mode,
    searchQuery,
    isSearchExpanded,
    selectedColumnIds: selCols,
    selectedAssigneeIds: selUsers,
    items: filteredTasks,
    filteredTasks,
    assignees,
    activeColumns: activeCols,
    activeAssignees: activeUsers,
    totalActiveFilters: totalFilters,
    hasActiveFilters: totalFilters > 0,
    projectSearch: projSearch,
    cycleSearch,
    filterOpen,
    filteredProjects,
    filteredCycles,
    currentModule: moduleName,
    workspaceId,
    projectId,
    cycleId,
  };

  const actions = {
    setViewMode: setMode,
    setSearchQuery: handleSearchChange,
    expandSearch,
    collapseSearch,
    handleSearchChange,
    handleClearSearch,
    setColumnFilter: setCols,
    setAssigneeFilter: setUsers,
    setSelectedColumnIds: setCols,
    setSelectedAssigneeIds: setUsers,
    toggleColumnFilter: toggleCol,
    toggleAssigneeFilter: toggleUser,
    clearAllFilters: clearFilters,
    setFilterOpen,
    setProjectSearch: setProjSearch,
    setCycleSearch,
    handleProjectClick: selectProject,
    handleCycleSelect: selectCycle,
  };

  return { state, actions, inputRef };
}
