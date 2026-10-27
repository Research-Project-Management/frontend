/**
 * yjs-awareness-sync.ts
 *
 * Line-offset indexing, Yjs text diffing, binary sync frame helpers,
 * remote cursor/presence mapping, and awareness synchronization helpers
 * for YjsSocketIOProvider.
 */

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import type { Socket } from 'socket.io-client';
import type { IEditorCommandBus } from '@/features/editor/core/bus/command-bus.port';
import type { CollaborationPresence } from '../manuscript/types';

export interface CollaboratorUser {
  id: string;
  name: string;
  avatar?: string | null;
  color?: string;
  role?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface CompileProgressPayload {
  status?: string;
  logs?: string | string[];
}

export interface DocContentUpdatedPayload {
  docId: string;
  content: string;
}

export interface RemoteCursorSelection {
  anchor: { row: number; column: number };
  head: { row: number; column: number };
}

export interface RemoteCursorData {
  row: number;
  column: number;
  selection?: RemoteCursorSelection | null;
}

export interface RemotePresencePayload {
  userId: string;
  socketId?: string;
  name?: string;
  avatar?: string | null;
  color?: string;
  role?: string;
  cursor?: RemoteCursorData | null;
  [key: string]: unknown;
}

export type RemoteCursorPayload = RemotePresencePayload;
export type RemoteUserJoinedPayload = RemotePresencePayload;

export interface ProjectChatMessage {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  userColor?: string;
  userAvatar?: string;
  text: string;
  replyToId?: string;
  createdAt: string;
}

export interface YjsSocketIOProviderOptions {
  user?: CollaboratorUser;
  baseUrl?: string;
  token?: string;
  getToken?: () => string | undefined;
  initialContent?: string;
  commandBus?: IEditorCommandBus;
  onStatusChange?: (status: ConnectionStatus) => void;
  onSynced?: () => void;
  onCollaboratorsChange?: (collaborators: CollaborationPresence[]) => void;
  onChatMessage?: (message: ProjectChatMessage) => void;
}

/**
 * Precomputes a 0-indexed table of character offsets where each line starts.
 * Time Complexity: O(N) once per document mutation.
 * Space Complexity: O(L) where L is the number of lines.
 */
export function buildLineStartsIndex(text: string): number[] {
  const starts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      starts.push(i + 1);
    }
  }
  return starts;
}

/**
 * Maps a (row, column) coordinate (1-indexed) in text to an absolute character offset.
 * - With `lineStarts` index: O(1) direct array lookup.
 * - Without `lineStarts` index: O(N) linear scan fallback.
 */
export function getOffsetFromRowCol(
  text: string,
  row: number,
  column: number,
  lineStarts?: number[],
): number {
  if (!text || text.length === 0) return 0;
  const targetLine = Math.max(1, row);
  const targetCol = Math.max(1, column);

  if (lineStarts && lineStarts.length > 0) {
    if (targetLine > lineStarts.length) {
      return text.length;
    }
    const lineIdx = targetLine - 1;
    const lineStartOffset = lineStarts[lineIdx];
    const nextNewline =
      lineIdx + 1 < lineStarts.length ? lineStarts[lineIdx + 1] - 1 : text.length;
    const lineLength = nextNewline - lineStartOffset;
    const colOffset = Math.min(Math.max(0, targetCol - 1), lineLength);
    return Math.min(text.length, lineStartOffset + colOffset);
  }

  let currentLine = 1;
  let lineStartOffset = 0;

  for (let i = 0; i < text.length; i++) {
    if (currentLine === targetLine) break;
    if (text[i] === '\n') {
      currentLine++;
      lineStartOffset = i + 1;
    }
  }

  if (targetLine > currentLine) {
    return text.length;
  }

  let nextNewline = text.indexOf('\n', lineStartOffset);
  if (nextNewline === -1) nextNewline = text.length;
  const lineLength = nextNewline - lineStartOffset;

  const colOffset = Math.min(Math.max(0, targetCol - 1), lineLength);
  return Math.min(text.length, lineStartOffset + colOffset);
}

/**
 * Maps an absolute character offset in text to a (row, column) coordinate (1-indexed).
 * - With `lineStarts` index: O(log L) binary search (upper-bound).
 * - Without `lineStarts` index: O(N) linear scan fallback.
 */
export function getRowColFromOffset(
  text: string,
  offset: number,
  lineStarts?: number[],
): { row: number; col: number } {
  const safeOffset = Math.max(0, Math.min(text.length, offset));

  if (lineStarts && lineStarts.length > 0) {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (lineStarts[mid] <= safeOffset) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const lineIdx = Math.max(0, high);
    return {
      row: lineIdx + 1,
      col: safeOffset - lineStarts[lineIdx] + 1,
    };
  }

  let row = 1;
  let lastLineStart = 0;

  for (let i = 0; i < safeOffset; i++) {
    if (text[i] === '\n') {
      row++;
      lastLineStart = i + 1;
    }
  }

  const col = safeOffset - lastLineStart + 1;
  return { row, col };
}

