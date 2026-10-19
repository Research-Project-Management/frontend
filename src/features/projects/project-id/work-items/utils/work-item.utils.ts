import type {
  Column,
  State,
  StateGroup,
  Item,
} from "@/features/projects/project-id/work-items/types/work-item.types";
import {
  STATE_GROUPS,
  DEFAULT_STATES,
} from "@/features/projects/project-id/work-items/types/work-item.types";
import { parseDateOnly } from "./cpm-graph";

// ── 1. Column & State Resolvers ──────────────────────────────────────────────

export function resolveColumnId(column?: Pick<Column, "id"> | null): string {
  return column?.id ?? "";
}

export function resolveColumnColor(
  columnId?: string | Partial<Column> | Partial<State> | null,
  accentColor?: string
): string {
  if (!columnId) return accentColor || "#6B7280";
  if (typeof columnId === "object") {
    const colObj = columnId as Record<string, unknown>;
    const colColor =
      (typeof colObj.color === "string" ? colObj.color : undefined) ||
      (typeof colObj.accentColor === "string" ? colObj.accentColor : undefined);
    return colColor || accentColor || "#6B7280";
  }
  return accentColor || "#6B7280";
}

export function resolveItemId(target?: { id?: string; itemId?: string; workItemId?: string } | null): string {
  if (!target) return "";
  return target.id ?? target.workItemId ?? target.itemId ?? "";
}
export const resolveWorkItemId = resolveItemId;

export function resolveStateId(state?: Pick<State, "id"> | null): string {
  return state?.id ?? "";
}

export const resolveStateColor = resolveColumnColor;

export function resolveStateTitle(state?: Partial<State> | null): string {
  if (!state) return "";
  return state.name || state.title || state.id || "";
}

export function inferStateGroup(
  id?: string | null,
  name?: string | null,
  existingGroup?: string | null
): StateGroup {
  if (
    existingGroup &&
    (STATE_GROUPS as readonly string[]).includes(existingGroup)
  ) {
    return existingGroup as StateGroup;
  }
  if (id && (STATE_GROUPS as readonly string[]).includes(id)) {
    return id as StateGroup;
  }
  const combined = `${id || ""} ${name || ""}`.toLowerCase().trim();
  if (combined.includes("backlog")) return "backlog";
  if (
    combined.includes("done") ||
    combined.includes("completed") ||
    combined.includes("complete") ||
    combined.includes("closed") ||
    combined.includes("resolved")
  ) {
    return "completed";
  }
  if (
    combined.includes("cancel") ||
    combined.includes("rejected") ||
    combined.includes("abandon") ||
    combined.includes("wontfix") ||
    combined.includes("won't fix")
  ) {
    return "cancelled";
  }
  if (
    combined.includes("doing") ||
    combined.includes("progress") ||
    combined.includes("started") ||
    combined.includes("review") ||
    combined.includes("testing") ||
    combined.includes("qa") ||
    combined.includes("dev")
  ) {
    return "started";
  }
  return "unstarted";
}

export function normalizeStates(raw: unknown): Column[] {
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_STATES];
  }
  const result: Column[] = raw.map((item, index) => {
    const rawObj =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {};
    const rawId =
      typeof rawObj.id === "string" && rawObj.id.trim()
        ? rawObj.id.trim()
        : `state-${index + 1}`;
    const rawName =
      typeof rawObj.name === "string" && rawObj.name.trim()
        ? rawObj.name.trim()
        : typeof rawObj.title === "string" && rawObj.title.trim()
          ? rawObj.title.trim()
          : rawId;
    const group: StateGroup =
      typeof rawObj.group === "string" &&
      (STATE_GROUPS as readonly string[]).includes(rawObj.group)
        ? (rawObj.group as StateGroup)
        : inferStateGroup(rawId, rawName);
    const groupColorMap: Record<StateGroup, string> = {
      backlog: "#6B7280",
      unstarted: "#94A3B8",
      started: "#D97706",
      completed: "#1A7F37",
      cancelled: "#9CA3AF",
    };
    const rawCustom =
      (typeof rawObj.color === "string" && rawObj.color.trim() ? rawObj.color.trim() : undefined) ||
      (typeof rawObj.accentColor === "string" && rawObj.accentColor.trim() ? rawObj.accentColor.trim() : undefined);
    const color = rawCustom || groupColorMap[group] || "#6B7280";
    return {
      id: rawId,
      name: rawName,
      title: rawName,
      slug: (rawObj.slug as string) || rawId,
      group,
      color,
      accentColor: color,
      sequence:
        typeof rawObj.sequence === "number" && !isNaN(rawObj.sequence)
          ? rawObj.sequence
          : (index + 1) * 1000,
      isDefault: Boolean(rawObj.isDefault),
      description:
        typeof rawObj.description === "string" ? rawObj.description : undefined,
    };
  });

  // Ensure default state uniqueness
  const defaultCount = result.filter((s) => s.isDefault).length;
  if (defaultCount === 0) {
    const preferred =
      result.find((s) => s.group === "backlog") ||
      result.find((s) => s.group === "unstarted") ||
      result[0];
    if (preferred) preferred.isDefault = true;
  } else if (defaultCount > 1) {
    let foundFirst = false;
    for (const s of result) {
      if (s.isDefault) {
        if (!foundFirst) foundFirst = true;
        else s.isDefault = false;
      }
    }
  }

  return result.sort((a, b) => a.sequence - b.sequence);
}
export const normalizeWorkItemStates = normalizeStates;

