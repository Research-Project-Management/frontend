/**
 * work-item-filter-engine.ts
 *
 * Server-Driven Filter Query Serializer & Lightweight Optimistic Filter Predicate.
 *
 * Replaces the legacy 994-line in-browser 32-bit Uint32Array FastBitset + InvertedIndexStore
 * Shadow Backend with:
 * 1. `serializeFiltersToQuery`: Canonical serializer mapping UI `Filters` and `DisplayOptions`
 *    to backend `QueryWorkItemDto` query parameters (`GET /api/projects/:projectId/work-items`).
 * 2. `matchesWorkItemFilter`: Lightweight, stateless predicate for instant optimistic filtering
 *    on already-loaded work items without allocating bitsets or inverted index stores in RAM.
 */

import type {
  Item,
  Column,
  Filters,
  DisplayOptions,
} from '@/features/projects/project-id/work-items/types/work-item.types';
import type { FilterQuery } from '@/features/projects/project-id/work-items/types/work-item.types';
import { ItemHelpers, resolveStateId, inferStateGroup } from './work-item.utils';

export type { FilterQuery };

export const DUE_DATE_LABELS: Record<string, string> = {
  all: 'All',
  overdue: 'Overdue',
  today: 'Due today',
  this_week: 'Due this week',
  this_month: 'Due this month',
  '15_days': 'Due in 15 days',
  '30_days': 'Due in 30 days',
  no_date: 'No due date',
};

export const DUE_DATE_QUICK_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'this_week', label: 'Due this week' },
  { id: 'this_month', label: 'Due this month' },
  { id: '15_days', label: '15 days from now' },
  { id: '30_days', label: '30 days from now' },
  { id: 'no_date', label: 'No due date' },
];

const MENTION_BRACKET_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Serializes frontend `Filters` and `DisplayOptions` into backend `QueryWorkItemDto` query params.
 */
export function serializeFiltersToQuery(
  filters: Partial<Filters> = {},
  displayOptions?: Partial<DisplayOptions>,
): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {};

  if (filters.search?.trim()) {
    query.search = filters.search.trim();
  }

  const stateList = [
    ...(filters.state || []),
    ...(typeof filters.columnId === 'string'
      ? [filters.columnId]
      : Array.isArray(filters.columnId)
        ? filters.columnId
        : []),
  ].filter(Boolean);
  if (stateList.length > 0) {
    query.state = stateList;
  }

  if (filters.state_group && filters.state_group.length > 0) {
    query.stateGroup = filters.state_group;
  }

  if (filters.priority && filters.priority.length > 0) {
    query.priority = filters.priority;
  }

  const assigneeList = [
    ...(filters.assignees || []),
    ...(typeof filters.assigneeId === 'string'
      ? [filters.assigneeId]
      : Array.isArray(filters.assigneeId)
        ? filters.assigneeId
        : []),
  ].filter(Boolean);
  if (assigneeList.length > 0) {
    query.assignees = assigneeList;
  }

  if (filters.created_by && filters.created_by.length > 0) {
    query.createdById = filters.created_by;
  }

  if (filters.labels && filters.labels.length > 0) {
    query.labels = filters.labels;
  }

  if (filters.subscribers && filters.subscribers.length > 0) {
    query.subscribers = filters.subscribers;
  }

  if (filters.mentions && filters.mentions.length > 0) {
    query.mentions = filters.mentions;
  }

  const attachList = [...(filters.attach || [])];
  if (filters.hasAttachment === true && !attachList.includes('has:attach')) {
    attachList.push('has:attach');
  }
  if (attachList.length > 0) {
    query.attach = attachList;
  }

  const workItemIds = [
    ...(filters.work_items || []),
    ...(filters.items || []),
  ].filter(Boolean);
  if (workItemIds.length > 0) {
    query.workItems = workItemIds;
  }

  if (filters.parent && filters.parent.length > 0) {
    query.parent = filters.parent;
  }

  const dueDates = [...(filters.due_date || [])].filter((d) => d && d !== 'all');
  if (filters.dueDateRange && (filters.dueDateRange.from || filters.dueDateRange.to)) {
    dueDates.push(`${filters.dueDateRange.from || ''}..${filters.dueDateRange.to || ''}`);
  }
  if (dueDates.length > 0) {
    query.dueDate = dueDates;
  }

  if (filters.start_date && filters.start_date.length > 0) {
    query.startDate = filters.start_date;
  }

  if (filters.created_at && filters.created_at.length > 0) {
    query.createdAt = filters.created_at;
  }

  if (filters.updated_at && filters.updated_at.length > 0) {
    query.updatedAt = filters.updated_at;
  }

  if (displayOptions?.orderBy) {
    const resolvedOrderBy =
      displayOptions.orderBy === 'manual' ? 'rank' : displayOptions.orderBy;
    query.orderBy = resolvedOrderBy;
    query.sort = resolvedOrderBy;
  }
  if (displayOptions?.orderDirection) {
    query.orderDirection = displayOptions.orderDirection;
    query.order = displayOptions.orderDirection;
  }

  return query;
}

