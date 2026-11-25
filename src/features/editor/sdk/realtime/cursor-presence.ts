/**
 * cursor-presence.ts
 *
 * Extracted collaborator presence & throttled cursor awareness broadcast helpers
 * for YjsSocketIOProvider.
 */

import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import type { Socket } from 'socket.io-client';
import type { CollaborationPresence } from '../pages/types';
import type { CrossTabProviderRole, YjsCrossTabBridge } from './cross-tab';
import {
  applyRemoteCursorAwareness,
  extractLocalCursorCoords,
  removeRemoteCollaborator,
  toCollaborationPresence,
  type ConnectionStatus,
  type RemoteCursorData,
  type RemoteCursorPayload,
  type RemoteCursorSelection,
  type RemotePresencePayload,
  type RemoteUserJoinedPayload,
} from './awareness-sync';

export interface CursorPresenceHost {
  readonly getSocket: () => Socket | null;
  readonly getLocalUserId: () => string | undefined;
  readonly getDoc: () => Y.Doc;
  readonly getYText: () => Y.Text;
  readonly getAwareness: () => Awareness;
  readonly socketToClientIdMap: Map<string, number>;
  readonly collaboratorsMap: Map<string, CollaborationPresence>;
  readonly getIndexedText: () => { text: string; lineStarts: number[] };
  readonly onCollaboratorsChange?: (collaborators: CollaborationPresence[]) => void;
  readonly getRole: () => CrossTabProviderRole;
  readonly getStatus: () => ConnectionStatus;
  readonly getIsSynced: () => boolean;
  readonly getCrossTabBridge: () => YjsCrossTabBridge | null;
}

function broadcastLeaderPresence(host: CursorPresenceHost): void {
  if (host.getRole() === 'leader') {
    host.getCrossTabBridge()?.broadcastLeaderStatus(
      host.getStatus(),
      host.getIsSynced(),
      Array.from(host.collaboratorsMap.values()),
    );
  }
}

export function handleRemoteCursorHelper(
  host: CursorPresenceHost,
  data: RemoteCursorPayload,
): void {
  const { text, lineStarts } = host.getIndexedText();
  applyRemoteCursorAwareness({
    data,
    localSocketId: host.getSocket()?.id,
    localUserId: host.getLocalUserId(),
    doc: host.getDoc(),
    yText: host.getYText(),
    awareness: host.getAwareness(),
    socketToClientIdMap: host.socketToClientIdMap,
    collaboratorsMap: host.collaboratorsMap,
    text,
    lineStarts,
    onCollaboratorsChange: host.onCollaboratorsChange,
  });
}

export function handleInitialDocPresenceHelper(
  host: CursorPresenceHost,
  docPresence: RemotePresencePayload[],
): void {
  const localSocketId = host.getSocket()?.id;
  host.collaboratorsMap.clear();

  for (const p of docPresence) {
    if (!p || p.socketId === localSocketId) continue;

    const key = p.socketId || p.userId;
    host.collaboratorsMap.set(key, toCollaborationPresence(p));

    if (p.cursor) {
      handleRemoteCursorHelper(host, p);
    }
  }

  host.onCollaboratorsChange?.(Array.from(host.collaboratorsMap.values()));
  broadcastLeaderPresence(host);
}

export function handleUserJoinedHelper(
  host: CursorPresenceHost,
  data: RemoteUserJoinedPayload,
): void {
  const key = data.socketId || data.userId;
  const existing =
    host.collaboratorsMap.get(key) ||
    (data.socketId ? host.collaboratorsMap.get(data.userId) : undefined);
  if (data.socketId && existing && !host.collaboratorsMap.has(data.socketId)) {
    host.collaboratorsMap.delete(data.userId);
  }

  host.collaboratorsMap.set(key, toCollaborationPresence(data, existing));

  if (data.cursor) {
    handleRemoteCursorHelper(host, data);
  }

  host.onCollaboratorsChange?.(Array.from(host.collaboratorsMap.values()));
  broadcastLeaderPresence(host);
}

export function handleUserLeftHelper(
  host: CursorPresenceHost,
  data: { userId?: string; socketId?: string },
): void {
  removeRemoteCollaborator({
    data,
    awareness: host.getAwareness(),
    socketToClientIdMap: host.socketToClientIdMap,
    collaboratorsMap: host.collaboratorsMap,
    onCollaboratorsChange: host.onCollaboratorsChange,
  });
  broadcastLeaderPresence(host);
}

export function extractNextLocalCursor(
  host: CursorPresenceHost,
  lastEmittedCoords: { row: number; col: number } | null,
) {
  const { text, lineStarts } = host.getIndexedText();
  return extractLocalCursorCoords({
    awareness: host.getAwareness(),
    doc: host.getDoc(),
    yText: host.getYText(),
    text,
    lineStarts,
    lastEmittedCoords,
  });
}

export class CursorBroadcastThrottler {
  private lastCursorEmitTime = 0;
  private pendingCursorData: {
    row: number;
    column: number;
    selection?: RemoteCursorSelection | null;
  } | null = null;
  private cursorThrottleTimer: ReturnType<typeof setTimeout> | null = null;

  public send(opts: {
    row: number;
    column: number;
    selection?: RemoteCursorSelection | null;
    isDestroyed: () => boolean;
    getRole: () => CrossTabProviderRole;
    getCrossTabBridge: () => YjsCrossTabBridge | null;
    getSocket: () => Socket | null;
    spaceId: string;
    pageId: string;
  }): void {
    const canSend = () =>
      opts.getRole() === 'follower'
        ? Boolean(opts.getCrossTabBridge())
        : Boolean(opts.getSocket()?.connected);

    if (!canSend() || opts.isDestroyed()) return;

    const now = Date.now();
    const elapsed = now - this.lastCursorEmitTime;
    const payload: RemoteCursorData = {
      row: opts.row,
      column: opts.column,
      selection: opts.selection ?? null,
    };

    const emitCursor = (cursorPayload: RemoteCursorData) => {
      if (opts.getRole() === 'follower') {
        opts.getCrossTabBridge()?.sendFollowerCursor(cursorPayload);
        return;
      }
      const socket = opts.getSocket();
      if (socket && socket.connected) {
        socket.emit('doc:cursor', {
          spaceId: opts.spaceId,
          docId: opts.pageId,
          cursor: cursorPayload,
        });
      }
    };

    if (elapsed >= 50) {
      if (this.cursorThrottleTimer) {
        clearTimeout(this.cursorThrottleTimer);
        this.cursorThrottleTimer = null;
      }
      this.lastCursorEmitTime = now;
      this.pendingCursorData = null;
      emitCursor(payload);
    } else {
      this.pendingCursorData = payload;
      if (!this.cursorThrottleTimer) {
        this.cursorThrottleTimer = setTimeout(() => {
          this.cursorThrottleTimer = null;
          if (opts.isDestroyed() || !this.pendingCursorData) return;
          if (!canSend()) return;
          this.lastCursorEmitTime = Date.now();
          const toEmit = this.pendingCursorData;
          this.pendingCursorData = null;
          emitCursor(toEmit);
        }, 50 - elapsed);
      }
    }
  }

  public clear(): void {
    if (this.cursorThrottleTimer) {
      clearTimeout(this.cursorThrottleTimer);
      this.cursorThrottleTimer = null;
    }
    this.pendingCursorData = null;
  }
}