// ── 2. Pure Domain Helper Functions ──────────────────────────────────────────

export const WorkItemHelpers = {
  getInitials: (name?: string): string => {
    if (!name?.trim()) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() || "U";
    return `${parts[0]?.[0] || ""}${parts[parts.length - 1]?.[0] || ""}`.toUpperCase();
  },

  formatActivityTime: (dateStr?: string): string => {
    if (!dateStr) return "Just now";
    const targetDate = new Date(dateStr);
    if (Number.isNaN(targetDate.getTime())) return "Just now";
    const diff = Math.floor((Date.now() - targetDate.getTime()) / 1000);
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const day = targetDate.getDate();
    const month = targetDate.toLocaleDateString("en-US", { month: "short" });
    const year = targetDate.getFullYear();
    const currentYear = new Date().getFullYear();
    if (year === currentYear) {
      return `${month} ${day}`;
    }
    return `${month} ${day}, ${year}`;
  },

  formatDate: (val?: string | null | Date): string => {
    if (!val) return "";
    let targetDate: Date | null = null;
    if (val instanceof Date) {
      targetDate = val;
    } else if (typeof val === "string") {
      targetDate = parseDateOnly(val) || new Date(val);
    }
    if (!targetDate || Number.isNaN(targetDate.getTime())) return "";
    const day = String(targetDate.getDate()).padStart(2, "0");
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const year = targetDate.getFullYear();
    const currentYear = new Date().getFullYear();
    if (year === currentYear) {
      return `${day}/${month}`;
    }
    return `${day}/${month}/${year}`;
  },

  toBranchSlug: (title?: string | null, identifier?: string | null): string => {
    let clean = (title || 'task').trim();
    if (identifier) {
      const escapedId = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      clean = clean.replace(new RegExp(`^\\[?${escapedId}\\]?\\s*[:-]?\\s*`, 'i'), '');
    }
    return (
      clean
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'task'
    );
  },

  formatGitBranch: (item: { title?: string | null; identifier?: string | null }): string => {
    const slug = WorkItemHelpers.toBranchSlug(item.title, item.identifier);
    return item.identifier ? `${item.identifier.toLowerCase()}-${slug}` : `feature/${slug}`;
  },

  resolveIdentifier: (
    item?: { identifier?: string | null; sequenceNumber?: number | null; id?: string | null } | null,
    fallbackPrefix = 'FLUX'
  ): string => {
    if (!item) return '';
    if (item.identifier?.trim()) return item.identifier.trim();
    const prefix = (fallbackPrefix || 'FLUX').toUpperCase();
    if (typeof item.sequenceNumber === 'number' && !isNaN(item.sequenceNumber)) {
      return `${prefix}-${item.sequenceNumber}`;
    }
    if (item.id?.trim()) {
      return `${prefix}-${item.id.trim().slice(0, 4).toUpperCase()}`;
    }
    return '';
  },

  formatDateRange: (
    startDate?: string | null | Date,
    dueDate?: string | null | Date
  ): string => {
    // If only start date is present, do not display; only display when due date exists
    if (!dueDate) return "";

    const formattedDue = WorkItemHelpers.formatDate(dueDate);
    if (!formattedDue) return "";

    // If no start date: display only due date
    if (!startDate) return formattedDue;

    const formattedStart = WorkItemHelpers.formatDate(startDate);
    // If both start and due date exist and differ: combine into range
    if (formattedStart && formattedStart !== formattedDue) {
      return `${formattedStart} - ${formattedDue}`;
    }

    return formattedDue;
  },

  checkOverdue: (val?: string | null): boolean => {
    if (!val) return false;
    const targetDate = new Date(val);
    if (Number.isNaN(targetDate.getTime())) return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return targetDate.getTime() < now.getTime();
  },

  uniqueLabels: (list?: (string | { id?: string; name?: string; color?: string; [key: string]: unknown })[]): string[] => {
    if (!list) return [];
    return Array.from(
      new Set(
        list
          .map((item) => (typeof item === 'string' ? item : (item.id || item.name || '')))
          .filter(Boolean),
      ),
    );
  },

  countAttachments: (attachments: unknown): number => {
    if (!attachments) return 0;
    if (Array.isArray(attachments)) return attachments.length;
    if (typeof attachments === "object") {
      const att = attachments as Record<string, unknown>;
      const pages = Array.isArray(att.pages) ? att.pages.length : 0;
      const papers = Array.isArray(att.papers) ? att.papers.length : 0;
      const files = Array.isArray(att.files) ? att.files.length : 0;
      const links = Array.isArray(att.links) ? att.links.length : 0;
      return pages + papers + files + links;
    }
    return 0;
  },

  resolveAssignee: (
    item: { assignee?: { id?: string; name?: string | null; avatar?: string | null } | null; assigneeId?: string | { id?: string; name?: string | null; avatar?: string | null } | null } | null | undefined
  ): { id: string; name?: string | null; avatar?: string | null } | null => {
    if (!item) return null;
    if (item.assignee && typeof item.assignee === "object" && typeof item.assignee.id === 'string') {
      return { id: item.assignee.id, name: item.assignee.name, avatar: item.assignee.avatar };
    }
    if (typeof item.assigneeId === "object" && item.assigneeId !== null && typeof item.assigneeId.id === 'string') {
      return { id: item.assigneeId.id, name: item.assigneeId.name, avatar: item.assigneeId.avatar };
    }
    return null;
  },

  resolveAssignees: (
    item: {
      assignee?: { id?: string; name?: string | null; avatar?: string | null } | null;
      assigneeId?: string | { id?: string; name?: string | null; avatar?: string | null } | null;
      assignees?: Array<{ id?: string; userId?: string; name?: string | null; avatar?: string | null }>;
      assigneeIds?: string[];
    } | null | undefined,
    members: Array<{ id?: string; userId?: string; name?: string | null; avatar?: string | null; user?: { id?: string; name?: string | null; avatar?: string | null } }> = []
  ): Array<{ id: string; name?: string | null; avatar?: string | null }> => {
    if (!item) return [];

    const memberMap = new Map<string, { id: string; name?: string | null; avatar?: string | null }>();
    for (const m of members) {
      const uId = m.userId || (m.user && m.user.id) || m.id;
      if (uId) {
        memberMap.set(uId, {
          id: uId,
          name: m.name || (m.user && m.user.name) || "Member",
          avatar: m.avatar || (m.user && m.user.avatar) || null,
        });
      }
    }

    const result: Array<{ id: string; name?: string | null; avatar?: string | null }> = [];
    const seenIds = new Set<string>();

    if (Array.isArray(item.assignees) && item.assignees.length > 0) {
      for (const a of item.assignees) {
        const aId = a?.id || a?.userId;
        if (aId && !seenIds.has(aId)) {
          seenIds.add(aId);
          result.push({
            id: aId,
            name: a.name || memberMap.get(aId)?.name || "Member",
            avatar: a.avatar || memberMap.get(aId)?.avatar || null,
          });
        }
      }
    }

    if (Array.isArray(item.assigneeIds) && item.assigneeIds.length > 0) {
      for (const id of item.assigneeIds) {
        if (typeof id === "string" && id && !seenIds.has(id)) {
          seenIds.add(id);
          const found = memberMap.get(id);
          result.push({
            id,
            name: found?.name || "Member",
            avatar: found?.avatar || null,
          });
        }
      }
    }

    const primary = WorkItemHelpers.resolveAssignee(item);
    if (primary && !seenIds.has(primary.id)) {
      seenIds.add(primary.id);
      result.unshift(primary);
    }

    return result;
  },

  resolveAssigneeId: (
    item: {
      assignee?: { id?: string } | null;
      assigneeId?: string | { id?: string } | null;
      assigneeIds?: string[];
      assignees?: Array<{ id?: string; userId?: string } | string>;
    } | null | undefined
  ): string | undefined => {
    if (!item) return undefined;
    if (typeof item.assigneeId === "string" && item.assigneeId) {
      return item.assigneeId;
    }
    if (item.assignee && typeof item.assignee === "object" && typeof item.assignee.id === 'string') {
      return item.assignee.id;
    }
    if (typeof item.assigneeId === "object" && item.assigneeId !== null && typeof item.assigneeId.id === 'string') {
      return item.assigneeId.id;
    }
    if (Array.isArray(item.assigneeIds) && item.assigneeIds.length > 0 && typeof item.assigneeIds[0] === 'string') {
      return item.assigneeIds[0];
    }
    if (Array.isArray(item.assignees) && item.assignees.length > 0) {
      const first = item.assignees[0];
      if (typeof first === 'string' && first) return first;
      if (first && typeof first === 'object') {
        const uId = first.id || first.userId;
        if (typeof uId === 'string' && uId) return uId;
      }
    }
    return undefined;
  },

  createSnapshot: (data: Record<string, unknown>): string =>
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
      timeSpent: data.timeSpent,
    }),

  calculateProgressRollup: (
    subItems: Array<{
      completed?: boolean;
      columnId?: string;
      stateGroup?: string;
      state?: { group?: string } | null;
    }> = []
  ): number => {
    if (!Array.isArray(subItems) || subItems.length === 0) return 0;
    let completed = 0;
    for (const sub of subItems) {
      if (
        sub.completed ||
        sub.stateGroup === "completed" ||
        sub.state?.group === "completed" ||
        sub.columnId === "done" ||
        sub.columnId === "completed"
      ) {
        completed++;
      }
    }
    return Math.round((completed / subItems.length) * 100);
  },

  isDueSoon: (dueDate?: string | null, daysThreshold = 3): boolean => {
    if (!dueDate) return false;
    const targetDate = new Date(dueDate);
    if (Number.isNaN(targetDate.getTime())) return false;
    const now = new Date();
    const diffDays = (targetDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= daysThreshold;
  },

  resolveItemMeta: (
    item: Item,
    columns: Column[] = [],
    projectStates?: Column[],
    fallbackColumn?: Column
  ) => {
    const stateList = projectStates && projectStates.length > 0 ? projectStates : columns;
    const resolvedState =
      item.state && typeof item.state === "object"
        ? {
            id: item.state.id,
            title: item.state.name,
            name: item.state.name,
            group: item.state.group,
            color: item.state.color,
            accentColor: item.state.color,
            slug: item.state.name,
          }
        : stateList.find((c) => resolveColumnId(c) === item.columnId) || fallbackColumn || stateList[0];

    const colTitle = resolvedState?.title || resolvedState?.name || "Backlog";
    const currentColor = resolvedState?.color || resolvedState?.accentColor || "#6B7280";
    const stateGroup = resolvedState?.group || item.stateGroup || item.state?.group || colTitle;
    const isCancelled = Boolean(
      stateGroup === "cancelled" || item.columnId === "cancelled" || item.columnId === "cancel"
    );
    const isCompleted = Boolean(
      item.completed ||
        stateGroup === "completed" ||
        item.columnId === "done" ||
        item.columnId === "completed"
    );

    const rawItem = item as Item & {
      linkCount?: number;
      links?: unknown[];
      attachmentCount?: number;
      attach?: {
        links?: unknown[];
        pages?: Array<{ id: string; title?: string }>;
        papers?: Array<{ id: string; title?: string }>;
        files?: Array<{ id: string; name?: string; title?: string }>;
      };
    };

    const linksCount =
      typeof rawItem.linkCount === "number"
        ? rawItem.linkCount
        : Array.isArray(rawItem.links)
          ? rawItem.links.length
          : (() => {
              const attachObj = item.attachments || rawItem.attach;
              if (
                attachObj &&
                typeof attachObj === "object" &&
                "links" in attachObj &&
                Array.isArray(attachObj.links)
              ) {
                return attachObj.links.length;
              }
              return 0;
            })();

    const attachmentsCount =
      typeof rawItem.attachmentCount === "number"
        ? rawItem.attachmentCount
        : WorkItemHelpers.countAttachments(item.attachments || rawItem.attach);

    return {
      resolvedState,
      colTitle,
      currentColor,
      stateGroup,
      isCancelled,
      isCompleted,
      linksCount,
      attachmentsCount,
    };
  },
};

