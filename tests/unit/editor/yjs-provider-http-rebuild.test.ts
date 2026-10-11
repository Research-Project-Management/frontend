import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

type Handler = (...args: any[]) => void;

/** Fake socket backed by a server-side Y.Doc that mimics the backend sync handlers. */
class ServerBackedSocket {
  connected = false;
  handlers = new Map<string, Handler[]>();
  constructor(public server: Y.Doc) {}
  on(event: string, cb: Handler) {
    const list = this.handlers.get(event) ?? [];
    list.push(cb);
    this.handlers.set(event, list);
    return this;
  }
  off() {
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
  emit(event: string, payload?: any, ack?: Handler) {
    if (!this.connected) return this;
    if (event === 'doc:join') ack?.({ success: true, docPresence: [] });
    if (event === 'doc:sync-step-1' || event === 'doc:sync-step-2' || event === 'doc:sync-update') {
      const decoder = decoding.createDecoder(new Uint8Array(payload.data));
      const reply = encoding.createEncoder();
      while (decoding.hasContent(decoder)) {
        syncProtocol.readSyncMessage(decoder, reply, this.server, 'client');
      }
      if (event === 'doc:sync-step-1') ack?.({ success: true, data: encoding.toUint8Array(reply) });
    }
    return this;
  }
  fire(event: string, ...args: any[]) {
    for (const h of this.handlers.get(event) ?? []) h(...args);
  }
  goOnline() {
    this.connected = true;
    this.fire('connect');
  }
  goOffline() {
    this.connected = false;
    this.fire('disconnect');
  }
}

let fake: ServerBackedSocket;
vi.mock('socket.io-client', () => ({
  // Resolve lazily via globalThis: test files share module cache (isolate: false).
  io: vi.fn(() => (globalThis as any).__fluxFakeSocket),
  default: vi.fn(() => (globalThis as any).__fluxFakeSocket),
}));

import {
  getOrCreateYjsProvider,
  releaseYjsProvider,
  markHttpSavedWhileDisconnected,
  applyTextDiff,
  clearYjsProviderPool,
} from '@/features/editor/sdk/realtime/yjs-socket-provider';

/** Backend REST PUT behaviour: prefix/suffix splice into the live server Y.Doc. */
function restPut(server: Y.Doc, content: string) {
  applyTextDiff(server.getText('latex'), content, 'rest');
}

let n = 0;
describe('YjsSocketIOProvider HTTP-save-while-disconnected rebuild', () => {
  beforeEach(() => {
    clearYjsProviderPool();
    const server = new Y.Doc();
    server.getText('latex').insert(0, 'hello');
    fake = new ServerBackedSocket(server);
    (globalThis as any).__fluxFakeSocket = fake;
  });

  afterEach(() => {
    clearYjsProviderPool();
    (globalThis as any).__fluxFakeSocket = undefined;
  });

  it('offline edit -> HTTP save -> reconnect: server text == client text, no duplication', () => {
    const pageId = `doc-rebuild-${n++}`;
    const provider = getOrCreateYjsProvider('p', pageId, {});
    fake.goOnline();
    expect(provider.yText.toString()).toBe('hello');

    fake.goOffline();
    provider.yText.insert(5, ' world'); // offline edit (queued Yjs item)
    restPut(fake.server, 'hello world'); // client HTTP autosave reaches backend splice
    markHttpSavedWhileDisconnected(pageId);
    expect(provider.needsServerRebuild).toBe(true);

    const replaced = vi.fn();
    provider.onDocReplaced(replaced);
    fake.goOnline();

    expect(replaced).toHaveBeenCalledTimes(1);
    expect(fake.server.getText('latex').toString()).toBe('hello world');
    expect(provider.yText.toString()).toBe('hello world');
    expect(provider.needsServerRebuild).toBe(false);
    releaseYjsProvider('p', pageId);
  });

  it('edits typed after the HTTP save are re-applied once, not lost or duplicated', () => {
    const pageId = `doc-rebuild-${n++}`;
    const provider = getOrCreateYjsProvider('p', pageId, {});
    fake.goOnline();
    fake.goOffline();
    provider.yText.insert(5, ' world');
    restPut(fake.server, 'hello world');
    markHttpSavedWhileDisconnected(pageId);
    provider.yText.insert(provider.yText.length, '!'); // typed after save, still offline

    fake.goOnline();
    expect(provider.yText.toString()).toBe('hello world!');
    expect(fake.server.getText('latex').toString()).toBe('hello world!');

    // Subsequent online edits on the rebuilt doc still sync normally.
    provider.yText.insert(0, '> ');
    provider.flushPendingUpdates();
    expect(fake.server.getText('latex').toString()).toBe('> hello world!');
    releaseYjsProvider('p', pageId);
  });

  it('without an HTTP save the normal queue/sync path is kept', () => {
    const pageId = `doc-rebuild-${n++}`;
    const provider = getOrCreateYjsProvider('p', pageId, {});
    fake.goOnline();
    const docBefore = provider.doc;
    fake.goOffline();
    provider.yText.insert(5, ' offline');
    fake.goOnline();
    expect(provider.doc).toBe(docBefore);
    expect(fake.server.getText('latex').toString()).toBe('hello offline');
    releaseYjsProvider('p', pageId);
  });

  it('markHttpSaved while connected does not trigger a rebuild', () => {
    const pageId = `doc-rebuild-${n++}`;
    const provider = getOrCreateYjsProvider('p', pageId, {});
    fake.goOnline();
    markHttpSavedWhileDisconnected(pageId);
    expect(provider.needsServerRebuild).toBe(false);
    releaseYjsProvider('p', pageId);
  });
});