interface DateBoundaries {
  todayStart: number;
  todayEnd: number;
  weekStart: number;
  weekEnd: number;
  nextWeekStart: number;
  nextWeekEnd: number;
  monthStart: number;
  monthEnd: number;
  yearStart: number;
  yearEnd: number;
  in15DaysEnd: number;
  in30DaysEnd: number;
}

function getDateBoundaries(): DateBoundaries {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;
  const dayOfWeek = (now.getDay() + 6) % 7;
  const weekStart = todayStart - dayOfWeek * 24 * 60 * 60 * 1000;
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000 - 1;
  const nextWeekStart = weekEnd + 1;
  const nextWeekEnd = nextWeekStart + 7 * 24 * 60 * 60 * 1000 - 1;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const yearEnd = new Date(now.getFullYear() + 1, 0, 0, 23, 59, 59, 999).getTime();
  const in15DaysEnd = todayStart + 16 * 24 * 60 * 60 * 1000 - 1;
  const in30DaysEnd = todayStart + 31 * 24 * 60 * 60 * 1000 - 1;

  return {
    todayStart,
    todayEnd,
    weekStart,
    weekEnd,
    nextWeekStart,
    nextWeekEnd,
    monthStart,
    monthEnd,
    yearStart,
    yearEnd,
    in15DaysEnd,
    in30DaysEnd,
  };
}

function matchesDateFilterValues(
  dateVal: string | number | null | undefined,
  options: string[],
  bounds: DateBoundaries,
  isTerminalState = false,
  allowOverdue = false,
): boolean {
  const time = dateVal
    ? typeof dateVal === 'number'
      ? dateVal
      : Date.parse(String(dateVal))
    : NaN;
  const hasValidDate = !Number.isNaN(time);

  return options.some((rawOpt) => {
    const option = rawOpt.trim().toLowerCase();
    if (!option || option === 'all') return true;
    if (option === 'no_date' || option === 'none') return !dateVal;
    if (!hasValidDate) return false;

    if (allowOverdue && option === 'overdue') {
      return time < bounds.todayStart && !isTerminalState;
    }
    if (option === 'today') {
      return time >= bounds.todayStart && time <= bounds.todayEnd;
    }
    if (option === 'this_week') {
      return time >= bounds.weekStart && time <= bounds.weekEnd;
    }
    if (option === 'next_week') {
      return time >= bounds.nextWeekStart && time <= bounds.nextWeekEnd;
    }
    if (option === 'this_month') {
      return time >= bounds.monthStart && time <= bounds.monthEnd;
    }
    if (option === 'this_year') {
      return time >= bounds.yearStart && time <= bounds.yearEnd;
    }
    if (option === '15_days') {
      return time >= bounds.todayStart && time <= bounds.in15DaysEnd;
    }
    if (option === '30_days') {
      return time >= bounds.todayStart && time <= bounds.in30DaysEnd;
    }
    if (rawOpt.includes('..')) {
      const [fromStr, toStr] = rawOpt.split('..');
      const fromMs = fromStr ? Date.parse(fromStr) : -Infinity;
      const toMs = toStr ? Date.parse(toStr) + (toStr.length <= 10 ? 86399999 : 0) : Infinity;
      return time >= fromMs && time <= toMs;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(rawOpt)) {
      return String(dateVal).slice(0, 10) === rawOpt.slice(0, 10);
    }
    return false;
  });
}