export const ItemHelpers = WorkItemHelpers;

export const getInitials = WorkItemHelpers.getInitials;
export const formatActivityTime = WorkItemHelpers.formatActivityTime;
export const formatDate = WorkItemHelpers.formatDate;
export const formatDateRange = WorkItemHelpers.formatDateRange;
export const checkOverdue = WorkItemHelpers.checkOverdue;
export const uniqueLabels = WorkItemHelpers.uniqueLabels;
export const countAttachments = WorkItemHelpers.countAttachments;
export const resolveAssignee = WorkItemHelpers.resolveAssignee;
export const resolveAssignees = WorkItemHelpers.resolveAssignees;
export const resolveAssigneeId = WorkItemHelpers.resolveAssigneeId;
export const createSnapshot = WorkItemHelpers.createSnapshot;
export const calculateProgressRollup = WorkItemHelpers.calculateProgressRollup;
export const isDueSoon = WorkItemHelpers.isDueSoon;
export const resolveItemMeta = WorkItemHelpers.resolveItemMeta;
export const toBranchSlug = WorkItemHelpers.toBranchSlug;
export const formatGitBranch = WorkItemHelpers.formatGitBranch;
export const resolveIdentifier = WorkItemHelpers.resolveIdentifier;
export { DEFAULT_STATES, PRIORITY_THEME_COLORS, GROUP_DEFAULT_COLORS } from '@/features/projects/project-id/work-items/types/work-item.types';

