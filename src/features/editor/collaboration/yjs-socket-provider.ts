/**
 * yjs-socket-provider.ts
 *
 * Real-Time Socket.IO & Yjs Collaboration Provider for Flux (Overleaf Parity).
 * Connects CodeMirror 6 (via y-codemirror.next) to Backend ManuscriptRealtimeGateway (/manuscripts)
 * backed by Redis horizontal room fan-out.
 *
 * Features:
 * - Handshake auth with JWT bearer token and user metadata (name, avatar, color).
 * - Automatic project & document room joins (project:join, doc:join).
 * - Bi-directional real-time cursor awareness (doc:cursor) with Yjs RelativePosition mapping.
 * - Active collaborator presence list synchronization (doc:user-joined, doc:user-left).
 * - Resilient auto-reconnect with polling fallback and smooth cleanup on unmount.
 */

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';
import { io, type Socket } from 'socket.io-client';
import { getEffectiveBaseUrl, getAuthToken } from '@/shared/lib/api';
import { EditorEventBus } from '../utils/editor.util';
import type { CollaborationPresence } from '../services/collaboration.service';

export interface CollaboratorUser {
  id: string;
  name: string;
  avatar?: string | null;
  color?: string;
  role?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface YjsSocketIOProviderOptions {
  user?: CollaboratorUser;
  baseUrl?: string;
  token?: string;
  onStatusChange?: (status: ConnectionStatus) => void;
  onSynced?: () => void;
  onCollaboratorsChange?: (collaborators: CollaborationPresence[]) => void;
}

/**
 * Maps a (row, column) coordinate (1-indexed) in text to an absolute character offset.
 */
export function getOffsetFromRowCol(text: string, row: number, column: number): number {
  if (!text || text.length === 0) return 0;
  const targetLine = Math.max(1, row);
  const targetCol = Math.max(1, column);

  let currentLine = 1;
  let lineStartOffset = 0;

  for (let i = 0; i < text.length; i++) {
    if (currentLine === targetLine) break;
    if (text[i] === '\n') {
      currentLine++;
      lineStartOffset = i + 1;
    }
  }

  // If target line exceeds document lines, clamp to end of document
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
 */
export function getRowColFromOffset(text: string, offset: number): { row: number; col: number } {
  const safeOffset = Math.max(0, Math.min(text.length, offset));
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

export class YjsSocketIOProvider {
  public readonly doc: Y.Doc;
  public readonly yText: Y.Text;
  public readonly awareness: Awareness;
  public readonly projectId: string;
  public readonly pageId: string;

  public status: ConnectionStatus = 'connecting';
  public isSynced: boolean = false;

  private socket: Socket | null = null;
  private options: YjsSocketIOProviderOptions;
  private socketToClientIdMap = new Map<string, number>();
  private activeCollaborators: CollaborationPresence[] = [];
  private destroyed = false;
  private cursorEmitDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmittedCoords: { row: number; col: number } | null = null;

  constructor(
    projectId: string,
    pageId: string,
    doc?: Y.Doc,
    options: YjsSocketIOProviderOptions = {},
  ) {
    this.projectId = projectId;
    this.pageId = pageId;
    this.doc = doc || new Y.Doc();
    this.yText = this.doc.getText('latex');
    this.awareness = new Awareness(this.doc);
    this.options = options;

    if (options.user) {
      this.setLocalUser(options.user);
    }

    this.setupLocalAwarenessListener();
    this.setupLocalDocListener();

    if (typeof window !== 'undefined' && projectId && pageId) {
      this.connect();
    } else {
      this.status = 'connected';
      this.isSynced = true;
      options.onStatusChange?.('connected');
      options.onSynced?.();
    }
  }

  private connect(): void {
    const rawBase = (this.options.baseUrl || getEffectiveBaseUrl() || '').replace(/\/$/, '');
    const socketUrl = rawBase ? `${rawBase}/manuscripts` : '/manuscripts';
    const token = this.options.token || getAuthToken() || undefined;

    const user = this.options.user;
    const authPayload: Record<string, any> = {
      token,
      userId: user?.id,
      name: user?.name,
      avatar: user?.avatar,
      color: user?.color,
    };

    try {
      this.socket = io(socketUrl, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        auth: authPayload,
        reconnection: true,
        reconnectionAttempts: 15,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.registerSocketEvents();
    } catch (err) {
      console.warn('[YjsSocketIOProvider] Failed to initialize Socket.IO client:', err);
      this.status = 'disconnected';
      this.options.onStatusChange?.('disconnected');
    }
  }

  private registerSocketEvents(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      if (this.destroyed) return;
      this.status = 'connected';
      this.options.onStatusChange?.('connected');

      // 1. Join project room
      this.socket?.emit(
        'project:join',
        { projectId: this.projectId },
        (res?: { success?: boolean; projectPresence?: any[]; error?: string }) => {
          if (res?.error) {
            console.debug('[YjsSocketIOProvider] project:join info:', res.error);
          }
        },
      );

      // 2. Join document editor room
      this.socket?.emit(
        'doc:join',
        { projectId: this.projectId, docId: this.pageId },
        (res?: { success?: boolean; docPresence?: any[]; error?: string }) => {
          if (res?.success && Array.isArray(res.docPresence)) {
            this.handleInitialDocPresence(res.docPresence);
          }
          // Initiate Binary CRDT Yjs Handshake with server
          this.initiateYjsSync();
        },
      );
    });

    this.socket.on('disconnect', () => {
      if (this.destroyed) return;
      this.status = 'disconnected';
      this.options.onStatusChange?.('disconnected');

      // Clear remote awareness states
      const remoteClientIds = Array.from(this.socketToClientIdMap.values());
      if (remoteClientIds.length > 0) {
        removeAwarenessStates(this.awareness, remoteClientIds, 'socket.io');
        this.socketToClientIdMap.clear();
      }
      this.activeCollaborators = [];
      this.options.onCollaboratorsChange?.([]);
    });

    this.socket.on('connect_error', () => {
      if (this.destroyed) return;
      if (this.status !== 'connecting') {
        this.status = 'connecting';
        this.options.onStatusChange?.('connecting');
      }
    });

    // Binary Yjs sync-update from server / remote collaborators
    this.socket.on('doc:sync-update', (payload: { projectId: string; docId: string; data: any }) => {
      if (this.destroyed) return;
      if (payload.projectId !== this.projectId || payload.docId !== this.pageId) return;
      if (!payload.data) return;

      try {
        const rawData =
          payload.data instanceof Uint8Array
            ? payload.data
            : new Uint8Array(payload.data);

        const decoder = decoding.createDecoder(rawData);
        syncProtocol.readSyncMessage(decoder, encoding.createEncoder(), this.doc, 'socket.io');
      } catch (err) {
        try {
          const raw = payload.data instanceof Uint8Array ? payload.data : new Uint8Array(payload.data);
          Y.applyUpdate(this.doc, raw, 'socket.io');
        } catch (applyErr) {
          console.warn('[YjsSocketIOProvider] Error applying incoming sync-update:', applyErr);
        }
      }
    });

    // Real-time LaTeX compilation streaming
    this.socket.on('compile:progress', (data: any) => {
      if (this.destroyed) return;
      EditorEventBus.emit('flux:compile-progress', data);
    });

    // Remote cursor update from peer
    this.socket.on('doc:cursor', (data: any) => {
      if (this.destroyed) return;
      this.handleRemoteCursor(data);
    });

    // Collaborator joined document room
    this.socket.on('doc:user-joined', (data: any) => {
      if (this.destroyed) return;
      if (data.socketId === this.socket?.id) return;
      this.handleUserJoined(data);
    });

    // Collaborator left document room
    this.socket.on('doc:user-left', (data: { userId?: string; socketId?: string }) => {
      if (this.destroyed) return;
      this.handleUserLeft(data);
    });

    // Project-level user left
    this.socket.on('project:user-left', (data: { userId?: string; socketId?: string }) => {
      if (this.destroyed) return;
      this.handleUserLeft(data);
    });

    // Real-time project file-tree mutation (create, rename, move, delete)
    this.socket.on('fileTree:update', (data: any) => {
      if (this.destroyed) return;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:filetree-updated', { detail: data }));
      }
    });

    // Real-time document content update from collaborator
    this.socket.on('doc:content-updated', (data: any) => {
      if (this.destroyed) return;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('flux:doc-content-updated', { detail: data }));
      }
    });
  }

  private setupLocalDocListener(): void {
    this.doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === 'socket.io' || this.destroyed) return;
      if (!this.socket || !this.socket.connected) return;

      const encoder = encoding.createEncoder();
      syncProtocol.writeUpdate(encoder, update);
      const syncMessage = encoding.toUint8Array(encoder);

      this.socket.emit('doc:sync-update', {
        projectId: this.projectId,
        docId: this.pageId,
        data: syncMessage,
      });
    });
  }

  private initiateYjsSync(): void {
    if (!this.socket || !this.socket.connected || this.destroyed) return;

    // Send binary sync-step-1 with local state vector
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, this.doc);
    const step1Payload = encoding.toUint8Array(encoder);

    this.socket.emit(
      'doc:sync-step-1',
      {
        projectId: this.projectId,
        docId: this.pageId,
        data: step1Payload,
      },
      (res?: { success?: boolean; data?: any; error?: string }) => {
        if (res?.success && res.data) {
          try {
            const rawData =
              res.data instanceof Uint8Array
                ? res.data
                : new Uint8Array(res.data);
            const decoder = decoding.createDecoder(rawData);
            syncProtocol.readSyncMessage(decoder, encoding.createEncoder(), this.doc, 'socket.io');
          } catch (err) {
            console.warn('[YjsSocketIOProvider] Error processing sync-step-2 from server:', err);
          }
        }
        this.isSynced = true;
        this.options.onSynced?.();
      },
    );
  }

  private handleInitialDocPresence(docPresence: any[]): void {
    const remoteList: CollaborationPresence[] = [];

    for (const p of docPresence) {
      if (!p || p.socketId === this.socket?.id) continue;

      const presence: CollaborationPresence = {
        id: p.userId,
        userId: p.userId,
        name: p.name || 'Collaborator',
        avatar: p.avatar,
        color: p.color || '#3b82f6',
        role: p.role,
        cursor: p.cursor
          ? {
              line: p.cursor.row,
              column: p.cursor.column,
              selection: p.cursor.selection
                ? {
                    startLineNumber: p.cursor.selection.anchor.row,
                    startColumn: p.cursor.selection.anchor.column,
                    endLineNumber: p.cursor.selection.head.row,
                    endColumn: p.cursor.selection.head.column,
                  }
                : undefined,
            }
          : undefined,
        lastActiveAt: Date.now(),
      };
      remoteList.push(presence);

      if (p.cursor) {
        this.handleRemoteCursor(p);
      }
    }

    this.activeCollaborators = remoteList;
    this.options.onCollaboratorsChange?.([...this.activeCollaborators]);
  }

  private handleRemoteCursor(data: any): void {
    if (!data || !data.cursor) return;
    if (data.socketId && data.socketId === this.socket?.id) return;

    const clientId = this.getOrCreateClientId(data.socketId || data.userId);
    const text = this.yText.toString();

    const anchorRow = data.cursor.selection?.anchor?.row ?? data.cursor.row;
    const anchorCol = data.cursor.selection?.anchor?.column ?? data.cursor.column;
    const headRow = data.cursor.selection?.head?.row ?? data.cursor.row;
    const headCol = data.cursor.selection?.head?.column ?? data.cursor.column;

    const anchorOffset = getOffsetFromRowCol(text, anchorRow, anchorCol);
    const headOffset = getOffsetFromRowCol(text, headRow, headCol);

    const anchor = Y.createRelativePositionFromTypeIndex(this.yText, anchorOffset);
    const head = Y.createRelativePositionFromTypeIndex(this.yText, headOffset);

    const isNew = !this.awareness.states.has(clientId);
    this.awareness.states.set(clientId, {
      user: {
        id: data.userId,
        name: data.name || 'Collaborator',
        color: data.color || '#3b82f6',
        avatar: data.avatar,
      },
      cursor: { anchor, head },
    });

    const currentClock = this.awareness.meta.get(clientId)?.clock || 0;
    this.awareness.meta.set(clientId, {
      clock: currentClock + 1,
      lastUpdated: Date.now(),
    });

    this.awareness.emit('change', [
      {
        added: isNew ? [clientId] : [],
        updated: isNew ? [] : [clientId],
        removed: [],
      },
      'socket.io',
    ]);

    this.updateCollaboratorCursor(data);
  }

  private handleUserJoined(data: any): void {
    const idx = this.activeCollaborators.findIndex(
      (c) => c.userId === data.userId || (data.socketId && (c as any).socketId === data.socketId),
    );

    const newUser: CollaborationPresence = {
      id: data.userId,
      userId: data.userId,
      name: data.name || 'Collaborator',
      avatar: data.avatar,
      color: data.color || '#3b82f6',
      role: data.role,
      cursor: data.cursor
        ? {
            line: data.cursor.row,
            column: data.cursor.column,
          }
        : undefined,
      lastActiveAt: Date.now(),
    };

    if (idx >= 0) {
      this.activeCollaborators[idx] = { ...this.activeCollaborators[idx], ...newUser };
    } else {
      this.activeCollaborators.push(newUser);
    }

    if (data.cursor) {
      this.handleRemoteCursor(data);
    }

    this.options.onCollaboratorsChange?.([...this.activeCollaborators]);
  }

  private handleUserLeft(data: { userId?: string; socketId?: string }): void {
    this.activeCollaborators = this.activeCollaborators.filter((c) => {
      if (data.userId && (c.userId === data.userId || c.id === data.userId)) {
        return false;
      }
      if (data.socketId && (c as any).socketId === data.socketId) {
        return false;
      }
      return true;
    });

    const targetKey = data.socketId || data.userId;
    if (targetKey) {
      const clientId = this.socketToClientIdMap.get(targetKey);
      if (clientId) {
        removeAwarenessStates(this.awareness, [clientId], 'socket.io');
        this.socketToClientIdMap.delete(targetKey);
      }
    }

    this.options.onCollaboratorsChange?.([...this.activeCollaborators]);
  }

  private updateCollaboratorCursor(data: any): void {
    const idx = this.activeCollaborators.findIndex(
      (c) => c.userId === data.userId || (data.socketId && (c as any).socketId === data.socketId),
    );

    const updatedUser: CollaborationPresence = {
      id: data.userId,
      userId: data.userId,
      name: data.name || 'Collaborator',
      color: data.color || '#3b82f6',
      avatar: data.avatar,
      cursor: {
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
      },
      lastActiveAt: Date.now(),
    };

    if (idx >= 0) {
      this.activeCollaborators[idx] = {
        ...this.activeCollaborators[idx],
        ...updatedUser,
      };
    } else {
      this.activeCollaborators.push(updatedUser);
    }

    this.options.onCollaboratorsChange?.([...this.activeCollaborators]);
  }

  private getOrCreateClientId(key: string): number {
    let clientId = this.socketToClientIdMap.get(key);
    if (clientId !== undefined) return clientId;

    let hash = 5381;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) + hash) + key.charCodeAt(i);
      hash |= 0;
    }
    clientId = Math.abs(hash);
    if (clientId === this.doc.clientID || clientId === 0) {
      clientId = this.doc.clientID + 1000 + (Math.abs(hash) % 10000);
    }
    this.socketToClientIdMap.set(key, clientId);
    return clientId;
  }

  private setupLocalAwarenessListener(): void {
    this.awareness.on('change', ({ added, updated }: any, origin: any) => {
      if (origin === 'socket.io') return;
      if (
        added.includes(this.awareness.clientID) ||
        updated.includes(this.awareness.clientID)
      ) {
        this.scheduleEmitLocalCursor();
      }
    });
  }

  private scheduleEmitLocalCursor(): void {
    if (this.cursorEmitDebounceTimer) return;
    this.cursorEmitDebounceTimer = setTimeout(() => {
      this.cursorEmitDebounceTimer = null;
      if (this.destroyed) return;

      const localState = this.awareness.getLocalState();
      if (!localState || !localState.cursor) return;
      const { anchor, head } = localState.cursor;
      if (!anchor || !head) return;

      const anchorAbs = Y.createAbsolutePositionFromRelativePosition(anchor, this.doc);
      const headAbs = Y.createAbsolutePositionFromRelativePosition(head, this.doc);
      if (!anchorAbs || !headAbs || anchorAbs.type !== this.yText || headAbs.type !== this.yText) {
        return;
      }

      const text = this.yText.toString();
      const anchorPos = getRowColFromOffset(text, anchorAbs.index);
      const headPos = getRowColFromOffset(text, headAbs.index);

      // Avoid re-emitting identical position
      if (
        this.lastEmittedCoords &&
        this.lastEmittedCoords.row === headPos.row &&
        this.lastEmittedCoords.col === headPos.col &&
        anchorAbs.index === headAbs.index
      ) {
        return;
      }
      this.lastEmittedCoords = { row: headPos.row, col: headPos.col };

      const isPoint = anchorAbs.index === headAbs.index;
      this.sendCursor(
        headPos.row,
        headPos.col,
        isPoint
          ? null
          : {
              anchor: { row: anchorPos.row, column: anchorPos.col },
              head: { row: headPos.row, column: headPos.col },
            },
      );
    }, 40);
  }

  /**
   * Explicitly broadcast cursor coordinates to other room collaborators.
   */
  public sendCursor(
    row: number,
    column: number,
    selection?: {
      anchor: { row: number; column: number };
      head: { row: number; column: number };
    } | null,
  ): void {
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('doc:cursor', {
      projectId: this.projectId,
      docId: this.pageId,
      cursor: {
        row,
        column,
        selection: selection ?? null,
      },
    });
  }

  public setLocalUser(user: CollaboratorUser): void {
    this.awareness.setLocalStateField('user', {
      id: user.id,
      name: user.name || 'Anonymous Researcher',
      avatar: user.avatar,
      color: user.color || '#3B82F6',
      role: user.role || 'contributor',
    });
  }

  public triggerCheckpoint(): void {
    // No-op for document checkpointing via socket
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    if (this.cursorEmitDebounceTimer) {
      clearTimeout(this.cursorEmitDebounceTimer);
      this.cursorEmitDebounceTimer = null;
    }

    if (this.socket) {
      try {
        if (this.socket.connected) {
          this.socket.emit('doc:leave', {
            projectId: this.projectId,
            docId: this.pageId,
          });
          this.socket.emit('project:leave', {
            projectId: this.projectId,
          });
        }
        this.socket.disconnect();
      } catch {
        // Socket cleanup error ignored on unmount
      }
      this.socket = null;
    }

    this.awareness.destroy();
  }
}