/**
 * Applies the minimal prefix/suffix splice that turns yText into target, as one transaction.
 */
export function applyTextDiff(yText: Y.Text, target: string, origin: unknown = 'local'): boolean {
  const current = yText.toString();
  if (current === target) return false;
  let start = 0;
  const minLen = Math.min(current.length, target.length);
  while (start < minLen && current.charCodeAt(start) === target.charCodeAt(start)) start++;
  let endCur = current.length;
  let endTgt = target.length;
  while (endCur > start && endTgt > start && current.charCodeAt(endCur - 1) === target.charCodeAt(endTgt - 1)) {
    endCur--;
    endTgt--;
  }
  const doc = yText.doc;
  const apply = () => {
    if (endCur > start) yText.delete(start, endCur - start);
    if (endTgt > start) yText.insert(start, target.slice(start, endTgt));
  };
  if (doc) doc.transact(apply, origin);
  else apply();
  return true;
}

export function applyBinarySyncFrame(
  data: Uint8Array | ArrayLike<number>,
  targetDoc: Y.Doc,
  socket: Socket | null,
  projectId: string,
  pageId: string,
  emitStep2Reply: boolean,
): void {
  const rawData = data instanceof Uint8Array ? data : new Uint8Array(data);
  const decoder = decoding.createDecoder(rawData);
  const replyEncoder = encoding.createEncoder();
  while (decoding.hasContent(decoder)) {
    syncProtocol.readSyncMessage(decoder, replyEncoder, targetDoc, 'socket.io');
  }
  if (emitStep2Reply && encoding.length(replyEncoder) > 0) {
    socket?.emit('doc:sync:step2', {
      projectId,
      docId: pageId,
      data: encoding.toUint8Array(replyEncoder),
    });
  }
}

export function encodeMergedYjsUpdates(updatesToEmit: Uint8Array[]): Uint8Array {
  const mergedUpdate = updatesToEmit.length === 1 ? updatesToEmit[0] : Y.mergeUpdates(updatesToEmit);
  const encoder = encoding.createEncoder();
  syncProtocol.writeUpdate(encoder, mergedUpdate);
  return encoding.toUint8Array(encoder);
}

export function encodeYjsSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

export function extractLocalCursorCoords(params: {
  awareness: Awareness;
  doc: Y.Doc;
  yText: Y.Text;
  text: string;
  lineStarts: number[];
  lastEmittedCoords: { row: number; col: number } | null;
}): {
  nextLastEmittedCoords: { row: number; col: number };
  headRow: number;
  headCol: number;
  selection: RemoteCursorSelection | null;
} | null {
  const { awareness, doc, yText, text, lineStarts, lastEmittedCoords } = params;
  const localState = awareness.getLocalState();
  if (!localState || !localState.cursor) return null;
  const { anchor, head } = localState.cursor;
  if (!anchor || !head) return null;

  const anchorAbs = Y.createAbsolutePositionFromRelativePosition(anchor, doc);
  const headAbs = Y.createAbsolutePositionFromRelativePosition(head, doc);
  if (!anchorAbs || !headAbs || anchorAbs.type !== yText || headAbs.type !== yText) {
    return null;
  }

  const anchorPos = getRowColFromOffset(text, anchorAbs.index, lineStarts);
  const headPos = getRowColFromOffset(text, headAbs.index, lineStarts);

  if (
    lastEmittedCoords &&
    lastEmittedCoords.row === headPos.row &&
    lastEmittedCoords.col === headPos.col &&
    anchorAbs.index === headAbs.index
  ) {
    return null;
  }

  const isPoint = anchorAbs.index === headAbs.index;
  return {
    nextLastEmittedCoords: { row: headPos.row, col: headPos.col },
    headRow: headPos.row,
    headCol: headPos.col,
    selection: isPoint
      ? null
      : {
          anchor: { row: anchorPos.row, column: anchorPos.col },
          head: { row: headPos.row, column: headPos.col },
        },
  };
}

export function toCollaborationPresence(
  data: RemotePresencePayload,
  existing?: CollaborationPresence,
): CollaborationPresence {
  return {
    ...existing,
    id: data.userId,
    userId: data.userId,
    socketId: data.socketId ?? existing?.socketId,
    name: data.name || existing?.name || 'Collaborator',
    avatar: data.avatar !== undefined ? data.avatar : existing?.avatar,
    color: data.color || existing?.color || '#3b82f6',
    role: data.role ?? existing?.role,
    cursor: data.cursor
      ? {
          line: data.cursor.row,
          column: data.cursor.column,
          selection: data.cursor.selection
            ? {
                startLineNumber: data.cursor.selection.anchor.row,
                startColumn: data.cursor.selection.anchor.column,
                endLineNumber: data.cursor.selection.head.row,
                endColumn: data.cursor.selection.head.column,
              }
            : undefined,
        }
      : existing?.cursor,
    lastActiveAt: Date.now(),
  };
}