export const EMPTY_ARRAY: never[] = [];

export interface WorkItemTreeRow {
  item: Item;
  isSubItem: boolean;
  hasChildren: boolean;
  isChildrenExpanded: boolean;
  depth?: number;
}

export function buildWorkItemTree(
  sortedList: Item[],
  options?: {
    showChildWorkItems?: boolean;
    collapsedParentIds?: Set<string>;
    expandedIds?: Set<string>;
  }
): WorkItemTreeRow[] {
  if (!Array.isArray(sortedList) || sortedList.length === 0) return [];

  const showChildWorkItems = options?.showChildWorkItems ?? true;
  const collapsedParentIds = options?.collapsedParentIds;
  const expandedIds = options?.expandedIds;

  // Deduplicate items by id while preserving order
  const uniqueList: Item[] = [];
  const itemMap = new Map<string, Item>();
  for (const it of sortedList) {
    if (!it || !it.id || itemMap.has(it.id)) continue;
    itemMap.set(it.id, it);
    uniqueList.push(it);
  }

  if (!showChildWorkItems) {
    return uniqueList
      .filter((item) => {
        const pId = item.parentId || item.parentItemId || item.parentWorkItemId;
        return !pId || pId === item.id;
      })
      .map((item) => ({
        item,
        isSubItem: false,
        hasChildren: false,
        isChildrenExpanded: true,
        depth: 0,
      }));
  }

  const childrenByParentId = new Map<string, Item[]>();
  const rootItems: Item[] = [];

  for (const it of uniqueList) {
    const pId = it.parentId || it.parentItemId || it.parentWorkItemId;
    // Self-parenting (pId === it.id) or orphaned parent (!itemMap.has(pId)) promotes to root
    if (pId && pId !== it.id && itemMap.has(pId)) {
      const arr = childrenByParentId.get(pId) || [];
      arr.push(it);
      childrenByParentId.set(pId, arr);
    } else {
      rootItems.push(it);
    }
  }

  const result: WorkItemTreeRow[] = [];
  const visited = new Set<string>();

  const markSubtreeVisited = (parentId: string) => {
    const kids = childrenByParentId.get(parentId) || [];
    for (const k of kids) {
      if (!visited.has(k.id)) {
        visited.add(k.id);
        markSubtreeVisited(k.id);
      }
    }
  };

  const appendItemAndChildren = (it: Item, depth: number) => {
    if (visited.has(it.id)) return;
    visited.add(it.id);

    const children = (childrenByParentId.get(it.id) || []).filter((c) => !visited.has(c.id));
    const hasChildren = (childrenByParentId.get(it.id)?.length ?? 0) > 0;
    const isChildrenExpanded = expandedIds
      ? expandedIds.has(it.id)
      : !collapsedParentIds?.has(it.id);

    result.push({
      item: it,
      isSubItem: depth > 0,
      hasChildren,
      isChildrenExpanded,
      depth,
    });

    if (hasChildren) {
      if (isChildrenExpanded) {
        children.forEach((child) => appendItemAndChildren(child, depth + 1));
      } else {
        // Mark collapsed descendants as visited so they are not erroneously promoted to root
        markSubtreeVisited(it.id);
      }
    }
  };

  rootItems.forEach((root) => appendItemAndChildren(root, 0));

  // Break any remaining isolated circular parent-child loops (e.g. A -> B -> A) by promoting unvisited cycle entry points
  for (const it of uniqueList) {
    if (!visited.has(it.id)) {
      appendItemAndChildren(it, 0);
    }
  }

  return result;
}

