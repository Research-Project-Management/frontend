import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as decoding from 'lib0/decoding';
import {
  useSettingsStore,
  useWorkspaceStore,
  usePageStore,
  useConnectivityStore,
  sessionCoordinator,
  lruDocumentCache,
  editorCommandBus,
  EDITOR_STORAGE_KEYS,
  getSyncTexChannelName,
} from '@/features/editor/core';
import { YjsSocketIOProvider } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { DetachedPreviewBridge } from '@/features/editor/subsystems/navigation/coordinator/detached-preview.bridge';
import { multiTabBus } from '@/shared/lib/multi-tab';

class MockBroadcastChannel {
  public readonly name: string;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  private closed = false;
  private static readonly channels = new Map<string, Set<MockBroadcastChannel>>();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(data: unknown): void {
    if (this.closed) return;
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of Array.from(peers)) {
      if (peer !== this && !peer.closed) {
        queueMicrotask(() => {
          if (!peer.closed && peer.onmessage) {
            peer.onmessage({ data } as MessageEvent);
          }
        });
      }
    }
  }

  close(): void {
    this.closed = true;
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  static reset(): void {
    for (const set of MockBroadcastChannel.channels.values()) {
      for (const ch of set) {
        ch.closed = true;
      }
    }
    MockBroadcastChannel.channels.clear();
  }
}

class MockLocksManager {
  private readonly held = new Set<string>();
  private readonly waiters = new Map<string, Array<() => void>>();

  request = async <T,>(
    name: string,
    optionsOrCb: LockOptions | ((lock: Lock | null) => Promise<T> | T),
    maybeCb?: (lock: Lock | null) => Promise<T> | T,
  ): Promise<T> => {
    const options: LockOptions =
      typeof optionsOrCb === 'function' ? {} : optionsOrCb;
    const cb = (typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb)!;

    if (options.ifAvailable) {
      if (this.held.has(name)) {
        return await cb(null);
      }
      this.held.add(name);
      try {
        return await cb({ name, mode: options.mode ?? 'exclusive' } as Lock);
      } finally {
        this.release(name);
      }
    }

    if (this.held.has(name)) {
      if (options.signal?.aborted) {
        throw new DOMException('The request was aborted.', 'AbortError');
      }
      await new Promise<void>((resolve, reject) => {
        const list = this.waiters.get(name) ?? [];
        const entry = () => {
          options.signal?.removeEventListener('abort', onAbort);
          resolve();
        };
        const onAbort = () => {
          const idx = list.indexOf(entry);
          if (idx !== -1) list.splice(idx, 1);
          reject(new DOMException('The request was aborted.', 'AbortError'));
        };
        options.signal?.addEventListener('abort', onAbort, { once: true });
        list.push(entry);
        this.waiters.set(name, list);
      });
    }

    this.held.add(name);
    try {
      return await cb({ name, mode: options.mode ?? 'exclusive' } as Lock);
    } finally {
      this.release(name);
    }
  };

  private release(name: string): void {
    this.held.delete(name);
    const list = this.waiters.get(name);
    if (list && list.length > 0) {
      const next = list.shift()!;
      if (list.length === 0) {
        this.waiters.delete(name);
      }
      queueMicrotask(next);
    }
  }
}

interface FakeRealtimeSocket {
  id: string;
  connected: boolean;
  handlers: Map<string, Array<(...args: unknown[]) => void>>;
  emitted: Array<{ event: string; payload: unknown; ack?: (res: unknown) => void }>;
  on(event: string, fn: (...args: unknown[]) => void): void;
  emit(event: string, payload: unknown, ack?: (res: unknown) => void): void;
  connect(): void;
  disconnect(): void;
  removeAllListeners(): void;
  fireServerEvent(event: string, payload?: unknown): void;
}

function createFakeRealtimeSocket(id: string): FakeRealtimeSocket {
  const sock: FakeRealtimeSocket = {
    id,
    connected: false,
    handlers: new Map(),
    emitted: [],
    on(event, fn) {
      const list = sock.handlers.get(event) ?? [];
      list.push(fn);
      sock.handlers.set(event, list);
    },
    emit(event, payload, ack) {
      sock.emitted.push({ event, payload, ack });
      if ((event === 'doc:join' || event === 'project:join') && ack) {
        ack({ success: true });
      }
    },
    connect() {
      sock.connected = true;
      sock.fireServerEvent('connect');
    },
    disconnect() {
      sock.connected = false;
      sock.fireServerEvent('disconnect');
    },
    removeAllListeners() {
      sock.handlers.clear();
    },
    fireServerEvent(event, payload) {
      const list = sock.handlers.get(event) ?? [];
      for (const fn of list) {
        fn(payload);
      }
    },
  };
  queueMicrotask(() => {
    sock.connected = true;
    sock.fireServerEvent('connect');
  });
  return sock;
}

