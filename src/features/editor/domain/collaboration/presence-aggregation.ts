/**
 * presence-aggregation.ts
 *
 * Pure domain logic for multi-tab, multi-device collaborator presence aggregation
 * and ghost cursor suppression (Layer 1: Domain Model).
 *
 * Scenarios handled:
 * - A single user opens N browser tabs (e.g. 10 tabs on Machine 1, 15 tabs on Machine 2).
 * - Deduplicates N tabs into 1 user presence entity for the Topbar Avatar Stack,
 *   annotated with `tabCount` and distinct socket IDs.
 * - Suppresses self-ghost cursors in the active editor surface so authors do not see
 *   stale or duplicate cursor tags representing their own inactive tabs on the same document.
 */

import type { CollaboratorPresenceInfo } from '@/features/editor/core/store/collaboration.store';
import { getAuthorColor } from './author-display';

export interface AggregatedCollaboratorUser extends CollaboratorPresenceInfo {
  /** Canonical userId representing this collaborator */
  userId: string;
  /** Number of active browser tabs / socket sessions held by this user */
  tabCount: number;
  /** List of all connected socket IDs associated with this user */
  socketIds: string[];
  /** Whether this presence represents the currently logged-in user */
  isSelf: boolean;
}

export interface ShouldRenderCursorParams {
  /** The userId of the remote cursor payload */
  cursorUserId?: string | null;
  /** The socketId of the remote cursor payload */
  cursorSocketId?: string | null;
  /** The authenticated userId of the local client */
  currentUserId?: string | null;
  /** The socketId of the local client's active connection */
  localSocketId?: string | null;
  /** If true, allow rendering cursors from other tabs of the same user */
  allowSelfSecondaryTabs?: boolean;
}

/**
 * Determines whether a remote cursor should be drawn in the local editor view.
 *
 * Rules:
 * 1. Never render a cursor if cursorSocketId matches the current tab's localSocketId.
 * 2. If allowSelfSecondaryTabs is false (default), suppress cursors belonging to the
 *    same userId across other tabs to prevent distracting ghost cursors.
 * 3. Always render valid cursors from distinct remote collaborators.
 */
export function shouldRenderRemoteCursor(params: ShouldRenderCursorParams): boolean {
  const {
    cursorUserId,
    cursorSocketId,
    currentUserId,
    localSocketId,
    allowSelfSecondaryTabs = false,
  } = params;

  // Never render local tab's own cursor as remote
  if (localSocketId && cursorSocketId && localSocketId === cursorSocketId) {
    return false;
  }

  // Suppress ghost cursors from the same user's secondary tabs if disabled
  if (!allowSelfSecondaryTabs && currentUserId && cursorUserId && currentUserId === cursorUserId) {
    return false;
  }

  return true;
}

/**
 * Aggregates a flat list of individual tab/socket presences into deduplicated user entities.
 *
 * Overleaf & Figma parity:
 * - When Alice has 10 tabs open and Bob has 15 tabs open, the topbar renders exactly
 *   2 user avatars (Alice with `tabCount: 10` and Bob with `tabCount: 15`).
 * - Keeps the most recently active cursor and file location across a user's open tabs.
 * - Deterministically sorts so remote active collaborators are prioritized.
 */
export function aggregateCollaboratorPresences(
  presences: CollaboratorPresenceInfo[],
  currentUserId?: string | null,
): AggregatedCollaboratorUser[] {
  if (!presences || presences.length === 0) {
    return [];
  }

  interface InternalEntry extends AggregatedCollaboratorUser {
    orderIndex: number;
  }

  const userMap = new Map<string, InternalEntry>();
  let insertOrder = 0;

  for (const p of presences) {
    const rawUserId = p.userId || p.id;
    if (!rawUserId) continue;

    const existing = userMap.get(rawUserId);
    const isSelf = Boolean(currentUserId && (rawUserId === currentUserId || p.id === currentUserId));
    const pSocketId = p.socketId || (p.id !== rawUserId ? p.id : undefined);

    if (!existing) {
      const socketIds = pSocketId ? [pSocketId] : [];
      userMap.set(rawUserId, {
        ...p,
        id: rawUserId,
        userId: rawUserId,
        color: p.color || getAuthorColor(rawUserId),
        tabCount: 1,
        socketIds,
        isSelf,
        lastActiveAt: p.lastActiveAt,
        orderIndex: insertOrder++,
      });
    } else {
      existing.tabCount += 1;
      if (pSocketId && !existing.socketIds.includes(pSocketId)) {
        existing.socketIds.push(pSocketId);
      }

      // Preserve most recent activity if available
      const pActive = p.lastActiveAt ?? 0;
      const exActive = existing.lastActiveAt ?? 0;
      if (pActive > exActive) {
        existing.lastActiveAt = p.lastActiveAt;
        if (p.cursor) existing.cursor = p.cursor;
        if (p.activeFile) existing.activeFile = p.activeFile;
        if (p.activeFileId) existing.activeFileId = p.activeFileId;
      } else if (!existing.cursor && p.cursor) {
        existing.cursor = p.cursor;
      }

      // If any tab is online, user is considered online
      if (p.isOnline) {
        existing.isOnline = true;
      }
    }
  }

  return Array.from(userMap.values())
    .sort((a, b) => {
      // Other users first, then self
      if (a.isSelf !== b.isSelf) {
        return a.isSelf ? 1 : -1;
      }
      const aTime = a.lastActiveAt ?? 0;
      const bTime = b.lastActiveAt ?? 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return a.orderIndex - b.orderIndex; // Stable original input order
    })
    .map(({ orderIndex: _orderIndex, ...user }) => user);
}
