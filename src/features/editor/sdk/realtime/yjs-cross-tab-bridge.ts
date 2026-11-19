/**
 * yjs-cross-tab-bridge.ts
 *
 * Browser Cross-Tab CRDT Mesh & Single-Socket Leader-Follower Multiplexer
 * Built on native `BroadcastChannel` + W3C Web Locks (`navigator.locks`).
 *
 * Guarantees:
 * 1. Offline & Online Same-Machine Consistency: Multiple browser tabs open to the same
 *    document exchange Yjs updates (`doc-update`, `sync-step1`, `sync-step2`) over
 *    `BroadcastChannel`, preventing offline split-brain overwrites.
 * 2. Leader-Follower Socket Multiplexing: Only ONE browser tab (the WebLock holder)
 *    opens a Socket.IO connection per `(user, spaceId, pageId)`. Follower tabs tunnel
 *    Yjs updates and awareness cursors through the Leader and transparently promote if
 *    the Leader closes or crashes.
 */

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { uuidv7 } from '@/shared/utils/uuid.util';
import type { CollaborationPresence } from '../pages/types';
import {
  encodeYjsSyncStep1,
  type ConnectionStatus,
  type RemoteCursorData,
} from './yjs-awareness-sync';

export type CrossTabProviderRole = 'standalone' | 'leader' | 'follower';

export type YjsCrossTabMessage =
  | { type: 'sync-step1'; senderId: string; data: Uint8Array }
  | { type: 'sync-step2'; senderId: string; targetId?: string; data: Uint8Array }
  | { type: 'doc-update'; senderId: string; data: Uint8Array; fromServer: boolean }
  | { type: 'follower-hello'; senderId: string }
  | {
      type: 'leader-status';
      senderId: string;
      status: ConnectionStatus;
      isSynced: boolean;
      collaborators: CollaborationPresence[];
    }
  | { type: 'leader-ack'; senderId: string; docId: string }
  | { type: 'remote-event'; senderId: string; eventName: string; payload: unknown }
  | { type: 'follower-cursor'; senderId: string; cursor: RemoteCursorData };

export interface YjsCrossTabBridgeOptions {
  spaceId: string;
  pageId: string;
  userId?: string;
  getDoc: () => Y.Doc;
  broadcastChannelFactory?: (name: string) => BroadcastChannel;
  locksApi?: { request: LockManager['request'] };
  enableMultiplexing: boolean;
  onPeerDocUpdate: (update: Uint8Array, fromServer: boolean) => void;
  onBecameLeader: () => void;
  onBecameFollower: () => void;
  onFollowerHello: (followerId: string) => void;
  onLeaderStatus: (
    status: ConnectionStatus,
    isSynced: boolean,
    collaborators: CollaborationPresence[],
  ) => void;
  onLeaderAck: (docId: string) => void;
  onRemoteEvent: (eventName: string, payload: unknown) => void;
  onFollowerCursor: (cursor: RemoteCursorData) => void;
}

function toUint8Array(data: unknown): Uint8Array | null {
  if (!data) return null;
  if (data instanceof Uint8Array) return data;
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return new Uint8Array(data);
  }
  return null;
}

export class YjsCrossTabBridge {
  public readonly instanceId: string = uuidv7();
  public readonly channelName: string;
  public readonly lockName: string;

  private channel: BroadcastChannel | null = null;
  private role: CrossTabProviderRole = 'standalone';
  private disposed = false;
  private releaseLeaderLock: (() => void) | null = null;
  private readonly abortController = new AbortController();

  constructor(private readonly options: YjsCrossTabBridgeOptions) {
    const userKey = options.userId || 'anon';
    this.channelName = `flux:yjs:v1:${userKey}:${options.spaceId}:${options.pageId}`;
    this.lockName = `flux:yjs:leader:${userKey}:${options.spaceId}:${options.pageId}`;

    this.initChannel();
    if (options.enableMultiplexing && options.locksApi?.request) {
      this.role = 'follower';
      this.startLeaderElection();
    } else {
      this.role = 'standalone';
      options.onBecameLeader();
    }
  }

  public getRole(): CrossTabProviderRole {
    return this.role;
  }

  private initChannel(): void {
    try {
      const ch = this.options.broadcastChannelFactory
        ? this.options.broadcastChannelFactory(this.channelName)
        : typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined'
          ? new BroadcastChannel(this.channelName)
          : null;
      if (!ch) return;

      this.channel = ch;
      ch.onmessage = (event: MessageEvent<YjsCrossTabMessage>) => {
        if (this.disposed) return;
        const msg = event?.data;
        if (!msg || typeof msg !== 'object' || msg.senderId === this.instanceId) {
          return;
        }
        this.handleMessage(msg);
      };

      // Request missing CRDT state from any already-open sibling tab (online or offline)
      const step1 = encodeYjsSyncStep1(this.options.getDoc());
      this.post({
        type: 'sync-step1',
        senderId: this.instanceId,
        data: step1,
      });
    } catch (err) {
      console.warn('[YjsCrossTabBridge] BroadcastChannel init failed:', err);
    }
  }

