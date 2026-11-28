/**
 * server-rebuild.ts
 *
 * Server Yjs initial sync & HTTP-save-while-disconnected document rebuild helpers.
 */

import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import type { Socket } from 'socket.io-client';
import { logger } from '@/shared/lib/logger';
import type { YjsCrossTabBridge } from './cross-tab';
import {
  applyTextDiff,
  encodeMergedYjsUpdates,
  encodeYjsSyncStep1,
} from './awareness-sync';

export interface ServerRebuildContext {
  readonly spaceId: string;
  readonly pageId: string;
  readonly getSocket: () => Socket | null;
  readonly isDestroyed: () => boolean;
  readonly isResyncInFlight: () => boolean;
  readonly setResyncInFlight: (inFlight: boolean) => void;
  readonly getDoc: () => Y.Doc;
  readonly getYText: () => Y.Text;
  readonly getInitialContent: () => string | undefined;
  readonly applySyncFrame: (
    data: Uint8Array | ArrayLike<number>,
    targetDoc: Y.Doc,
    emitStep2Reply: boolean,
  ) => void;
  readonly completeRebuild: (freshDoc: Y.Doc) => void;
  readonly flushPendingUpdates: () => boolean;
  readonly markSynced: () => void;
}

export function executeRebuildFromServer(ctx: ServerRebuildContext): void {
  const socket = ctx.getSocket();
  if (!socket || !socket.connected || ctx.isDestroyed() || ctx.isResyncInFlight()) return;
  ctx.setResyncInFlight(true);

  const freshDoc = new Y.Doc();
  const step1Data = encodeYjsSyncStep1(freshDoc);

  socket.emit(
    'doc:sync:step1',
    { spaceId: ctx.spaceId, docId: ctx.pageId, data: step1Data },
    (res?: { success?: boolean; data?: Uint8Array | ArrayLike<number> | unknown; error?: string }) => {
      ctx.setResyncInFlight(false);
      if (ctx.isDestroyed()) {
        freshDoc.destroy();
        return;
      }
      if (!res?.success) {
        logger.warn('[YjsSocketIOProvider] Server rebuild failed; will retry on reconnect', { error: res?.error });
        freshDoc.destroy();
        return;
      }
      try {
        if (res.data) {
          ctx.applySyncFrame(res.data as Uint8Array | ArrayLike<number>, freshDoc, false);
        }
      } catch (err) {
        logger.warn('[YjsSocketIOProvider] Error applying server state during rebuild', { error: err });
        freshDoc.destroy();
        return;
      }

      ctx.completeRebuild(freshDoc);
    },
  );
}

export function executeInitiateYjsSync(
  ctx: ServerRebuildContext,
  needsServerRebuild: boolean,
): void {
  const socket = ctx.getSocket();
  if (!socket || !socket.connected || ctx.isDestroyed()) return;

  if (needsServerRebuild) {
    executeRebuildFromServer(ctx);
    return;
  }

  const doc = ctx.getDoc();
  const step1Payload = encodeYjsSyncStep1(doc);

  socket.emit(
    'doc:sync:step1',
    {
      spaceId: ctx.spaceId,
      docId: ctx.pageId,
      data: step1Payload,
    },
    (res?: { success?: boolean; data?: Uint8Array | ArrayLike<number> | unknown; error?: string }) => {
      if (ctx.isDestroyed()) return;
      const currentDoc = ctx.getDoc();
      const currentYText = ctx.getYText();
      if (res?.success && res.data) {
        try {
          ctx.applySyncFrame(res.data as Uint8Array | ArrayLike<number>, currentDoc, true);
        } catch (err) {
          logger.warn('[YjsSocketIOProvider] Error processing sync:step2 from server', { error: err });
        }
      }
      const initialContent = ctx.getInitialContent();
      if (currentYText.length === 0 && initialContent) {
        currentDoc.transact(() => {
          currentYText.insert(0, initialContent);
        }, 'local-init');
      }
      ctx.flushPendingUpdates();
      ctx.markSynced();
    },
  );
}

export function swapDocAndAwarenessAfterRebuild(params: {
  freshDoc: Y.Doc;
  oldDoc: Y.Doc;
  oldAwareness: Awareness;
  localDocUpdateHandler: ((update: Uint8Array, origin: unknown) => void) | null;
  flushPendingUpdates: () => boolean;
  rebindListenersAndUser: (newDoc: Y.Doc, newAwareness: Awareness) => void;
  notifyDocReplaced: () => void;
  crossTabBridge: YjsCrossTabBridge | null;
  role: string;
}): void {
  const {
    freshDoc,
    oldDoc,
    oldAwareness,
    localDocUpdateHandler,
    flushPendingUpdates,
    rebindListenersAndUser,
    notifyDocReplaced,
    crossTabBridge,
    role,
  } = params;

  const localText = oldDoc.getText('latex').toString();
  if (localDocUpdateHandler) {
    oldDoc.off('update', localDocUpdateHandler);
  }
  const newYText = freshDoc.getText('latex');
  const newAwareness = new Awareness(freshDoc);
  rebindListenersAndUser(freshDoc, newAwareness);

  if (localText.length > 0 && newYText.toString() !== localText) {
    applyTextDiff(newYText, localText, 'local-resync');
  }
  flushPendingUpdates();
  notifyDocReplaced();
  if (role === 'leader') {
    crossTabBridge?.sendFullSync();
  }
  setTimeout(() => {
    oldAwareness.destroy();
    oldDoc.destroy();
  }, 0);
}

export function emitMergedUpdatesBatch(opts: {
  socket: Socket;
  spaceId: string;
  pageId: string;
  updates: Uint8Array[];
  isDestroyed: () => boolean;
  onFailureRequeue: (mergedData: Uint8Array) => void;
  getPendingCount: () => number;
  onUpdatesAcked?: (pageId: string) => void;
  role: string;
  crossTabBridge: YjsCrossTabBridge | null;
}): void {
  const mergedData = encodeMergedYjsUpdates(opts.updates);
  opts.socket.emit(
    'doc:sync:update',
    {
      spaceId: opts.spaceId,
      docId: opts.pageId,
      data: mergedData,
    },
    (res?: { success?: boolean; error?: string }) => {
      if (!res?.success && !opts.isDestroyed()) {
        logger.warn('[YjsSocketIOProvider] Server rejected doc:sync:update or timed out', { error: res?.error });
        const rawMerged = opts.updates.length === 1 ? opts.updates[0] : Y.mergeUpdates(opts.updates);
        opts.onFailureRequeue(rawMerged);
        return;
      }
      if (res?.success && !opts.isDestroyed() && opts.getPendingCount() === 0) {
        opts.onUpdatesAcked?.(opts.pageId);
        if (opts.role === 'leader') {
          opts.crossTabBridge?.broadcastLeaderAck(opts.pageId);
        }
      }
    },
  );
}
