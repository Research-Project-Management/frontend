import type {
  Column,
  State,
  StateGroup,
  Item,
  ViewMode,
  DisplayOptions,
  Priority,
  GroupByOption,
  SubGroupByOption,
  Filters,
  TablePropertyKey,
  TablePropertyConfig,
} from "@/features/projects/project-id/work-items/types/work-item.types";
import {
  STATE_GROUPS,
  DEFAULT_STATES,
  DEFAULT_DISPLAY_OPTIONS,
} from "@/features/projects/project-id/work-items/types/work-item.types";
import {
  Users,
  Tag,
  Paperclip,
  CalendarClock,
  Calendar,
  User,
  Link2,
  Layers,
} from 'lucide-react';
import {
  StatusIcon,
  MediumPriorityBoxIcon,
} from '@/shared/components/icons';
import { parseDateOnly } from "./cpm-graph.utils";

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

export function resolveStateId(state?: Pick<State, "id"> | null): string {
  return state?.id ?? "";
}

export const resolveStateColor = resolveColumnColor;

export function resolveStateTitle(state?: Partial<State> | null): string {
  if (!state) return "";
  return state.name || state.title || state.id || "";
}

export const STATE_GROUP_KEYWORD_RULES: ReadonlyArray<{
  group: StateGroup;
  keywords: ReadonlyArray<string>;
}> = [
  { group: "backlog", keywords: ["backlog"] },
  {
    group: "completed",
    keywords: ["done", "completed", "complete", "closed", "resolved"],
  },
  {
    group: "cancelled",
    keywords: ["cancel", "rejected", "abandon", "wontfix", "won't fix"],
  },
  {
    group: "started",
    keywords: ["doing", "progress", "started", "review", "testing", "qa", "dev"],
  },
];

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
  for (const rule of STATE_GROUP_KEYWORD_RULES) {
    if (rule.keywords.some((kw) => combined.includes(kw))) {
      return rule.group;
    }
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
      cancelled: "#EF4444",
    };
    const rawCustom =
      (typeof rawObj.color === "string" && rawObj.color.trim() ? rawObj.color.trim() : undefined) ||
      (typeof rawObj.accentColor === "string" && rawObj.accentColor.trim() ? rawObj.accentColor.trim() : undefined);
    const isLegacyCancelledGray =
      group === "cancelled" &&
      rawCustom &&
      ["#9ca3af", "#6b7280", "#94a3b8", "#8a9093"].includes(rawCustom.toLowerCase());
    const color = (!isLegacyCancelledGray ? rawCustom : undefined) || groupColorMap[group] || "#6B7280";
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

// ── 2. Pure Domain Helper Functions ──────────────────────────────────────────