  private handleMessage(msg: YjsCrossTabMessage): void {
    const doc = this.options.getDoc();

    switch (msg.type) {
      case 'sync-step1': {
        const bytes = toUint8Array(msg.data);
        if (!bytes) return;
        try {
          const decoder = decoding.createDecoder(bytes);
          const replyEncoder = encoding.createEncoder();
          syncProtocol.readSyncMessage(decoder, replyEncoder, doc, 'broadcast-channel');
          if (encoding.length(replyEncoder) > 0) {
            this.post({
              type: 'sync-step2',
              senderId: this.instanceId,
              targetId: msg.senderId,
              data: encoding.toUint8Array(replyEncoder),
            });
          }
        } catch {
          // Ignore malformed peer sync frame
        }
        break;
      }

      case 'sync-step2': {
        if (msg.targetId && msg.targetId !== this.instanceId) return;
        const bytes = toUint8Array(msg.data);
        if (!bytes) return;
        try {
          const decoder = decoding.createDecoder(bytes);
          const encoder = encoding.createEncoder();
          syncProtocol.readSyncMessage(decoder, encoder, doc, 'broadcast-channel');
        } catch {
          // Ignore malformed peer sync-step2 frame
        }
        break;
      }

      case 'doc-update': {
        const bytes = toUint8Array(msg.data);
        if (!bytes) return;
        this.options.onPeerDocUpdate(bytes, Boolean(msg.fromServer));
        break;
      }

      case 'follower-hello': {
        if (this.role === 'leader') {
          this.options.onFollowerHello(msg.senderId);
        }
        break;
      }

      case 'leader-status': {
        if (this.role === 'follower') {
          this.options.onLeaderStatus(
            msg.status,
            msg.isSynced,
            Array.isArray(msg.collaborators) ? msg.collaborators : [],
          );
        }
        break;
      }

      case 'leader-ack': {
        if (this.role === 'follower') {
          this.options.onLeaderAck(msg.docId);
        }
        break;
      }

      case 'remote-event': {
        if (this.role === 'follower') {
          this.options.onRemoteEvent(msg.eventName, msg.payload);
        }
        break;
      }

      case 'follower-cursor': {
        if (this.role === 'leader') {
          this.options.onFollowerCursor(msg.cursor);
        }
        break;
      }
    }
  }

  private startLeaderElection(): void {
    const locksApi = this.options.locksApi;
    if (!locksApi?.request) {
      this.role = 'standalone';
      this.options.onBecameLeader();
      return;
    }

    const acquireQueuedLeaderLock = () => {
      if (this.disposed) return;
      void locksApi
        .request(
          this.lockName,
          { mode: 'exclusive', signal: this.abortController.signal },
          async () => {
            if (this.disposed) return;
            this.role = 'leader';
            this.options.onBecameLeader();
            await new Promise<void>((resolve) => {
              this.releaseLeaderLock = resolve;
            });
          },
        )
        .catch((err: unknown) => {
          const name = (err as { name?: string })?.name;
          if (!this.disposed && name !== 'AbortError') {
            console.warn('[YjsCrossTabBridge] Leader promotion wait failed:', err);
          }
        });
    };

    void locksApi
      .request(this.lockName, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
        if (this.disposed) return;
        if (lock) {
          this.role = 'leader';
          this.options.onBecameLeader();
          await new Promise<void>((resolve) => {
            this.releaseLeaderLock = resolve;
          });
        } else {
          this.role = 'follower';
          this.options.onBecameFollower();
          this.post({ type: 'follower-hello', senderId: this.instanceId });
          acquireQueuedLeaderLock();
        }
      })
      .catch((err: unknown) => {
        if (!this.disposed) {
          console.warn('[YjsCrossTabBridge] Initial leader election error:', err);
          this.role = 'standalone';
          this.options.onBecameLeader();
        }
      });
  }

  private post(message: YjsCrossTabMessage): void {
    if (this.disposed || !this.channel) return;
    try {
      this.channel.postMessage(message);
    } catch {
      // Ignore closed channel or serialization error
    }
  }

  public broadcastDocUpdate(update: Uint8Array, fromServer: boolean): void {
    this.post({
      type: 'doc-update',
      senderId: this.instanceId,
      data: update,
      fromServer,
    });
  }

  public sendFullSync(targetId?: string): void {
    const doc = this.options.getDoc();
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep2(encoder, doc);
    this.post({
      type: 'sync-step2',
      senderId: this.instanceId,
      ...(targetId ? { targetId } : {}),
      data: encoding.toUint8Array(encoder),
    });
  }

  public sendFullSyncToFollower(targetId: string): void {
    this.sendFullSync(targetId);
  }

  public broadcastLeaderStatus(
    status: ConnectionStatus,
    isSynced: boolean,
    collaborators: CollaborationPresence[],
  ): void {
    this.post({
      type: 'leader-status',
      senderId: this.instanceId,
      status,
      isSynced,
      collaborators,
    });
  }

  public broadcastLeaderAck(docId: string): void {
    this.post({
      type: 'leader-ack',
      senderId: this.instanceId,
      docId,
    });
  }

  public broadcastRemoteEvent(eventName: string, payload: unknown): void {
    this.post({
      type: 'remote-event',
      senderId: this.instanceId,
      eventName,
      payload,
    });
  }

  public sendFollowerCursor(cursor: RemoteCursorData): void {
    this.post({
      type: 'follower-cursor',
      senderId: this.instanceId,
      cursor,
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const release = this.releaseLeaderLock;
    this.releaseLeaderLock = null;
    if (release) {
      release();
    }
    try {
      this.abortController.abort();
    } catch {
      // Ignore abort error
    }
    if (this.channel) {
      try {
        this.channel.close();
      } catch {
        // Ignore close error
      }
      this.channel = null;
    }
  }
}
