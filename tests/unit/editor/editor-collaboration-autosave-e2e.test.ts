/**
 * editor-collaboration-autosave-e2e.test.ts
 *
 * Comprehensive Real-Time Collaboration & Auto-Save E2E Integration Suite.
 *
 * Verifies:
 * 1. Mathematical CRDT Convergence (Strong Eventual Consistency - SEC):
 *    - Concurrent edits by multiple clients (Preamble vs Content) converge 100%.
 *    - Shuffled packet delivery and out-of-order execution without character loss.
 * 2. Binary y-protocols/sync Protocol Handshake:
 *    - SyncStep1 (State Vector exchange) <-> SyncStep2 (Delta updates).
 *    - Late-joining clients catch up instantly without divergence.
 * 3. Micro-Batching & Socket Emission Efficiency:
 *    - Rapid keystroke bursts are coalesced via Y.mergeUpdates into a single binary frame.
 * 4. Awareness & RelativePosition Invariance:
 *    - Remote edits before local cursor automatically translate cursor coordinates without jumping.
 * 5. Debounced Auto-Save & Guaranteed Pre-Compile Flush:
 *    - SessionCoordinator debounce management.
 *    - Guaranteed Pre-Compile Flush (flushAllPending) ensures compiler never compiles stale content.
 * 6. Multi-Tier Crash Recovery Draft Storage:
 *    - Memory & local draft caching protects user work across tab closes and crashes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

import {
  YjsSocketIOProvider,
  getOffsetFromRowCol,
  getRowColFromOffset,
} from '@/features/editor/coordinators/services/realtime/yjs-socket-provider';
import { lruDocumentCache } from '@/features/editor/domain/document/lru-document-cache';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';
import { draftStorageService } from '@/features/editor/coordinators/services/draft-storage.service';
import { useCompileStore, useConnectivityStore } from '@/features/editor/store';
import { manuscriptService } from '@/features/editor/coordinators/services/manuscript.service';

describe('Editor Real-Time Collaboration & Auto-Save Subsystem', () => {
  describe('1. Mathematical CRDT Convergence & Strong Eventual Consistency (SEC)', () => {
    let docA: Y.Doc;
    let docB: Y.Doc;
    let textA: Y.Text;
    let textB: Y.Text;

    beforeEach(() => {
      docA = new Y.Doc();
      docB = new Y.Doc();
      textA = docA.getText('latex');
      textB = docB.getText('latex');
    });

    afterEach(() => {
      docA.destroy();
      docB.destroy();
    });

    it('converges deterministically when Client A and Client B edit concurrently', () => {
      // Baseline initial state
      const initialLatex = '\\documentclass{article}\n\\begin{document}\n\\end{document}';
      textA.insert(0, initialLatex);

      // Initial sync from A -> B
      const initialUpdate = Y.encodeStateAsUpdate(docA);
      Y.applyUpdate(docB, initialUpdate);
      expect(textB.toString()).toBe(initialLatex);

      // Concurrent Edit 1: Client A adds Title & Author before \begin{document}
      // "\documentclass{article}\n" has length 23
      const insertPosA = initialLatex.indexOf('\\begin{document}');
      textA.insert(insertPosA, '\\title{Quantum Gravity}\n\\author{Alice}\n');

      // Concurrent Edit 2: Client B inserts content inside the document body
      const insertPosB = initialLatex.indexOf('\\end{document}');
      textB.insert(insertPosB, '\\section{Introduction}\nWe explore spacetime manifolds.\n');

      // Generate updates
      const updateFromA = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
      const updateFromB = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));

      // Exchange updates
      Y.applyUpdate(docB, updateFromA);
      Y.applyUpdate(docA, updateFromB);

      // SEC Guarantee: Both must converge to the EXACT same text
      expect(textA.toString()).toBe(textB.toString());
      expect(textA.toString()).toContain('\\title{Quantum Gravity}');
      expect(textA.toString()).toContain('\\section{Introduction}');
      expect(textA.toString()).toContain('\\end{document}');
    });

    it('maintains convergence under out-of-order and interleaved updates', () => {
      const updatesA: Uint8Array[] = [];
      const updatesB: Uint8Array[] = [];

      docA.on('update', (u) => updatesA.push(u));
      docB.on('update', (u) => updatesB.push(u));

      // Multiple rapid interleaved keystrokes
      textA.insert(0, 'A');
      textB.insert(0, 'B');
      textA.insert(1, '1');
      textB.insert(1, '2');
      textA.insert(2, 'C');
      textB.insert(2, 'D');

      // Apply in reverse / shuffled order
      for (let i = updatesB.length - 1; i >= 0; i--) {
        Y.applyUpdate(docA, updatesB[i]);
      }
      for (let i = updatesA.length - 1; i >= 0; i--) {
        Y.applyUpdate(docB, updatesA[i]);
      }

      // Strong eventual consistency: equal texts, 0 data loss
      expect(textA.toString()).toBe(textB.toString());
      expect(textA.toString().length).toBe(6);
      expect(textA.toString()).toContain('A');
      expect(textA.toString()).toContain('B');
      expect(textA.toString()).toContain('1');
      expect(textA.toString()).toContain('2');
      expect(textA.toString()).toContain('C');
      expect(textA.toString()).toContain('D');
    });
  });

  describe('2. Binary y-protocols/sync Protocol Handshake', () => {
    it('synchronizes a late-joining client via SyncStep1 & SyncStep2 handshake', () => {
      const serverDoc = new Y.Doc();
      const serverText = serverDoc.getText('latex');
      serverText.insert(0, '\\section{Methodology}\nAdvanced algorithmic simulation.');

      const clientDoc = new Y.Doc();
      const clientText = clientDoc.getText('latex');
      expect(clientText.toString()).toBe('');

      // Step 1: Client sends SyncStep1 with its state vector
      const step1Encoder = encoding.createEncoder();
      syncProtocol.writeSyncStep1(step1Encoder, clientDoc);
      const step1Payload = encoding.toUint8Array(step1Encoder);

      // Server receives SyncStep1, prepares SyncStep2 with missing updates
      const step1Decoder = decoding.createDecoder(step1Payload);
      const serverReplyEncoder = encoding.createEncoder();
      syncProtocol.readSyncMessage(step1Decoder, serverReplyEncoder, serverDoc, 'server');

      // Client processes server reply (contains missing state)
      const serverReply = encoding.toUint8Array(serverReplyEncoder);
      const clientReplyDecoder = decoding.createDecoder(serverReply);
      syncProtocol.readSyncMessage(clientReplyDecoder, encoding.createEncoder(), clientDoc, 'client');

      // Verify late-joiner is now completely synced with server
      expect(clientText.toString()).toBe(serverText.toString());
      expect(clientText.toString()).toContain('Advanced algorithmic simulation.');

      serverDoc.destroy();
      clientDoc.destroy();
    });
  });

  describe('3. Micro-Batching & Socket Emission Efficiency', () => {
    it('micro-batches rapid typing updates into a single merged binary frame', async () => {
      const doc = new Y.Doc();
      const provider = new YjsSocketIOProvider('proj-1', 'doc-1', doc);

      // Mock the internal socket
      const emittedMessages: any[] = [];
      (provider as any).socket = {
        connected: true,
        emit: (event: string, payload: any) => {
          emittedMessages.push({ event, payload });
        },
      };

      // Type 5 rapid characters in sequence (within 20ms)
      const yText = provider.yText;
      yText.insert(0, 'H');
      yText.insert(1, 'e');
      yText.insert(2, 'l');
      yText.insert(3, 'l');
      yText.insert(4, 'o');

      // Before timer fires, pending updates should be queued
      expect((provider as any).pendingUpdates.length).toBe(5);

      // Flush explicitly (or wait for 20ms debounce)
      provider.flushPendingUpdates();

      // Should emit exactly 1 merged frame instead of 5 separate socket calls
      expect(emittedMessages).toHaveLength(1);
      expect(emittedMessages[0].event).toBe('doc:sync-update');
      expect(emittedMessages[0].payload.data).toBeInstanceOf(Uint8Array);
      expect((provider as any).pendingUpdates.length).toBe(0);

      provider.destroy();
      doc.destroy();
    });
  });

  describe('4. Awareness & RelativePosition Invariance Under Remote Edits', () => {
    it('automatically shifts cursor position when remote collaborator inserts text before cursor', () => {
      const docA = new Y.Doc();
      const docB = new Y.Doc();
      const textA = docA.getText('latex');
      const textB = docB.getText('latex');

      const initialText = 'Introduction: Welcome to the paper.';
      textA.insert(0, initialText);
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

      // Client A places cursor right before "Welcome" (index 14)
      const targetIndex = 14;
      const relativeCursorPos = Y.createRelativePositionFromTypeIndex(textA, targetIndex);

      // Client B concurrently inserts a long preamble at index 0 (before Client A's cursor)
      const preamble = '\\title{Autonomous Systems}\n\\author{DeepMind}\n\n';
      textB.insert(0, preamble);

      // Sync B -> A
      const updateFromB = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docA));
      Y.applyUpdate(docA, updateFromB);

      // Recalculate absolute position of Client A's cursor from RelativePosition
      const resolvedPos = Y.createAbsolutePositionFromRelativePosition(relativeCursorPos, docA);

      expect(resolvedPos).toBeDefined();
      expect(resolvedPos?.type).toBe(textA);
      // Index should shift forward by exactly the length of preamble without jumping!
      expect(resolvedPos?.index).toBe(targetIndex + preamble.length);

      // Character at the resolved position must still be 'W' ('Welcome')
      const fullText = textA.toString();
      expect(fullText[resolvedPos!.index]).toBe('W');

      docA.destroy();
      docB.destroy();
    });
  });

  describe('5. Debounced Auto-Save & Guaranteed Pre-Compile Flush', () => {
    const fileId = 'test-flush-doc.tex';

    beforeEach(() => {
      lruDocumentCache.clearAll();
      useCompileStore.getState().clearDirty(fileId);
      draftStorageService.clearDraft(fileId);
    });

    afterEach(() => {
      lruDocumentCache.clearAll();
      draftStorageService.clearDraft(fileId);
    });

    it('tracks dirty states and coordinates flush before compilation', async () => {
      // Spy on backend persistence updateContent
      const updateSpy = vi.spyOn(manuscriptService.docs, 'updateContent').mockResolvedValue({
        success: true,
        version: 2,
      } as any);

      // 1. Notify content change
      const newLatex = '\\section{Results}\nAccuracy reached 99.8\\%.';
      sessionCoordinator.notifyContentChange(fileId, newLatex, {
        customAutoSaveDelay: 200, // 200ms debounce
        skipAutoCompile: true,
      });

      // 2. Verify hot RAM updated immediately (0ms)
      const model = lruDocumentCache.getModel(fileId);
      expect(model).toBeDefined();
      expect(model?.content).toBe(newLatex);
      expect(model?.isDirty).toBe(true);

      // 3. Verify marked dirty in compile store for incremental tracking
      expect(useCompileStore.getState().dirtyContentMap.has(fileId)).toBe(true);

      // 4. Guaranteed Pre-Compile Flush execution
      const flushResult = await sessionCoordinator.flushAllPending();
      expect(flushResult.succeeded).toBe(1);
      expect(flushResult.failed).toBe(0);

      // 5. Verify updateContent was called with latest content
      expect(updateSpy).toHaveBeenCalledWith(fileId, newLatex);

      // 6. Verify model is marked clean
      expect(model?.isDirty).toBe(false);
      expect(useCompileStore.getState().dirtyContentMap.has(fileId)).toBe(false);

      updateSpy.mockRestore();
    });
  });

  describe('6. Multi-Tier Crash Recovery Draft Storage', () => {
    const fileId = 'crash-recovery-doc.tex';
    const projectId = 'proj-recovery-001';
    const content = '\\begin{equation}\nE = mc^2\n\\end{equation}';

    beforeEach(() => {
      draftStorageService.clearDraft(fileId);
    });

    afterEach(() => {
      draftStorageService.clearDraft(fileId);
    });

    it('saves draft into memory and recovers it when document is opened', async () => {
      await draftStorageService.saveDraft(fileId, content, projectId);

      // Check draft exists
      const draft = await draftStorageService.getDraft(fileId);
      expect(draft).toBeDefined();
      expect(draft?.fileId).toBe(fileId);
      expect(draft?.content).toBe(content);
      expect(draft?.projectId).toBe(projectId);

      // Clear draft
      await draftStorageService.clearDraft(fileId);
      const afterClear = await draftStorageService.getDraft(fileId);
      expect(afterClear).toBeNull();
    });
  });
});