export function resolveRemoteClientId(
  key: string,
  localClientId: number,
  socketToClientIdMap: Map<string, number>,
): number {
  let clientId = socketToClientIdMap.get(key);
  if (clientId !== undefined) return clientId;

  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash) + key.charCodeAt(i);
    hash |= 0;
  }
  clientId = Math.abs(hash);
  if (clientId === localClientId || clientId === 0) {
    clientId = localClientId + 1000 + (Math.abs(hash) % 10000);
  }
  socketToClientIdMap.set(key, clientId);
  return clientId;
}

export function applyRemoteCursorAwareness(params: {
  data: RemoteCursorPayload;
  localSocketId?: string;
  doc: Y.Doc;
  yText: Y.Text;
  awareness: Awareness;
  socketToClientIdMap: Map<string, number>;
  collaboratorsMap: Map<string, CollaborationPresence>;
  text: string;
  lineStarts: number[];
  onCollaboratorsChange?: (collaborators: CollaborationPresence[]) => void;
}): void {
  const {
    data,
    localSocketId,
    doc,
    yText,
    awareness,
    socketToClientIdMap,
    collaboratorsMap,
    text,
    lineStarts,
    onCollaboratorsChange,
  } = params;
  if (!data || !data.cursor) return;
  if (data.socketId && data.socketId === localSocketId) return;

  const clientId = resolveRemoteClientId(data.socketId || data.userId, doc.clientID, socketToClientIdMap);

  const anchorRow = data.cursor.selection?.anchor?.row ?? data.cursor.row;
  const anchorCol = data.cursor.selection?.anchor?.column ?? data.cursor.column;
  const headRow = data.cursor.selection?.head?.row ?? data.cursor.row;
  const headCol = data.cursor.selection?.head?.column ?? data.cursor.column;

  const anchorOffset = getOffsetFromRowCol(text, anchorRow, anchorCol, lineStarts);
  const headOffset = getOffsetFromRowCol(text, headRow, headCol, lineStarts);

  const anchor = Y.createRelativePositionFromTypeIndex(yText, anchorOffset);
  const head = Y.createRelativePositionFromTypeIndex(yText, headOffset);

  const isNew = !awareness.states.has(clientId);
  awareness.states.set(clientId, {
    user: {
      id: data.userId,
      name: data.name || 'Collaborator',
      color: data.color || '#3b82f6',
      avatar: data.avatar,
    },
    cursor: { anchor, head },
  });

  const currentClock = awareness.meta.get(clientId)?.clock || 0;
  awareness.meta.set(clientId, {
    clock: currentClock + 1,
    lastUpdated: Date.now(),
  });

  awareness.emit('change', [
    {
      added: isNew ? [clientId] : [],
      updated: isNew ? [] : [clientId],
      removed: [],
    },
    'socket.io',
  ]);

  const key = data.socketId || data.userId;
  const existing =
    collaboratorsMap.get(key) ||
    (data.socketId ? collaboratorsMap.get(data.userId) : undefined);
  if (data.socketId && existing && !collaboratorsMap.has(data.socketId)) {
    collaboratorsMap.delete(data.userId);
  }
  collaboratorsMap.set(key, toCollaborationPresence(data, existing));
  onCollaboratorsChange?.(Array.from(collaboratorsMap.values()));
}

export function removeRemoteCollaborator(params: {
  data: { userId?: string; socketId?: string };
  awareness: Awareness;
  socketToClientIdMap: Map<string, number>;
  collaboratorsMap: Map<string, CollaborationPresence>;
  onCollaboratorsChange?: (collaborators: CollaborationPresence[]) => void;
}): void {
  const { data, awareness, socketToClientIdMap, collaboratorsMap, onCollaboratorsChange } = params;
  if (data.socketId) {
    collaboratorsMap.delete(data.socketId);
  }
  if (data.userId) {
    collaboratorsMap.delete(data.userId);
    for (const [k, c] of collaboratorsMap) {
      if (c.userId === data.userId || c.id === data.userId) {
        collaboratorsMap.delete(k);
      }
    }
  }

  const targetKey = data.socketId || data.userId;
  if (targetKey) {
    const clientId = socketToClientIdMap.get(targetKey);
    if (clientId) {
      removeAwarenessStates(awareness, [clientId], 'socket.io');
      socketToClientIdMap.delete(targetKey);
    }
  }

  onCollaboratorsChange?.(Array.from(collaboratorsMap.values()));
}
