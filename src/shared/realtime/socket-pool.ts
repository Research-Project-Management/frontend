'use client';

import type { Socket } from 'socket.io-client';
import { memoryGovernor } from '@/shared/lib/memory-governor';
import { createSocket, type ConnectionStatus, type Namespace } from './config';

interface PoolEntry {
  namespace: Namespace;
  socket: Socket;
  refs: number;
  status: ConnectionStatus;
  timer: ReturnType<typeof setTimeout> | null;
}

type StatusObserver = (namespace: Namespace, status: ConnectionStatus) => void;

const DEFAULT_GRACE_MS = 1_500;

/**
 * Singleton + Ref-Counted Object Pool + Observer for Socket.IO namespaces.
 * Guarantees at most 1 multiplexed connection per namespace, graceful route-switch
 * debounce, and safe teardown on user switch or logout.
 */
class SocketPool {
  private readonly entries = new Map<Namespace, PoolEntry>();
  private readonly observers = new Set<StatusObserver>();
  private activeUserId: string | null = null;

  public acquire(namespace: Namespace, userId?: string): Socket {
    if (userId && this.activeUserId && this.activeUserId !== userId) {
      this.disconnectAll();
    }
    if (userId) {
      this.activeUserId = userId;
    }

    const existing = this.entries.get(namespace);
    if (existing) {
      if (existing.timer) {
        clearTimeout(existing.timer);
        existing.timer = null;
      }
      existing.refs += 1;
      if (existing.socket.disconnected) {
        existing.socket.connect();
      }
      return existing.socket;
    }

    const socket = createSocket(namespace);
    const entry: PoolEntry = {
      namespace,
      socket,
      refs: 1,
      status: 'connecting',
      timer: null,
    };

    socket.on('connect', () => this.setStatus(entry, 'connected'));
    socket.on('disconnect', () => this.setStatus(entry, 'offline'));
    socket.io.on('reconnect_attempt', () => this.setStatus(entry, 'reconnecting'));
    socket.io.on('reconnect', () => this.setStatus(entry, 'connected'));

    this.entries.set(namespace, entry);
    this.notify(namespace, entry.status);
    return socket;
  }

  public release(namespace: Namespace, graceMs: number = DEFAULT_GRACE_MS): void {
    const entry = this.entries.get(namespace);
    if (!entry) return;

    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs > 0) return;

    if (graceMs <= 0) {
      this.teardown(entry);
      return;
    }

    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      if (entry.refs === 0) this.teardown(entry);
    }, graceMs);
  }

  public getStatus(namespace: Namespace): ConnectionStatus {
    return this.entries.get(namespace)?.status ?? 'idle';
  }

  public onStatus(observer: StatusObserver): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  public get size(): number {
    return this.entries.size;
  }

  public disconnectAll(): void {
    this.activeUserId = null;
    for (const entry of Array.from(this.entries.values())) {
      this.teardown(entry);
    }
  }

  private teardown(entry: PoolEntry): void {
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.socket.removeAllListeners();
    entry.socket.disconnect();
    this.entries.delete(entry.namespace);
    this.notify(entry.namespace, 'idle');
  }

  private setStatus(entry: PoolEntry, next: ConnectionStatus): void {
    if (entry.status === next) return;
    entry.status = next;
    this.notify(entry.namespace, next);
  }

  private notify(namespace: Namespace, status: ConnectionStatus): void {
    for (const observer of Array.from(this.observers)) {
      try {
        observer(namespace, status);
      } catch {
        // Isolate observer errors
      }
    }
  }
}

export const socketPool = new SocketPool();

memoryGovernor.register({
  id: 'realtime-socket-pool',
  domain: 'global',
  priority: 10,
  reclaim: ({ level }) => {
    if (level === 'logout') {
      const count = socketPool.size;
      socketPool.disconnectAll();
      return count;
    }
    return 0;
  },
  getStats: () => ({
    id: 'realtime-socket-pool',
    domain: 'global',
    entryCount: socketPool.size,
  }),
});