export function buildGroupMoveUpdates(
  groupBy: string | undefined,
  targetBucketId: string,
  laneData?: { subGroupBy?: string; laneId?: string }
): Partial<Item> | null {
  if (groupBy === 'none') {
    return null;
  }

  const updates: Partial<Item> = {};

  if (groupBy === 'priority') {
    updates.priority = (targetBucketId === 'none' ? 'none' : targetBucketId) as Item['priority'];
  } else if (groupBy === 'assignee') {
    updates.assigneeId = targetBucketId === '__unassigned__' ? null : targetBucketId;
  } else if (groupBy === 'labels') {
    updates.labels = targetBucketId === '__no_label__' ? [] : [targetBucketId];
  } else {
    updates.columnId = targetBucketId;
  }

  if (laneData?.subGroupBy && laneData?.laneId && laneData.subGroupBy !== groupBy) {
    const laneUpdates = buildGroupMoveUpdates(laneData.subGroupBy, laneData.laneId);
    if (laneUpdates) {
      Object.assign(updates, laneUpdates);
    }
  }

  return updates;
}

export function getItemBucketKey(item: Item, groupBy?: string): string {
  const itemRecord = item as Record<string, unknown>;
  if (!groupBy || groupBy === 'state') {
    const stateObj = item.state && typeof item.state === 'object' ? item.state : null;
    const legacyState = typeof itemRecord.state === 'string' ? itemRecord.state : undefined;
    return (
      item.columnId ||
      (typeof itemRecord.stateId === 'string' ? itemRecord.stateId : undefined) ||
      stateObj?.id ||
      legacyState ||
      ''
    );
  }
  if (groupBy === 'none') {
    return '__all__';
  }
  if (groupBy === 'priority') {
    return (item.priority || 'none').toLowerCase();
  }
  if (groupBy === 'assignee') {
    return ItemHelpers.resolveAssigneeId(item) || '__unassigned__';
  }
  if (groupBy === 'labels') {
    const itemLabels = Array.isArray(item.labels) ? item.labels : [];
    if (itemLabels.length === 0) return '__no_label__';
    const first = itemLabels[0];
    const firstLabel =
      typeof first === 'object' && first !== null
        ? (first as { id?: string; name?: string }).id ||
          (first as { id?: string; name?: string }).name
        : String(first ?? '');
    return firstLabel || '__no_label__';
  }
  if (groupBy === 'createdBy') {
    const authorId =
      item.authorId ||
      (typeof itemRecord.createdBy === 'string' ? itemRecord.createdBy : undefined) ||
      (typeof itemRecord.author === 'object' && itemRecord.author !== null && 'id' in itemRecord.author
        ? (itemRecord.author as { id?: string }).id
        : undefined);
    return authorId || '__unknown__';
  }
  return item.columnId || (typeof itemRecord.stateId === 'string' ? itemRecord.stateId : '');
}

