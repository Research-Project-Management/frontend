import { describe, it, expect, vi } from 'vitest';
import {
  ViewerBroadcastBridge,
  type PopoutMessage,
} from '@/features/editor/utils/popout-channel.util';

describe('ViewerBroadcastBridge (Cross-Window Communication)', () => {
  it('should deliver messages between two bridge instances on the same pageId', () => {
    const pageId = 'test-doc-123';
    const mainBridge = new ViewerBroadcastBridge(pageId);
    const popoutBridge = new ViewerBroadcastBridge(pageId);

    const receivedByMain: PopoutMessage[] = [];
    const receivedByPopout: PopoutMessage[] = [];

    mainBridge.subscribe((msg) => receivedByMain.push(msg));
    popoutBridge.subscribe((msg) => receivedByPopout.push(msg));

    // 1. Popout sends VIEWER_READY
    popoutBridge.postMessage({ type: 'VIEWER_READY' });
    expect(receivedByMain).toHaveLength(1);
    expect(receivedByMain[0]).toEqual({ type: 'VIEWER_READY' });

    // 2. Main sends SYNC_STATE
    mainBridge.postMessage({
      type: 'SYNC_STATE',
      state: {
        pdfUrl: 'blob:http://localhost:3000/test-pdf',
        compileStatus: 'done',
        compileLog: 'Output written on main.pdf',
        lastCompiledAt: '2026-09-16T08:00:00.000Z',
        engine: 'pdflatex',
        compileMode: 'full',
      },
    });
    expect(receivedByPopout).toHaveLength(1);
    expect(receivedByPopout[0].type).toBe('SYNC_STATE');
    if (receivedByPopout[0].type === 'SYNC_STATE') {
      expect(receivedByPopout[0].state.pdfUrl).toBe('blob:http://localhost:3000/test-pdf');
      expect(receivedByPopout[0].state.compileStatus).toBe('done');
    }

    // Clean up
    mainBridge.destroy();
    popoutBridge.destroy();
  });

  it('should deliver Forward SyncTeX messages from Main to Popout', () => {
    const pageId = 'test-doc-synctex-forward';
    const mainBridge = new ViewerBroadcastBridge(pageId);
    const popoutBridge = new ViewerBroadcastBridge(pageId);

    const onForwardSync = vi.fn();
    popoutBridge.subscribe((msg) => {
      if (msg.type === 'FORWARD_SYNC') {
        onForwardSync(msg.page, msg.line);
      }
    });

    mainBridge.postMessage({ type: 'FORWARD_SYNC', page: 4, line: 128 });
    expect(onForwardSync).toHaveBeenCalledWith(4, 128);

    mainBridge.destroy();
    popoutBridge.destroy();
  });

  it('should deliver Reverse SyncTeX messages from Popout to Main with coordinates', () => {
    const pageId = 'test-doc-synctex-reverse';
    const mainBridge = new ViewerBroadcastBridge(pageId);
    const popoutBridge = new ViewerBroadcastBridge(pageId);

    const onReverseSync = vi.fn();
    mainBridge.subscribe((msg) => {
      if (msg.type === 'REVERSE_SYNC') {
        onReverseSync(msg);
      }
    });

    popoutBridge.postMessage({
      type: 'REVERSE_SYNC',
      sourcePath: 'sections/introduction.tex',
      line: 42,
      pageNum: 2,
      x: 150.5,
      y: 280.2,
    });

    expect(onReverseSync).toHaveBeenCalledWith({
      type: 'REVERSE_SYNC',
      sourcePath: 'sections/introduction.tex',
      line: 42,
      pageNum: 2,
      x: 150.5,
      y: 280.2,
    });

    mainBridge.destroy();
    popoutBridge.destroy();
  });

  it('should handle REQUEST_COMPILE and REATTACH_REQUEST lifecycle', () => {
    const pageId = 'test-doc-lifecycle';
    const mainBridge = new ViewerBroadcastBridge(pageId);
    const popoutBridge = new ViewerBroadcastBridge(pageId);

    const mainMessages: PopoutMessage[] = [];
    const popoutMessages: PopoutMessage[] = [];

    mainBridge.subscribe((m) => mainMessages.push(m));
    popoutBridge.subscribe((m) => popoutMessages.push(m));

    popoutBridge.postMessage({ type: 'REQUEST_COMPILE' });
    expect(mainMessages).toContainEqual({ type: 'REQUEST_COMPILE' });

    popoutBridge.postMessage({ type: 'REATTACH_REQUEST' });
    expect(mainMessages).toContainEqual({ type: 'REATTACH_REQUEST' });

    popoutBridge.postMessage({ type: 'WINDOW_CLOSED' });
    expect(mainMessages).toContainEqual({ type: 'WINDOW_CLOSED' });

    mainBridge.destroy();
    popoutBridge.destroy();
  });

  it('should not receive messages on different pageIds (isolated namespaces)', () => {
    const bridgeA = new ViewerBroadcastBridge('doc-aaa');
    const bridgeB = new ViewerBroadcastBridge('doc-bbb');

    const listenerB = vi.fn();
    bridgeB.subscribe(listenerB);

    bridgeA.postMessage({ type: 'REQUEST_COMPILE' });
    expect(listenerB).not.toHaveBeenCalled();

    bridgeA.destroy();
    bridgeB.destroy();
  });

  it('should stop delivering messages after destroy is called', () => {
    const pageId = 'test-doc-cleanup';
    const mainBridge = new ViewerBroadcastBridge(pageId);
    const popoutBridge = new ViewerBroadcastBridge(pageId);

    const listener = vi.fn();
    popoutBridge.subscribe(listener);

    popoutBridge.destroy();

    mainBridge.postMessage({ type: 'FORWARD_SYNC', page: 2 });
    expect(listener).not.toHaveBeenCalled();

    mainBridge.destroy();
  });
});
