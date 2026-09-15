import type {
  Column,
  State,
  StateGroup,
} from "../types/work-item.types";
import {
  STATE_GROUPS,
  DEFAULT_STATES,
} from "../types/work-item.types";

// ── 1. Column & State Resolvers ──────────────────────────────────────────────

export function resolveColumnId(column?: Pick<Column, "id"> | null): string {
  return column?.id ?? "";
}

export function resolveColumnColor(
  columnId?: string | Partial<Column> | Partial<State> | null,
  accentColor?: string
): string {
  if (!columnId) return accentColor || "#8A9093";
  if (typeof columnId === "object") {
    const colObj = columnId as Record<string, unknown>;
    const colColor =
      (typeof colObj.color === "string" ? colObj.color : undefined) ||
      (typeof colObj.accentColor === "string" ? colObj.accentColor : undefined);
    return colColor || accentColor || "#8A9093";
  }
  return accentColor || "#8A9093";
}

export function resolveItemId(target?: { id?: string; itemId?: string; workItemId?: string } | null): string {
  if (!target) return "";
  return target.id ?? target.workItemId ?? target.itemId ?? "";
}
export const resolveWorkItemId = resolveItemId;
export const resolveColumnItemId = resolveItemId;
export const resolveWorkItemColumnId = resolveColumnId;

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
      backlog: "#8A9093",
      unstarted: "#525866",
      started: "#F59E0B",
      completed: "#10B981",
      cancelled: "#EF4444",
    };
    const rawCustom =
      (typeof rawObj.color === "string" && rawObj.color.trim() ? rawObj.color.trim() : undefined) ||
      (typeof rawObj.accentColor === "string" && rawObj.accentColor.trim() ? rawObj.accentColor.trim() : undefined);
    const color = rawCustom || groupColorMap[group] || "#8A9093";
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
    return targetDate.toLocaleDateString("vi-VN", { month: "short", day: "numeric" });
  },

  formatDate: (val?: string | null): string => {
    if (!val) return "";
    const targetDate = new Date(val);
    if (Number.isNaN(targetDate.getTime())) return "";
    return targetDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
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
    item: { assignee?: { id?: string } | null; assigneeId?: string | { id?: string } | null } | null | undefined
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
};

export const ItemHelpers = WorkItemHelpers;
export const Helpers = WorkItemHelpers;

export const getInitials = WorkItemHelpers.getInitials;
export const formatActivityTime = WorkItemHelpers.formatActivityTime;
export const formatDate = WorkItemHelpers.formatDate;
export const checkOverdue = WorkItemHelpers.checkOverdue;
export const uniqueLabels = WorkItemHelpers.uniqueLabels;
export const countAttachments = WorkItemHelpers.countAttachments;
export const resolveAssignee = WorkItemHelpers.resolveAssignee;
export const resolveAssignees = WorkItemHelpers.resolveAssignees;
export const resolveAssigneeId = WorkItemHelpers.resolveAssigneeId;
export const createSnapshot = WorkItemHelpers.createSnapshot;
export const calculateProgressRollup = WorkItemHelpers.calculateProgressRollup;
export const isDueSoon = WorkItemHelpers.isDueSoon;
export const resolveWorkItemColumnColor = resolveColumnColor;
export const resolveItemColumnColor = resolveColumnColor;
export const resolveItemColumnId = resolveColumnId;
export { DEFAULT_STATES };