export function tokenizeText(text?: string | null): string[] {
  if (!text) return [];
  let clean = text.toLowerCase();
  if (/[^\u0000-\u007F]/.test(clean)) {
    clean = clean.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return clean
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Stateless filter evaluation over an item array for responsive client view updates
 * while the backend remains the single source of truth.
 */
export function filterItems(
  items: Item[],
  filters: Partial<Filters> = {},
  searchQuery: string = '',
  columns: Column[] = [],
  assignees: Array<{ id: string; name?: string }> = [],
): Item[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const stateFilters = [
    ...(filters.state || []),
    ...(typeof filters.columnId === 'string'
      ? [filters.columnId]
      : Array.isArray(filters.columnId)
        ? filters.columnId
        : []),
  ].filter(Boolean);

  const assigneeFilters = [
    ...(filters.assignees || []),
    ...(typeof filters.assigneeId === 'string'
      ? [filters.assigneeId]
      : Array.isArray(filters.assigneeId)
        ? filters.assigneeId
        : []),
  ].filter(Boolean);

  const filtersRecord = filters as unknown as Record<string, string[] | undefined>;
  const activeWorkItemFilterIds = [
    ...(filters.work_items || []),
    ...(filtersRecord.sub_work_items || []),
    ...(filtersRecord.item || []),
    ...(filters.items || []),
  ].filter(Boolean);

  const effectiveSearch = (searchQuery || filters.search || '').trim();
  const searchTokens = effectiveSearch ? tokenizeText(effectiveSearch) : [];

  const hasAnyFilter =
    stateFilters.length > 0 ||
    (filters.state_group?.length ?? 0) > 0 ||
    (filters.priority?.length ?? 0) > 0 ||
    assigneeFilters.length > 0 ||
    (filters.created_by?.length ?? 0) > 0 ||
    (filters.labels?.length ?? 0) > 0 ||
    (filters.due_date && filters.due_date.length > 0 && !filters.due_date.includes('all')) ||
    Boolean(filters.dueDateRange?.from || filters.dueDateRange?.to) ||
    (filters.parent?.length ?? 0) > 0 ||
    (filters.attach?.length ?? 0) > 0 ||
    filters.hasAttachment === true ||
    activeWorkItemFilterIds.length > 0 ||
    (filters.start_date?.length ?? 0) > 0 ||
    (filters.created_at?.length ?? 0) > 0 ||
    (filters.updated_at?.length ?? 0) > 0 ||
    (filters.subscribers?.length ?? 0) > 0 ||
    (filters.mentions?.length ?? 0) > 0 ||
    searchTokens.length > 0;

  if (!hasAnyFilter) {
    return [...items];
  }

  const colGroupMap = new Map<string, string>();
  for (const col of columns) {
    const id = resolveStateId(col);
    if (id) {
      colGroupMap.set(id, col.group || inferStateGroup(id, col.title || col.name || ''));
    }
  }

  const assigneeNameById = new Map<string, string>();
  for (const a of assignees) {
    if (a.id && a.name) {
      assigneeNameById.set(a.id, a.name.toLowerCase());
    }
  }

  const bounds = getDateBoundaries();

  return items.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const rawItem = item as Record<string, unknown>;

    const stateObj = item.state && typeof item.state === 'object' ? item.state : null;
    const legacyStateStr = typeof rawItem.state === 'string' ? rawItem.state : undefined;
    const stateId =
      item.columnId ||
      (typeof rawItem.stateId === 'string' ? rawItem.stateId : undefined) ||
      stateObj?.id ||
      legacyStateStr ||
      '';
    const stateName = stateObj?.name || '';
    const resolvedGroup =
      item.stateGroup ||
      stateObj?.group ||
      (stateId ? colGroupMap.get(stateId) : undefined) ||
      (stateId || stateName ? inferStateGroup(stateId, stateName) : undefined);

    // 1. State
    if (stateFilters.length > 0) {
      const matchesState = stateFilters.some(
        (sf) => sf === stateId || sf === stateObj?.id || sf === stateName,
      );
      if (!matchesState) return false;
    }

    // 2. State Group
    if (filters.state_group && filters.state_group.length > 0) {
      if (!resolvedGroup || !filters.state_group.includes(resolvedGroup)) return false;
    }

    // 3. Priority
    if (filters.priority && filters.priority.length > 0) {
      const itemPriority = (item.priority || 'none').toLowerCase();
      if (!filters.priority.some((p) => String(p).toLowerCase() === itemPriority)) return false;
    }

    // 4. Assignees
    if (assigneeFilters.length > 0) {
      const itemAssigneeIds = new Set<string>();
      const primaryAssigneeId = ItemHelpers.resolveAssigneeId(item);
      if (primaryAssigneeId) itemAssigneeIds.add(primaryAssigneeId);
      if (Array.isArray(item.assigneeIds)) {
        for (const aId of item.assigneeIds) {
          if (typeof aId === 'string' && aId) itemAssigneeIds.add(aId);
        }
      }
      if (Array.isArray(item.assignees)) {
        for (const a of item.assignees) {
          if (typeof a === 'string' && a) itemAssigneeIds.add(a);
          else if (a && typeof a === 'object') {
            const uId = (a as { id?: string; userId?: string }).id || (a as { id?: string; userId?: string }).userId;
            if (typeof uId === 'string' && uId) itemAssigneeIds.add(uId);
          }
        }
      }
      const matchesAssignee = assigneeFilters.some((uid) => {
        if (uid === '__unassigned__' || uid === 'unassigned') return itemAssigneeIds.size === 0;
        return itemAssigneeIds.has(uid);
      });
      if (!matchesAssignee) return false;
    }

    // 5. Created By
    if (filters.created_by && filters.created_by.length > 0) {
      const author =
        item.authorId ||
        (typeof rawItem.createdBy === 'string' ? rawItem.createdBy : undefined) ||
        (item.author && typeof item.author === 'object' ? item.author.id : undefined);
      if (!author || !filters.created_by.includes(author)) return false;
    }

    // 6. Labels
    if (filters.labels && filters.labels.length > 0) {
      const itemLabels = new Set<string>();
      if (Array.isArray(item.labels)) {
        for (const l of item.labels) {
          if (typeof l === 'string' && l) itemLabels.add(l);
          else if (l && typeof l === 'object') {
            const lbl = l as { id?: string; name?: string };
            if (lbl.id) itemLabels.add(lbl.id);
            if (lbl.name) itemLabels.add(lbl.name);
          }
        }
      }
      if (Array.isArray(rawItem.labelIds)) {
        for (const lId of rawItem.labelIds) {
          if (typeof lId === 'string' && lId) itemLabels.add(lId);
        }
      }
      if (!filters.labels.some((l) => itemLabels.has(l))) return false;
    }

    // 7. Due Date
    const isTerminalState =
      Boolean(item.completed) ||
      resolvedGroup === 'completed' ||
      resolvedGroup === 'cancelled';

    if (filters.due_date && filters.due_date.length > 0 && !filters.due_date.includes('all')) {
      if (!matchesDateFilterValues(item.dueDate, filters.due_date, bounds, isTerminalState, true)) {
        return false;
      }
    }

    if (filters.dueDateRange && (filters.dueDateRange.from || filters.dueDateRange.to)) {
      const rangeOpt = `${filters.dueDateRange.from || ''}..${filters.dueDateRange.to || ''}`;
      if (!matchesDateFilterValues(item.dueDate, [rangeOpt], bounds, isTerminalState, false)) {
        return false;
      }
    }

    // 8. Parent
    if (filters.parent && filters.parent.length > 0) {
      const pId = item.parentWorkItemId || item.parentItemId || item.parentId;
      const matchesParent = filters.parent.some((p) => {
        if (p === '__none__' || p === 'parent:none') return !pId;
        if (p === '__has_parent__' || p === 'parent:any') return Boolean(pId);
        return pId === p;
      });
      if (!matchesParent) return false;
    }

    // 9. Attachments
    if ((filters.attach && filters.attach.length > 0) || filters.hasAttachment === true) {
      const attachments = item.attachments;
      let hasAny = false;
      let hasP = false;
      let hasPp = false;
      let hasF = false;
      let hasL = false;
      if (Array.isArray(attachments)) {
        hasF = attachments.length > 0;
        hasAny = hasF;
      } else if (attachments && typeof attachments === 'object') {
        const attObj = attachments as { pages?: unknown[]; papers?: unknown[]; files?: unknown[]; links?: unknown[] };
        hasP = Array.isArray(attObj.pages) && attObj.pages.length > 0;
        hasPp = Array.isArray(attObj.papers) && attObj.papers.length > 0;
        hasF = Array.isArray(attObj.files) && attObj.files.length > 0;
        hasL = Array.isArray(attObj.links) && attObj.links.length > 0;
        hasAny = hasP || hasPp || hasF || hasL;
      }
      if (filters.hasAttachment === true && !hasAny) return false;
      if (filters.attach && filters.attach.length > 0) {
        const matchesAttach = filters.attach.some((a) => {
          if (a === 'has:attach' || a === 'has_attachments') return hasAny;
          if (a === 'attach:pages' || a === 'pages') return hasP;
          if (a === 'attach:papers' || a === 'papers') return hasPp;
          if (a === 'attach:files' || a === 'files') return hasF;
          if (a === 'attach:links' || a === 'links') return hasL;
          return false;
        });
        if (!matchesAttach) return false;
      }
    }

    // 10. Work Items
    if (activeWorkItemFilterIds.length > 0) {
      const matchesWorkItem = activeWorkItemFilterIds.some(
        (id) => id === item.id || (item.identifier && id === item.identifier),
      );
      if (!matchesWorkItem) return false;
    }

    // 11. Start Date
    if (filters.start_date && filters.start_date.length > 0) {
      if (!matchesDateFilterValues(item.startDate, filters.start_date, bounds, false, false)) {
        return false;
      }
    }

    // 12. Created At
    if (filters.created_at && filters.created_at.length > 0) {
      if (!matchesDateFilterValues(item.createdAt, filters.created_at, bounds, false, false)) {
        return false;
      }
    }

    // 13. Updated At
    if (filters.updated_at && filters.updated_at.length > 0) {
      if (!matchesDateFilterValues(item.updatedAt, filters.updated_at, bounds, false, false)) {
        return false;
      }
    }

    // 14. Subscribers
    if (filters.subscribers && filters.subscribers.length > 0) {
      const subSet = new Set<string>();
      if (Array.isArray(item.subscriberIds)) {
        for (const subId of item.subscriberIds) {
          if (typeof subId === 'string' && subId) subSet.add(subId);
        }
      }
      if (Array.isArray(rawItem.subscribers)) {
        for (const sub of rawItem.subscribers) {
          if (typeof sub === 'string' && sub) subSet.add(sub);
          else if (sub && typeof sub === 'object') {
            const subId = (sub as { id?: string; userId?: string }).id || (sub as { id?: string; userId?: string }).userId;
            if (typeof subId === 'string' && subId) subSet.add(subId);
          }
        }
      }
      if (!filters.subscribers.some((s) => subSet.has(s))) return false;
    }

    // 15. Mentions (Single unified check — no double contradictory filtering)
    if (filters.mentions && filters.mentions.length > 0) {
      const mentionSet = new Set<string>();
      if (Array.isArray(rawItem.mentions)) {
        for (const m of rawItem.mentions) {
          if (typeof m === 'string' && m) mentionSet.add(m.toLowerCase());
          else if (m && typeof m === 'object' && typeof (m as { id?: string }).id === 'string') {
            mentionSet.add((m as { id: string }).id.toLowerCase());
          }
        }
      }
      const fullText = `${item.title || ''} ${item.description || ''} ${item.content || ''}`;
      if (fullText.includes('@')) {
        MENTION_BRACKET_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = MENTION_BRACKET_REGEX.exec(fullText)) !== null) {
          const mentionedName = match[1]?.trim().toLowerCase();
          const mentionedId = match[2]?.trim().toLowerCase();
          if (mentionedId) mentionSet.add(mentionedId);
          if (mentionedName) mentionSet.add(mentionedName);
        }
      }
      const lowerFullText = fullText.toLowerCase();
      const matchesMention = filters.mentions.some((target) => {
        const lowerTarget = target.toLowerCase();
        if (mentionSet.has(lowerTarget)) return true;
        if (lowerFullText.includes(`@${lowerTarget}`) || lowerFullText.includes(`(${lowerTarget})`)) {
          return true;
        }
        const resolvedName = assigneeNameById.get(target);
        if (resolvedName && lowerFullText.includes(`@${resolvedName}`)) {
          return true;
        }
        return false;
      });
      if (!matchesMention) return false;
    }

    // 16. Text Search
    if (searchTokens.length > 0) {
      const itemTokens = tokenizeText(
        `${item.title || ''} ${item.identifier || ''} ${
          item.sequenceNumber ? `flux-${item.sequenceNumber}` : ''
        }`,
      );
      const allTokensMatched = searchTokens.every((qToken) =>
        itemTokens.some((itToken) => itToken.startsWith(qToken)),
      );
      if (!allTokensMatched) return false;
    }

    return true;
  });
}
