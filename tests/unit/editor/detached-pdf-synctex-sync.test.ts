import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { navigationCoordinator } from '@/features/editor/coordinators/navigation.coordinator';
import { editorCommandBus, setActiveEditorEngine } from '@/features/editor/coordinators/command-bus';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useWorkspaceStore } from '@/features/editor/store/workspace.store';
import { useLayoutStore } from '@/features/editor/store/layout.store';
import { useCompileStore } from '@/features/editor/store/compiler.store';

// In-memory BroadcastChannel simulator for cross-window testing
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: { data: any }) => void) | null = null;
  static channels = new Map<string, Set<MockBroadcastChannel>>();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, new Set());
    }
    MockBroadcastChannel.channels.get(name)!.add(this);
  }

  postMessage(data: any) {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) return;
    for (const peer of peers) {
      if (peer !== this && peer.onmessage) {
        // Asynchronously simulate browser message event dispatch
        queueMicrotask(() => {
          peer.onmessage?.({ data });
        });
      }
    }
  }

  close() {
    MockBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  static reset() {
    MockBroadcastChannel.channels.clear();
  }
}

describe('Detached PDF Viewer Multi-Window SyncTeX & Dual-Scroll Bus', () => {
  let mainChannel: MockBroadcastChannel;
  let detachedChannel: MockBroadcastChannel;

  beforeEach(() => {
    MockBroadcastChannel.reset();
    mainChannel = new MockBroadcastChannel('flux-synctex-bus');
    detachedChannel = new MockBroadcastChannel('flux-synctex-bus');

    navigationCoordinator.setBroadcastChannel(mainChannel as unknown as BroadcastChannel);
    navigationCoordinator.initCommandSubscriptions(true);

    usePageStore.setState({
      projectId: 'proj-123',
      currentPage: { id: 'file-main', title: 'main.tex', path: 'main.tex' },
      activeFilePage: { id: 'file-main', title: 'main.tex', path: 'main.tex' },
    });

    useLayoutStore.setState({
      isPdfDetached: false,
      editorSplitMode: 'none',
      activeEditorPane: 'primary',
    });

    useWorkspaceStore.setState({
      tabsByProject: {
        'proj-123': [{ id: 'file-main', title: 'main.tex', path: 'main.tex' }],
      },
      activeByProject: {
        'proj-123': 'file-main',
      },
    });
  });

  afterEach(() => {
    mainChannel.close();
    detachedChannel.close();
    MockBroadcastChannel.reset();
    navigationCoordinator.setBroadcastChannel(null);
    useLayoutStore.setState({ isPdfDetached: false });
    setActiveEditorEngine(null);
  });

  describe('1. Detached Preview -> Main Window (Reverse SyncTeX & Scroll)', () => {
    it('relays synctex:jump-to-code from detached window to main window editor jump', async () => {
      const openDocSpy = vi.spyOn(navigationCoordinator, 'openDocument');
      const jumpToLineSpy = vi.spyOn(navigationCoordinator, 'jumpToLine');

      // Detached window double-clicks PDF on line 35 of main.tex
      detachedChannel.postMessage({
        type: 'synctex:jump-to-code',
        payload: {
          fileId: 'file-main',
          filePath: 'main.tex',
          line: 35,
          column: 4,
          highlight: 'synctex',
        },
      });

      // Wait for microtask broadcast dispatch
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(openDocSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'file-main',
          line: 35,
          column: 4,
          highlight: 'synctex',
        })
      );
    });

    it('relays detached window PDF scroll to main window editor:scroll-to-line', async () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      detachedChannel.postMessage({
        type: 'editor:scroll-to-line',
        payload: {
          line: 78,
          smooth: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'editor:scroll-to-line',
        line: 78,
        smooth: true,
      });
    });

    it('detects isDetachedPreviewWindow and broadcasts synctex:jump-to-code instead of local engine jump', () => {
      const postMessageSpy = vi.spyOn(mainChannel, 'postMessage');
      useLayoutStore.setState({ isPdfDetached: true });
      setActiveEditorEngine(null);

      // Verify isDetachedPreviewWindow returns true
      expect(navigationCoordinator.isDetachedPreviewWindow()).toBe(true);

      // When jumpToLine is called in detached mode:
      navigationCoordinator.jumpToLine({
        fileId: 'file-main',
        filePath: 'main.tex',
        line: 42,
        column: 1,
        highlight: 'synctex',
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'synctex:jump-to-code',
        payload: {
          fileId: 'file-main',
          filePath: 'main.tex',
          line: 42,
          column: 1,
          highlight: 'synctex',
        },
      });
    });
  });

  describe('2. Main Window -> Detached Preview (Forward SyncTeX & Dual Scroll)', () => {
    it('broadcasts synctex:forward across flux-synctex-bus when editor triggers forward sync', () => {
      const postMessageSpy = vi.spyOn(mainChannel, 'postMessage');

      editorCommandBus.dispatch({
        type: 'synctex:forward',
        line: 25,
        column: 8,
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'synctex:forward',
        payload: {
          line: 25,
          column: 8,
          filePath: 'main.tex',
          fileId: 'file-main',
        },
      });
    });

    it('broadcasts sync:editor-scrolled across flux-synctex-bus when editor scrolls', () => {
      const postMessageSpy = vi.spyOn(mainChannel, 'postMessage');

      editorCommandBus.dispatch({
        type: 'sync:editor-scrolled',
        line: 50,
        totalLines: 200,
        fraction: 0.25,
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'sync:editor-scrolled',
        payload: {
          line: 50,
          totalLines: 200,
          fraction: 0.25,
        },
      });
    });

    it('broadcasts compiler:sync-state when compilation finishes successfully', () => {
      const postMessageSpy = vi.spyOn(mainChannel, 'postMessage');
      const compiledDate = new Date();

      useCompileStore.setState({
        pdfUrl: 'blob:http://localhost/newly-compiled.pdf',
        compileStatus: 'done',
        lastCompiledAt: compiledDate,
        compileLog: 'Output written on main.pdf (1 page, 2841 bytes).',
      });

      editorCommandBus.dispatch({
        type: 'compiler:finished',
        success: true,
      });

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'compiler:sync-state',
        payload: {
          pdfUrl: 'blob:http://localhost/newly-compiled.pdf',
          compileStatus: 'done',
          lastCompiledAt: compiledDate.toISOString(),
          logs: 'Output written on main.pdf (1 page, 2841 bytes).',
        },
      });
    });

    it('responds to preview:ready by broadcasting current compiler state to new detached window', async () => {
      const postMessageSpy = vi.spyOn(mainChannel, 'postMessage');
      const compiledDate = new Date();

      useCompileStore.setState({
        pdfUrl: 'blob:http://localhost/initial.pdf',
        compileStatus: 'idle',
        lastCompiledAt: compiledDate,
        compileLog: 'Ready',
      });

      // New detached window opens and announces preview:ready
      detachedChannel.postMessage({ type: 'preview:ready' });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(postMessageSpy).toHaveBeenCalledWith({
        type: 'compiler:sync-state',
        payload: {
          pdfUrl: 'blob:http://localhost/initial.pdf',
          compileStatus: 'idle',
          lastCompiledAt: compiledDate.toISOString(),
          logs: 'Ready',
        },
      });
    });
  });

  describe('3. Detached Preview Window Close & Reattach Lifecycle', () => {
    it('sets isPdfDetached to false when preview:window-closed is received', async () => {
      useLayoutStore.setState({ isPdfDetached: true });

      detachedChannel.postMessage({ type: 'preview:window-closed' });

      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(useLayoutStore.getState().isPdfDetached).toBe(false);
    });
  });
});