export const ItemHelpers = {
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
    const slug = ItemHelpers.toBranchSlug(item.title, item.identifier);
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

    const formattedDue = ItemHelpers.formatDate(dueDate);
    if (!formattedDue) return "";

    // If no start date: display only due date
    if (!startDate) return formattedDue;

    const formattedStart = ItemHelpers.formatDate(startDate);
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

    const primary = ItemHelpers.resolveAssignee(item);
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
      if (ItemHelpers.isCompleted(sub)) {
        completed++;
      }
    }
    return Math.round((completed / subItems.length) * 100);
  },

  resolveAuthorId: (
    item:
      | {
          authorId?: string | null;
          createdById?: string | null;
          author?: { id?: string | null } | string | null;
          createdBy?: { id?: string | null } | string | null;
        }
      | null
      | undefined
  ): string | undefined => {
    if (!item) return undefined;
    if (typeof item.authorId === "string" && item.authorId) return item.authorId;
    const raw = item as Record<string, unknown>;
    if (typeof raw.createdById === "string" && raw.createdById) return raw.createdById;
    if (typeof item.author === "string" && item.author) return item.author;
    if (item.author && typeof item.author === "object" && typeof item.author.id === "string" && item.author.id) {
      return item.author.id;
    }
    if (typeof item.createdBy === "string" && item.createdBy) return item.createdBy;
    if (
      item.createdBy &&
      typeof item.createdBy === "object" &&
      typeof item.createdBy.id === "string" &&
      item.createdBy.id
    ) {
      return item.createdBy.id;
    }
    return undefined;
  },

  resolveParentId: (
    item:
      | {
          parentId?: string | null;
          parentItemId?: string | null;
          parentWorkItemId?: string | null;
        }
      | null
      | undefined
  ): string | undefined => {
    if (!item) return undefined;
    return item.parentId || item.parentItemId || item.parentWorkItemId || undefined;
  },

  resolveStateGroup: (
    item:
      | {
          completed?: boolean;
          columnId?: string | null;
          stateId?: string | null;
          stateGroup?: string | null;
          state?: { id?: string; name?: string; group?: string } | string | null;
        }
      | null
      | undefined,
    columns: Column[] = []
  ): StateGroup => {
    if (!item) return "unstarted";
    const stateObj = item.state && typeof item.state === "object" ? item.state : null;
    const legacyState = typeof item.state === "string" ? item.state : undefined;
    const colId = item.columnId || item.stateId || stateObj?.id || legacyState || "";
    const matchedCol = columns.find((c) => resolveColumnId(c) === colId);
    const explicitGroup = matchedCol?.group || item.stateGroup || stateObj?.group;
    if (explicitGroup && (STATE_GROUPS as readonly string[]).includes(explicitGroup)) {
      return explicitGroup as StateGroup;
    }
    if (item.completed) return "completed";
    return inferStateGroup(colId, stateObj?.name || matchedCol?.name || matchedCol?.title || colId);
  },

  isCompleted: (
    item:
      | {
          completed?: boolean;
          columnId?: string | null;
          stateId?: string | null;
          stateGroup?: string | null;
          state?: { id?: string; name?: string; group?: string } | string | null;
        }
      | null
      | undefined,
    columns: Column[] = []
  ): boolean => {
    if (!item) return false;
    if (item.completed) return true;
    const group = ItemHelpers.resolveStateGroup(item, columns);
    return group === "completed";
  },

  isCancelled: (
    item:
      | {
          completed?: boolean;
          columnId?: string | null;
          stateId?: string | null;
          stateGroup?: string | null;
          state?: { id?: string; name?: string; group?: string } | string | null;
        }
      | null
      | undefined,
    columns: Column[] = []
  ): boolean => {
    if (!item) return false;
    const group = ItemHelpers.resolveStateGroup(item, columns);
    return group === "cancelled";
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
        : ItemHelpers.countAttachments(item.attachments || rawItem.attach);

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


export const getInitials = ItemHelpers.getInitials;
export const formatActivityTime = ItemHelpers.formatActivityTime;
export const formatDate = ItemHelpers.formatDate;
export const formatDateRange = ItemHelpers.formatDateRange;
export const checkOverdue = ItemHelpers.checkOverdue;
export const uniqueLabels = ItemHelpers.uniqueLabels;
export const countAttachments = ItemHelpers.countAttachments;
export const resolveAssignee = ItemHelpers.resolveAssignee;
export const resolveAssignees = ItemHelpers.resolveAssignees;
export const resolveAssigneeId = ItemHelpers.resolveAssigneeId;
export const createSnapshot = ItemHelpers.createSnapshot;
export const calculateProgressRollup = ItemHelpers.calculateProgressRollup;
export const isDueSoon = ItemHelpers.isDueSoon;
export const resolveItemMeta = ItemHelpers.resolveItemMeta;
export const toBranchSlug = ItemHelpers.toBranchSlug;
export const formatGitBranch = ItemHelpers.formatGitBranch;
export const resolveIdentifier = ItemHelpers.resolveIdentifier;
export { DEFAULT_STATES, PRIORITY_THEME_COLORS, GROUP_DEFAULT_COLORS } from '@/features/projects/project-id/work-items/types/work-item.types';

export const EMPTY_ARRAY: never[] = [];

export interface ItemTreeRow {
  item: Item;
  isSubItem: boolean;
  hasChildren: boolean;
  isChildrenExpanded: boolean;
  depth?: number;
}

export function buildItemTree(
  sortedList: Item[],
  options?: {
    showChildWorkItems?: boolean;
    collapsedParentIds?: Set<string>;
    expandedIds?: Set<string>;
  }
): ItemTreeRow[] {
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

  const result: ItemTreeRow[] = [];
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

export const MemberHelpers = {
  resolveUserId: (
    member:
      | {
          id?: string;
          userId?: string;
          user?: { id?: string } | null;
        }
      | null
      | undefined,
    fallback = ""
  ): string => {
    if (!member) return fallback;
    return member.userId || member.user?.id || member.id || fallback;
  },

  resolveDisplayName: (
    member:
      | {
          name?: string | null;
          user?: { name?: string | null } | null;
        }
      | null
      | undefined,
    fallback = "Member"
  ): string => {
    if (!member) return fallback;
    return member.name || member.user?.name || fallback;
  },

  resolveAvatar: (
    member:
      | {
          avatar?: string | null;
          user?: { avatar?: string | null } | null;
        }
      | null
      | undefined
  ): string | undefined => {
    if (!member) return undefined;
    return member.avatar || member.user?.avatar || undefined;
  },
};

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
    return ItemHelpers.resolveAuthorId(item) || '__unknown_author__';
  }
  return item.columnId || (typeof itemRecord.stateId === 'string' ? itemRecord.stateId : '');
}

