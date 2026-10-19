import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import {
  YjsSocketIOProvider,
  getOrCreateYjsProvider,
  releaseYjsProvider,
  getOffsetFromRowCol,
  getRowColFromOffset,
} from '@/features/editor/sdk/manuscript.service';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { yCollab } from 'y-codemirror.next';

describe('Editor Real-Time Socket.IO & Yjs Collaboration Subsystem', () => {
  describe('1. Line & Column <-> Character Offset Transformations', () => {
    const text = 'Line 1: Introduction\nLine 2: Methodology and Framework\nLine 3: Empirical Evaluation\nLine 4: Conclusion';

    it('should map (row, column) to exact character offsets', () => {
      // Line 1 start
      expect(getOffsetFromRowCol(text, 1, 1)).toBe(0);
      // Line 1 col 8
      expect(getOffsetFromRowCol(text, 1, 8)).toBe(7);

      // Line 2 start: "Line 1: Introduction\n" has 21 chars (indices 0..20, \n at 20)
      const line2Start = text.indexOf('Line 2');
      expect(getOffsetFromRowCol(text, 2, 1)).toBe(line2Start);

      // Line 3 start
      const line3Start = text.indexOf('Line 3');
      expect(getOffsetFromRowCol(text, 3, 1)).toBe(line3Start);
    });

    it('should clamp columns that exceed the line length safely', () => {
      // Line 1 is 20 chars long
      const line1End = 20;
      expect(getOffsetFromRowCol(text, 1, 999)).toBe(line1End);
    });

    it('should clamp rows that exceed total lines', () => {
      expect(getOffsetFromRowCol(text, 999, 1)).toBe(text.length);
    });

    it('should map character offsets back to (row, column)', () => {
      expect(getRowColFromOffset(text, 0)).toEqual({ row: 1, col: 1 });

      const line2Start = text.indexOf('Line 2');
      expect(getRowColFromOffset(text, line2Start)).toEqual({ row: 2, col: 1 });

      const line3Start = text.indexOf('Line 3');
      expect(getRowColFromOffset(text, line3Start + 5)).toEqual({ row: 3, col: 6 });
    });

    it('should maintain round-trip consistency across valid coordinates', () => {
      const coordinates = [
        { row: 1, col: 1 },
        { row: 1, col: 15 },
        { row: 2, col: 5 },
        { row: 3, col: 10 },
        { row: 4, col: 1 },
      ];

      for (const coord of coordinates) {
        const offset = getOffsetFromRowCol(text, coord.row, coord.col);
        const mapped = getRowColFromOffset(text, offset);
        expect(mapped).toEqual(coord);
      }
    });

    it('should handle empty text gracefully without throwing', () => {
      expect(getOffsetFromRowCol('', 1, 1)).toBe(0);
      expect(getRowColFromOffset('', 0)).toEqual({ row: 1, col: 1 });
    });
  });

  describe('2. YjsSocketIOProvider Lifecycle & Awareness Integration', () => {
    const projectId = 'proj-test-100';
    const pageId = 'doc-test-200';
    let doc: Y.Doc;

    beforeEach(() => {
      doc = new Y.Doc();
    });

    afterEach(() => {
      doc.destroy();
    });

    it('should initialize with awareness and local user metadata', () => {
      const user = {
        id: 'usr-alice',
        name: 'Dr. Alice',
        color: '#10B981',
        role: 'author',
      };

      const provider = new YjsSocketIOProvider(projectId, pageId, doc, {
        user,
      });

      expect(provider.projectId).toBe(projectId);
      expect(provider.pageId).toBe(pageId);
      expect(provider.awareness).toBeDefined();
      expect(provider.yText).toBeDefined();

      const localState = provider.awareness.getLocalState();
      expect(localState?.user?.name).toBe('Dr. Alice');
      expect(localState?.user?.color).toBe('#10B981');
      expect(localState?.user?.id).toBe('usr-alice');

      provider.destroy();
    });

    it('should handle simulated remote cursor update into awareness', () => {
      const provider = new YjsSocketIOProvider(projectId, pageId, doc, {
        user: { id: 'usr-local', name: 'Local User' },
      });

      provider.yText.insert(0, 'Hello World\nCollaborative LaTeX Document\nFinal Line');

      let changeFired = false;
      provider.awareness.on('change', () => {
        changeFired = true;
      });

      // Simulate incoming remote doc:cursor from Socket.IO peer
      const remoteSocketPayload = {
        userId: 'usr-bob',
        socketId: 'sock-peer-99',
        name: 'Bob Peer',
        color: '#F59E0B',
        cursor: {
          row: 2,
          column: 5,
          selection: null,
        },
      };

      // Access private handler for unit testing
      (provider as any).handleRemoteCursor(remoteSocketPayload);

      expect(changeFired).toBe(true);

      // Verify remote client exists in awareness
      const states = Array.from(provider.awareness.getStates().values());
      const bobState = states.find((s) => s.user?.name === 'Bob Peer');
      expect(bobState).toBeDefined();
      expect(bobState?.user?.color).toBe('#F59E0B');
      expect(bobState?.cursor?.anchor).toBeDefined();
      expect(bobState?.cursor?.head).toBeDefined();

      // Resolve relative position back to index
      const headAbs = Y.createAbsolutePositionFromRelativePosition(bobState?.cursor?.head, doc);
      expect(headAbs).toBeDefined();
      expect(headAbs?.type).toBe(provider.yText);

      // "Hello World\n" is 12 chars. Row 2 col 5 -> 12 + 4 = 16
      expect(headAbs?.index).toBe(16);

      provider.destroy();
    });

    it('should handle remote user join and leave gracefully', () => {
      let collaboratorsUpdate: any[] = [];
      const provider = new YjsSocketIOProvider(projectId, pageId, doc, {
        user: { id: 'usr-local', name: 'Local' },
        onCollaboratorsChange: (collabs) => {
          collaboratorsUpdate = collabs;
        },
      });

      // 1. Peer joins
      (provider as any).handleUserJoined({
        userId: 'usr-carol',
        socketId: 'sock-carol-1',
        name: 'Carol Collaborator',
        color: '#8B5CF6',
        role: 'reviewer',
      });

      expect(collaboratorsUpdate).toHaveLength(1);
      expect(collaboratorsUpdate[0].name).toBe('Carol Collaborator');

      // 2. Peer leaves
      (provider as any).handleUserLeft({
        userId: 'usr-carol',
        socketId: 'sock-carol-1',
      });

      expect(collaboratorsUpdate).toHaveLength(0);

      provider.destroy();
    });

    it('should clean up awareness and timers on destroy', () => {
      const provider = new YjsSocketIOProvider(projectId, pageId, doc);
      const destroySpy = vi.spyOn(provider.awareness, 'destroy');

      provider.destroy();

      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('3. CodeMirror 6 yCollab Integration with Live Awareness', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      if (typeof Range.prototype.getClientRects !== 'function') {
        Range.prototype.getClientRects = () =>
          [{ bottom: 0, height: 0, left: 0, right: 0, top: 0, width: 0, x: 0, y: 0, toJSON: () => {} } as DOMRect] as unknown as DOMRectList;
      }
      container = document.createElement('div');
      document.body.appendChild(container);
    });

    afterEach(() => {
      container.remove();
    });

    it('should render remote selection and caret without throwing', () => {
      const doc = new Y.Doc();
      const provider = new YjsSocketIOProvider('p1', 'd1', doc, {
        user: { id: 'u1', name: 'Local Editor' },
      });

      provider.yText.insert(0, '\\section{Introduction}\nHere is collaborative content.');

      const state = EditorState.create({
        doc: provider.yText.toString(),
        extensions: [yCollab(provider.yText, provider.awareness)],
      });

      const view = new EditorView({
        state,
        parent: container,
      });

      expect(view.state.doc.toString()).toContain('\\section{Introduction}');

      // Simulate remote cursor from collaborator
      (provider as any).handleRemoteCursor({
        userId: 'u2',
        socketId: 's2',
        name: 'Remote Peer',
        color: '#EC4899',
        cursor: {
          row: 1,
          column: 10,
        },
      });

      // CodeMirror update should process awareness change seamlessly
      view.dispatch({});

      expect(view.state.doc.toString()).toContain('\\section{Introduction}');

      view.destroy();
      provider.destroy();
      doc.destroy();
    });
  });

  describe('4. Provider Pooling & Two-Way CRDT Handshake', () => {
    it('should reuse provider instance with ref counting', () => {
      const p1 = getOrCreateYjsProvider('proj-pool', 'file-pool');
      const p2 = getOrCreateYjsProvider('proj-pool', 'file-pool');
      expect(p1).toBe(p2);

      releaseYjsProvider('proj-pool', 'file-pool');
      expect(p1.isDestroyed).toBe(false);

      releaseYjsProvider('proj-pool', 'file-pool');
      expect(p1.isDestroyed).toBe(true);
    });

    it('should handle simulated server SyncStep2 + SyncStep1 payload and produce doc:sync:step2 reply', () => {
      const clientDoc = new Y.Doc();
      const serverDoc = new Y.Doc();

      // Server has existing content
      serverDoc.getText('latex').insert(0, 'Server authoritative content');

      // Client had offline local edit
      clientDoc.getText('latex').insert(0, 'Local offline edit: ');

      const emittedEvents: Array<{ event: string; payload: any }> = [];
      const mockSocket: any = {
        connected: true,
        emit: vi.fn((event: string, payload: any) => {
          emittedEvents.push({ event, payload });
        }),
      };

      const provider = new YjsSocketIOProvider('p-test', 'd-test', clientDoc);
      (provider as any).socket = mockSocket;

      // Server prepares reply to client's SyncStep1:
      // It includes writeSyncStep2 (server missing to client) + writeSyncStep1 (server state vector)
      const serverEncoder = encoding.createEncoder();
      const clientStateVector = Y.encodeStateVector(clientDoc);
      syncProtocol.writeSyncStep2(serverEncoder, serverDoc, clientStateVector);
      syncProtocol.writeSyncStep1(serverEncoder, serverDoc);
      const serverPayload = encoding.toUint8Array(serverEncoder);

      // Simulate client receiving the handshake response:
      const decoder = decoding.createDecoder(serverPayload);
      const replyEncoder = encoding.createEncoder();
      while (decoding.hasContent(decoder)) {
        syncProtocol.readSyncMessage(decoder, replyEncoder, clientDoc, 'socket.io');
      }

      // 1. Client doc should now have received server content
      expect(clientDoc.getText('latex').toString()).toContain('Server authoritative content');

      // 2. replyEncoder should have generated a SyncStep2 message for the server
      expect(encoding.length(replyEncoder)).toBeGreaterThan(0);

      // 3. Applying that reply to server should synchronize server doc
      const clientReply = encoding.toUint8Array(replyEncoder);
      const serverReplyDecoder = decoding.createDecoder(clientReply);
      while (decoding.hasContent(serverReplyDecoder)) {
        syncProtocol.readSyncMessage(serverReplyDecoder, encoding.createEncoder(), serverDoc, 'client');
      }

      // Both docs must be in full mathematical convergence!
      expect(serverDoc.getText('latex').toString()).toEqual(clientDoc.getText('latex').toString());
      expect(serverDoc.getText('latex').toString()).toContain('Local offline edit: ');
      expect(serverDoc.getText('latex').toString()).toContain('Server authoritative content');

      provider.destroy();
      serverDoc.destroy();
      clientDoc.destroy();
    });
  });
});
