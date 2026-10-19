import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as decoding from 'lib0/decoding';

type Handler = (...args: any[]) => void;

class FakeSocket {
  connected = false;
  handlers = new Map<string, Handler[]>();
  emitted: Array<{ event: string; payload: any }> = [];
  on(event: string, cb: Handler) {
    const list = this.handlers.get(event) ?? [];
    list.push(cb);
    this.handlers.set(event, list);
    return this;
  }
  off() {
    return this;
  }
  emit(event: string, payload?: any, ack?: Handler) {
    this.emitted.push({ event, payload });
    if (event === 'doc:join') ack?.({ success: true, docPresence: [] });
    if (event === 'doc:sync:step1') ack?.({ success: false });
    return this;
  }
  connect() {
    return this;
  }
  disconnect() {
    this.connected = false;
    return this;
  }
  removeAllListeners() {
    return this;
  }
  fire(event: string, ...args: any[]) {
    for (const h of this.handlers.get(event) ?? []) h(...args);
  }
}

let fake: FakeSocket;
vi.mock('socket.io-client', () => ({
  // Resolve lazily via globalThis: test files share module cache (isolate: false).
  io: vi.fn(() => (globalThis as any).__fluxFakeSocket),
  default: vi.fn(() => (globalThis as any).__fluxFakeSocket),
}));

import { YjsSocketIOProvider, clearYjsProviderPool } from '@/features/editor/sdk/realtime/yjs-socket-provider';

function decodeUpdatesInto(target: Y.Doc, emitted: Array<{ event: string; payload: any }>) {
  for (const e of emitted.filter((x) => x.event === 'doc:sync:update')) {
    const decoder = decoding.createDecoder(e.payload.data);
    syncProtocol.readSyncMessage(decoder, { } as any, target, 'test');
  }
}

describe('YjsSocketIOProvider offline update queue', () => {
  beforeEach(() => {
    clearYjsProviderPool();
    fake = new FakeSocket();
    (globalThis as any).__fluxFakeSocket = fake;
  });

  afterEach(() => {
    clearYjsProviderPool();
    (globalThis as any).__fluxFakeSocket = undefined;
  });

  it('queues local updates while disconnected and flushes them after reconnect', () => {
    const statuses: string[] = [];
    const provider = new YjsSocketIOProvider('p1', 'd1', undefined, {});
    const unsub = provider.subscribeStatus((s) => statuses.push(s));

    // Socket never connected: edits must be retained, not dropped.
    provider.yText.insert(0, 'offline edit');
    expect(provider.pendingUpdateCount).toBeGreaterThan(0);
    expect(fake.emitted.filter((e) => e.event === 'doc:sync:update')).toHaveLength(0);

    // Reconnect
    fake.connected = true;
    fake.fire('connect');
    expect(statuses).toContain('connected');
    expect(provider.pendingUpdateCount).toBe(0);

    const remote = new Y.Doc();
    decodeUpdatesInto(remote, fake.emitted);
    const key = Array.from(provider.doc.share.keys())[0];
    expect(remote.getText(key).toString()).toBe('offline edit');

    // Disconnect status reaches subscribers
    fake.connected = false;
    fake.fire('disconnect');
    expect(statuses[statuses.length - 1]).toBe('disconnected');
    unsub();
    provider.destroy();
  });

  it('flushed update reproduces the exact offline document on the server side', () => {
    const provider = new YjsSocketIOProvider('p1', 'd2', undefined, {});
    provider.yText.insert(0, 'abc');
    provider.yText.insert(3, 'def');
    fake.connected = true;
    fake.fire('connect');
    const updates = fake.emitted.filter((e) => e.event === 'doc:sync:update');
    expect(updates.length).toBe(1);
    const server = new Y.Doc();
    decodeUpdatesInto(server, fake.emitted);
    // Apply to a doc sharing the same text key as provider
    const key = Array.from(provider.doc.share.keys())[0];
    expect(server.getText(key).toString()).toBe('abcdef');
    provider.destroy();
  });
});