/**
 * Unified comparator for sorting work items across Topbar, TableView, and ListView (OCP / DRY).
 */
export function compareItems(
  first: Item,
  second: Item,
  field?: string,
  direction: 'asc' | 'desc' = 'asc'
): number {
  const dir = direction === 'desc' ? -1 : 1;
  switch (field) {
    case 'priority': {
      const weightA = PRIORITY_WEIGHT[((first.priority || 'none').toLowerCase() as Priority)] ?? 0;
      const weightB = PRIORITY_WEIGHT[((second.priority || 'none').toLowerCase() as Priority)] ?? 0;
      return (weightA - weightB) * dir;
    }
    case 'dueDate': {
      if (!first.dueDate && !second.dueDate) return 0;
      if (!first.dueDate) return 1;
      if (!second.dueDate) return -1;
      return (new Date(first.dueDate).getTime() - new Date(second.dueDate).getTime()) * dir;
    }
    case 'startDate': {
      if (!first.startDate && !second.startDate) return 0;
      if (!first.startDate) return 1;
      if (!second.startDate) return -1;
      return (new Date(first.startDate).getTime() - new Date(second.startDate).getTime()) * dir;
    }
    case 'createdAt':
    case 'createdOn': {
      const timeA = first.createdAt ? new Date(first.createdAt).getTime() : 0;
      const timeB = second.createdAt ? new Date(second.createdAt).getTime() : 0;
      return (timeA - timeB) * dir;
    }
    case 'updatedAt':
    case 'updatedOn': {
      const timeA = first.updatedAt ? new Date(first.updatedAt).getTime() : 0;
      const timeB = second.updatedAt ? new Date(second.updatedAt).getTime() : 0;
      return (timeA - timeB) * dir;
    }
    case 'title': {
      const titleA = (first.title || '').toLowerCase();
      const titleB = (second.title || '').toLowerCase();
      return titleA.localeCompare(titleB, 'vi', { sensitivity: 'base' }) * dir;
    }
    case 'identifier': {
      const numA = first.sequenceNumber || 0;
      const numB = second.sequenceNumber || 0;
      return (numA - numB) * dir;
    }
    default:
      return ((first.rank ?? 0) - (second.rank ?? 0)) * dir;
  }
}

// ── 3. Topbar, Display & List Theme Constants ────────────────────────────────

export const PRIORITY_THEME_CLASSES: Record<string, string> = {
  urgent:
    'text-foreground bg-muted/40 border-border hover:bg-muted shadow-none font-normal',
  high:
    'text-foreground bg-muted/30 border-border hover:bg-muted shadow-none font-normal',
  medium:
    'text-foreground bg-muted/20 border-border hover:bg-muted shadow-none font-normal',
  low:
    'text-foreground bg-muted/10 border-border hover:bg-muted shadow-none font-normal',
  none:
    'text-foreground bg-transparent hover:bg-muted/50 border-border shadow-none font-normal',
};

export function formatDateDisplay(dateStr?: string | null): string {
  return ItemHelpers.formatDate(dateStr);
}