const flushMicrotasks = async (ticks = 6): Promise<void> => {
  for (let i = 0; i < ticks; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

describe('Editor Browser Multi-Tab Hardening (Multiplexing, Offline CRDT, Settings & SyncTeX Scope)', () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  beforeEach(() => {
    MockBroadcastChannel.reset();
    lruDocumentCache.clear();
    sessionCoordinator.resetSession();
    useConnectivityStore.setState({
      isOnline: true,
      syncStatus: 'synced',
      pendingSaveCount: 0,
      pendingMutationsCount: 0,
    });
    usePageStore.setState({
      spaceId: '',
      projectId: '',
      rootPageId: '',
      parentPageId: '',
      currentPage: null,
      activeFilePage: null,
      activePageId: null,
    });
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
    globalThis.BroadcastChannel = originalBroadcastChannel;
    vi.restoreAllMocks();
    lruDocumentCache.clear();
    sessionCoordinator.resetSession();
  });

  describe('1. Single-Socket Leader-Follower Multiplexing & Failover Promotion', () => {
    it('shares a single Socket.IO connection across 3 tabs, relays edits/acks/events, and fails over on leader close', async () => {
      const locks = new MockLocksManager();
      const createdSockets: FakeRealtimeSocket[] = [];
      const socketFactory = vi.fn(() => {
        const s = createFakeRealtimeSocket(`sock-${createdSockets.length + 1}`);
        createdSockets.push(s);
        return s as unknown as ReturnType<
          NonNullable<ConstructorParameters<typeof YjsSocketIOProvider>[3]['socketFactory']>
        >;
      });

      const bus1Messages: unknown[] = [];
      const bus2Messages: unknown[] = [];
      const bus3Messages: unknown[] = [];
      const makeBus = (sink: unknown[]) =>
        ({
          dispatch: vi.fn((cmd: unknown) => {
            sink.push(cmd);
          }),
          subscribe: vi.fn(() => () => {}),
        }) as unknown as ConstructorParameters<typeof YjsSocketIOProvider>[3]['commandBus'];

      const ack1 = vi.fn();
      const ack2 = vi.fn();

      const sharedOpts = {
        user: { id: 'user-1', name: 'Researcher' },
        enableCrossTabSync: true,
        enableCrossTabMultiplexing: true,
        broadcastChannelFactory: (name: string) =>
          new MockBroadcastChannel(name) as unknown as BroadcastChannel,
        locksApi: locks,
        socketFactory,
      };

      const tab1 = new YjsSocketIOProvider('space-1', 'doc-1', new Y.Doc(), {
        ...sharedOpts,
        commandBus: makeBus(bus1Messages),
        onUpdatesAcked: ack1,
      });
      await flushMicrotasks();

      const tab2 = new YjsSocketIOProvider('space-1', 'doc-1', new Y.Doc(), {
        ...sharedOpts,
        commandBus: makeBus(bus2Messages),
        onUpdatesAcked: ack2,
      });
      const tab3 = new YjsSocketIOProvider('space-1', 'doc-1', new Y.Doc(), {
        ...sharedOpts,
        commandBus: makeBus(bus3Messages),
      });
      await flushMicrotasks();

      // Strictly 1 WebSocket connection for all 3 tabs
      expect(socketFactory).toHaveBeenCalledTimes(1);
      expect(tab1.role).toBe('leader');
      expect(tab2.role).toBe('follower');
      expect(tab3.role).toBe('follower');

      // Follower tab2 types -> synced across tab1 & tab3 + batched over tab1's socket
      tab2.yText.insert(0, '\\section{Introduction}\n');
      await new Promise((resolve) => setTimeout(resolve, 40));

      expect(tab1.yText.toString()).toBe('\\section{Introduction}\n');
      expect(tab3.yText.toString()).toBe('\\section{Introduction}\n');

      const emittedUpdate = createdSockets[0].emitted.find(
        (e) => e.event === 'doc:sync:update',
      );
      expect(emittedUpdate).toBeDefined();

      // Verify binary Yjs update sent by Leader contains Follower's edit
      const serverCheckDoc = new Y.Doc();
      const decoder = decoding.createDecoder(
        (emittedUpdate!.payload as { data: Uint8Array }).data,
      );
      syncProtocol.readSyncMessage(decoder, {} as never, serverCheckDoc, 'server');
      expect(serverCheckDoc.getText('latex').toString()).toBe('\\section{Introduction}\n');
      serverCheckDoc.destroy();

      // Server ACKs Leader -> Follower also receives onUpdatesAcked
      emittedUpdate!.ack?.({ success: true });
      await flushMicrotasks();
      expect(ack1).toHaveBeenCalledWith('doc-1');
      expect(ack2).toHaveBeenCalledWith('doc-1');

      // Server pushes fileTree:update on Leader socket -> relayed to Followers
      createdSockets[0].fireServerEvent('fileTree:update', { action: 'created', nodeId: 'n1' });
      await flushMicrotasks();
      expect(bus1Messages).toContainEqual({
        type: 'filetree:updated',
        payload: { action: 'created', nodeId: 'n1' },
      });
      expect(bus2Messages).toContainEqual({
        type: 'filetree:updated',
        payload: { action: 'created', nodeId: 'n1' },
      });
      expect(bus3Messages).toContainEqual({
        type: 'filetree:updated',
        payload: { action: 'created', nodeId: 'n1' },
      });

      // Close Leader (tab1) -> WebLock fails over seamlessly to tab2!
      tab1.destroy({ skipFlush: true });
      await flushMicrotasks(8);

      expect(tab2.role).toBe('leader');
      expect(tab3.role).toBe('follower');
      expect(socketFactory).toHaveBeenCalledTimes(2);

      // Edits in tab3 still route through promoted Leader tab2 -> Socket #2
      tab3.yText.insert(tab3.yText.length, 'Next paragraph.');
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(tab2.yText.toString()).toBe('\\section{Introduction}\nNext paragraph.');
      expect(
        createdSockets[1].emitted.some((e) => e.event === 'doc:sync:update'),
      ).toBe(true);

      tab2.destroy({ skipFlush: true });
      tab3.destroy({ skipFlush: true });
    });
  });

  describe('2. Offline Split-Brain CRDT Merge & Outbox Counter Sync', () => {
    it('converges concurrent offline Yjs edits across tabs with zero data loss and syncs outbox count', async () => {
      const locks = new MockLocksManager();
      const offlineSocket = (): FakeRealtimeSocket => ({
        id: 'sock-offline',
        connected: false,
        handlers: new Map(),
        emitted: [],
        on(event, fn) {
          const list = this.handlers.get(event) ?? [];
          list.push(fn);
          this.handlers.set(event, list);
        },
        emit: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        removeAllListeners: vi.fn(),
        fireServerEvent: vi.fn(),
      });

      const sharedOpts = {
        user: { id: 'user-off', name: 'Offline Author' },
        enableCrossTabSync: true,
        enableCrossTabMultiplexing: true,
        broadcastChannelFactory: (name: string) =>
          new MockBroadcastChannel(name) as unknown as BroadcastChannel,
        locksApi: locks,
        socketFactory: () =>
          offlineSocket() as unknown as ReturnType<
            NonNullable<ConstructorParameters<typeof YjsSocketIOProvider>[3]['socketFactory']>
          >,
      };

      const docA = new Y.Doc();
      docA.getText('latex').insert(0, 'Alpha Omega');
      const tabA = new YjsSocketIOProvider('space-off', 'doc-off', docA, sharedOpts);
      await flushMicrotasks();

      const docB = new Y.Doc();
      const tabB = new YjsSocketIOProvider('space-off', 'doc-off', docB, sharedOpts);
      await flushMicrotasks();

      expect(tabB.yText.toString()).toBe('Alpha Omega');

      // Concurrent offline edits on different positions
      tabA.yText.insert(5, ' Beta');
      tabB.yText.insert(tabB.yText.length, '!');
      await flushMicrotasks();

      expect(tabA.yText.toString()).toBe('Alpha Beta Omega!');
      expect(tabB.yText.toString()).toBe('Alpha Beta Omega!');

      // Outbox mutation count & offline draft broadcast update sibling connectivity store & clean cache
      multiTabBus.dispatchSyntheticMessageForTesting({
        type: 'OFFLINE_OUTBOX_MUTATED',
        action: 'ENQUEUED',
        count: 4,
        senderTabId: 'remote-tab-x',
        timestamp: Date.now(),
      });
      expect(useConnectivityStore.getState().pendingMutationsCount).toBe(4);

      multiTabBus.dispatchSyntheticMessageForTesting({
        type: 'OFFLINE_OUTBOX_MUTATED',
        action: 'FLUSHED',
        count: 0,
        senderTabId: 'remote-tab-x',
        timestamp: Date.now(),
      });
      expect(useConnectivityStore.getState().pendingMutationsCount).toBe(0);
      expect(useConnectivityStore.getState().syncStatus).toBe('synced');

      // Clean non-Yjs unsynced edit sync
      lruDocumentCache.registerModel('doc-plain', { content: 'old content' });
      const cmdSpy = vi.spyOn(editorCommandBus, 'dispatch');
      multiTabBus.dispatchSyntheticMessageForTesting({
        type: 'EDITOR_UNSYNCED_EDIT_UPDATED',
        fileId: 'doc-plain',
        content: 'updated offline draft',
        updatedAt: Date.now(),
        senderTabId: 'remote-tab-x',
        timestamp: Date.now(),
      });
      expect(lruDocumentCache.getModel('doc-plain')?.content).toBe('updated offline draft');
      expect(cmdSpy).toHaveBeenCalledWith({
        type: 'editor:set-content',
        fileId: 'doc-plain',
        content: 'updated offline draft',
      });

      tabA.destroy({ skipFlush: true });
      tabB.destroy({ skipFlush: true });
    });
  });

  describe('3. Cross-Tab Settings Rehydration & Window-Isolated isPdfDetached', () => {
    it('rehydrates useSettingsStore on cross-tab StorageEvent while preserving transient fields and keeping isPdfDetached per-window', async () => {
      useSettingsStore.setState({
        fontSize: 15,
        engine: 'pdflatex',
        settingsPanelOpen: true,
      });

      const raw = window.localStorage.getItem(EDITOR_STORAGE_KEYS.SETTINGS);
      const parsed = raw ? (JSON.parse(raw) as { state: Record<string, unknown>; version: number }) : { state: {}, version: 3 };
      const updatedJson = JSON.stringify({
        ...parsed,
        state: {
          ...parsed.state,
          fontSize: 19,
          engine: 'xelatex',
        },
      });
      window.localStorage.setItem(EDITOR_STORAGE_KEYS.SETTINGS, updatedJson);

      window.dispatchEvent(
        new StorageEvent('storage', {
          key: EDITOR_STORAGE_KEYS.SETTINGS,
          newValue: updatedJson,
        }),
      );
      await flushMicrotasks();

      expect(useSettingsStore.getState().fontSize).toBe(19);
      expect(useSettingsStore.getState().engine).toBe('xelatex');
      // Transient UI state not overwritten
      expect(useSettingsStore.getState().settingsPanelOpen).toBe(true);

      // Window-isolated isPdfDetached is never persisted in WORKBENCH_LAYOUT localStorage
      useWorkspaceStore.getState().setPdfDetached(true);
      const layoutRaw = window.localStorage.getItem(EDITOR_STORAGE_KEYS.WORKBENCH_LAYOUT) ?? '{}';
      const layoutParsed = JSON.parse(layoutRaw) as { state?: Record<string, unknown> };
      expect(layoutParsed.state?.isPdfDetached).toBeUndefined();
    });
  });

  describe('4. Project/Page-Scoped Detached PDF SyncTeX Channel Isolation', () => {
    it('isolates SyncTeX BroadcastChannel by page/project scope so two open papers never cross-talk', async () => {
      expect(getSyncTexChannelName('page-alpha')).toBe('flux-synctex-bus:page-alpha');
      expect(getSyncTexChannelName('page-beta')).toBe('flux-synctex-bus:page-beta');

      globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;

      usePageStore.setState({
        projectId: 'proj-alpha',
        parentPageId: 'page-alpha',
      });

      const onJumpToCode = vi.fn();
      const bridge = new DetachedPreviewBridge({ onJumpToCode });
      bridge.initChannelIfSupported();

      expect(bridge.getChannel()?.name).toBe('flux-synctex-bus:page-alpha');

      const betaDetached = new MockBroadcastChannel(getSyncTexChannelName('page-beta'));
      betaDetached.postMessage({
        type: 'synctex:jump-to-code',
        targetId: 'page-beta',
        payload: { fileId: 'f-beta', line: 99 },
      });
      await flushMicrotasks();
      expect(onJumpToCode).not.toHaveBeenCalled();

      const alphaDetached = new MockBroadcastChannel(getSyncTexChannelName('page-alpha'));
      alphaDetached.postMessage({
        type: 'synctex:jump-to-code',
        targetId: 'page-alpha',
        payload: { fileId: 'f-alpha', line: 42 },
      });
      await flushMicrotasks();
      expect(onJumpToCode).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: 'f-alpha', line: 42 }),
      );

      // Rebinds automatically when usePageStore switches to page-beta
      usePageStore.setState({ parentPageId: 'page-beta', projectId: 'proj-beta' });
      expect(bridge.getChannel()?.name).toBe('flux-synctex-bus:page-beta');

      betaDetached.close();
      alphaDetached.close();
      bridge.dispose();
    });
  });
});