export function formatTableDate(dateStr?: string | null): string | null {
  return ItemHelpers.formatDate(dateStr) || null;
}

export function isDateOverdue(dateStr?: string | null, completed?: boolean): boolean {
  if (!dateStr || completed) return false;
  return ItemHelpers.checkOverdue(dateStr);
}

export const ITEMS_VIEW_STORAGE_KEY = 'flux:work-items-view-mode';
export const DISPLAY_OPTIONS_STORAGE_KEY = 'flux:work-item-display-options';
export const VALID_MODES: ViewMode[] = ['board', 'list', 'calendar', 'table', 'timeline', 'split'];

export const getDisplayOptionsStorageKey = (projId?: string, currentMode?: ViewMode) => {
  const modeKey = currentMode || 'board';
  return projId
    ? `flux:work-item-display-options:${projId}:${modeKey}`
    : `${DISPLAY_OPTIONS_STORAGE_KEY}:${modeKey}`;
};

export const getInitialDisplayOptions = (projId?: string, targetMode: ViewMode = 'board'): DisplayOptions => {
  const defaultGb: GroupByOption = (targetMode === 'table' || targetMode === 'timeline') ? 'none' : 'state';
  if (typeof window !== 'undefined') {
    try {
      const modeKey = getDisplayOptionsStorageKey(projId, targetMode);
      const saved = localStorage.getItem(modeKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, unknown>;
        const rawGb = typeof parsed.groupBy === 'string' ? parsed.groupBy : undefined;
        const rawSubGb = typeof parsed.subGroupBy === 'string' ? parsed.subGroupBy : undefined;
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
    } catch {}
  }
  return {
    ...DEFAULT_DISPLAY_OPTIONS,
    groupBy: defaultGb,
  };
};

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  none: 0,
};

export function countActiveFilters(filters: Filters): number {
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
}

// ── 4. Table View Constants ──────────────────────────────────────────────────

export const TABLE_STORAGE_KEY = 'flux:table_view:columns_v5';
export const TABLE_WIDTHS_STORAGE_KEY = 'flux:table_view:column_widths_v4';

export const TABLE_PROPERTIES: TablePropertyConfig[] = [
  { key: 'state', label: 'State', icon: StatusIcon, defaultVisible: true, minWidth: 140 },
  { key: 'priority', label: 'Priority', icon: MediumPriorityBoxIcon, defaultVisible: true, minWidth: 110 },
  { key: 'assignees', label: 'Assignees', icon: Users, defaultVisible: true, minWidth: 145 },
  { key: 'startDate', label: 'Start date', icon: CalendarClock, defaultVisible: false, minWidth: 135 },
  { key: 'dueDate', label: 'Due date', icon: Calendar, defaultVisible: true, minWidth: 135 },
  { key: 'labels', label: 'Labels', icon: Tag, defaultVisible: true, minWidth: 190 },
  { key: 'subItemCount', label: 'Sub-items', icon: Layers, defaultVisible: false, minWidth: 115 },
  { key: 'attachment', label: 'Attachments', icon: Paperclip, defaultVisible: false, minWidth: 115 },
  { key: 'link', label: 'Links', icon: Link2, defaultVisible: false, minWidth: 100 },
  { key: 'createdOn', label: 'Created on', icon: Calendar, defaultVisible: false, minWidth: 135 },
  { key: 'createdBy', label: 'Created by', icon: User, defaultVisible: false, minWidth: 135 },
  { key: 'updatedOn', label: 'Updated on', icon: Calendar, defaultVisible: false, minWidth: 135 },
];

export const DEFAULT_VISIBLE_PROPERTIES: Record<TablePropertyKey, boolean> = {
  state: true,
  priority: true,
  assignees: true,
  startDate: false,
  dueDate: true,
  labels: true,
  subItemCount: false,
  attachment: false,
  link: false,
  createdOn: false,
  createdBy: false,
  updatedOn: false,
};

export const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  title: 380,
  state: 140,
  priority: 110,
  assignees: 145,
  startDate: 135,
  dueDate: 135,
  labels: 190,
  subItemCount: 115,
  attachment: 115,
  link: 100,
  createdOn: 135,
  createdBy: 135,
  updatedOn: 135,
};




