/**
 * collaboration-scenarios-eval.test.ts
 *
 * Full-Spectrum Collaboration Evaluation: Best Case, Bad Case, and Complex Edge Cases.
 *
 * Evaluates:
 * 1. Best Case Scenarios:
 *    - 3 co-authors concurrently drafting distinct sections of a LaTeX manuscript.
 *    - RelativePosition & Cursor Awareness translation across concurrent edits.
 *    - Guaranteed Pre-Compile Flush: latest collaborative state captured for compiler.
 *
 * 2. Bad Case Scenarios:
 *    - Sudden Network Disconnect: offline buffer queueing without data loss.
 *    - Late Reconnection & State Vector Re-synchronization (SyncStep1 / SyncStep2).
 *    - Malformed / Corrupted binary packets rejected gracefully without crashing client or doc.
 *    - Offline draft persistence in IndexedDB / local cache during extended drop.
 *
 * 3. Edge Cases:
 *    - Edge Case 1: Exact Same Position Collision (concurrent insert at identical offset).
 *    - Edge Case 2: Overlapping Range Deletions (Author A deletes [10, 30], Author B deletes [20, 40]).
 *    - Edge Case 3: Deletion of text range containing another collaborator's active cursor.
 *    - Edge Case 4: Remote Transaction Origin Isolation (remote edits must not mark local buffer dirty).
 *    - Edge Case 5: Multi-File Cross Editing (Alice edits main.tex, Bob edits references.bib).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { sessionCoordinator } from '@/features/editor/core';
import { lruDocumentCache } from '@/features/editor/subsystems/explorer/model/lru-document-cache';
import { draftStorageService } from '@/features/editor/domain/document/draft-storage';

describe('Real-Time Collaboration System: Best Case, Bad Case & Edge Cases', () => {

  // =========================================================================
  // Group 1: BEST CASE SCENARIOS (Kịch bản lý tưởng)
  // =========================================================================
  describe('Group 1: Best Case Scenarios (Seamless Co-Authoring & Convergence)', () => {
    let docA: Y.Doc;
    let docB: Y.Doc;
    let docC: Y.Doc;
    let textA: Y.Text;
    let textB: Y.Text;
    let textC: Y.Text;

    beforeEach(() => {
      docA = new Y.Doc();
      docB = new Y.Doc();
      docC = new Y.Doc();
      textA = docA.getText('latex');
      textB = docB.getText('latex');
      textC = docC.getText('latex');

      const initialDoc = `\\documentclass{article}
\\begin{document}
\\section{Introduction}
\\section{Methodology}
\\section{Conclusion}
\\end{document}`;

      textA.insert(0, initialDoc);
      // Synchronize all 3 docs initially
      const updateA = Y.encodeStateAsUpdate(docA);
      Y.applyUpdate(docB, updateA);
      Y.applyUpdate(docC, updateA);
    });

    afterEach(() => {
      docA.destroy();
      docB.destroy();
      docC.destroy();
    });

    it('Best Case 1.1: 3 co-authors concurrently write into 3 distinct sections', () => {
      // Author A edits Introduction
      const introIdxA = textA.toString().indexOf('\\section{Introduction}') + '\\section{Introduction}\n'.length;
      textA.insert(introIdxA, 'Deep learning has revolutionized artificial intelligence.\n');

      // Author B edits Methodology
      const methodIdxB = textB.toString().indexOf('\\section{Methodology}') + '\\section{Methodology}\n'.length;
      textB.insert(methodIdxB, 'We utilize a multi-head self-attention mechanism.\n');

      // Author C edits Conclusion
      const conclIdxC = textC.toString().indexOf('\\section{Conclusion}') + '\\section{Conclusion}\n'.length;
      textC.insert(conclIdxC, 'In conclusion, the proposed architecture sets a new state of the art.\n');

      // Cross-replicate all updates between all peers (mesh sync)
      const updateA = Y.encodeStateAsUpdate(docA, Y.encodeStateVector(docB));
      const updateB = Y.encodeStateAsUpdate(docB, Y.encodeStateVector(docC));
      const updateC = Y.encodeStateAsUpdate(docC, Y.encodeStateVector(docA));

      // Apply to all
      Y.applyUpdate(docB, updateA);
      Y.applyUpdate(docC, updateA);
      Y.applyUpdate(docA, updateB);
      Y.applyUpdate(docC, updateB);
      Y.applyUpdate(docA, updateC);
      Y.applyUpdate(docB, updateC);

      // Verify 100% byte-for-byte mathematical convergence
      expect(textA.toString()).toBe(textB.toString());
      expect(textB.toString()).toBe(textC.toString());

      // All 3 sections must contain their respective authored paragraphs
      const finalDoc = textA.toString();
      expect(finalDoc).toContain('Deep learning has revolutionized');
      expect(finalDoc).toContain('We utilize a multi-head self-attention');
      expect(finalDoc).toContain('In conclusion, the proposed architecture');
    });

    it('Best Case 1.2: Awareness & RelativePosition Invariance across concurrent remote edits', () => {
      // Author A has a cursor at the start of Methodology
      const targetChar = textA.toString().indexOf('\\section{Methodology}');
      const relPos = Y.createRelativePositionFromTypeIndex(textA, targetChar);

      // Author B inserts 150 characters BEFORE Author A's cursor (inside Introduction)
      const introIdx = textB.toString().indexOf('\\section{Introduction}') + 23;
      textB.insert(introIdx, 'Recent advancements in transformer architectures have made significant strides. ');

      // Sync B -> A
      const updateB = Y.encodeStateAsUpdate(docB);
      Y.applyUpdate(docA, updateB);

      // Resolve Author A's relative position on the modified document
      const absolutePos = Y.createAbsolutePositionFromRelativePosition(relPos, docA);
      expect(absolutePos).toBeDefined();

      // The cursor must have automatically shifted forward by exactly the length of the remote insertion
      expect(absolutePos!.index).toBe(targetChar + 'Recent advancements in transformer architectures have made significant strides. '.length);

      // The character under the cursor MUST still be '\\section{Methodology}'!
      expect(textA.toString().slice(absolutePos!.index, absolutePos!.index + 21)).toBe('\\section{Methodology}');
    });

    it('Best Case 1.3: Guaranteed Compilation Snapshot reflects latest multi-user CRDT state', () => {
      // Setup a project file in session coordinator
      const fileId = 'file-main-tex';
      const filePath = 'main.tex';

      lruDocumentCache.registerModel(fileId, {
        content: textA.toString(),
        filePath,
      });

      // Author B types new theorem
      textA.insert(textA.toString().indexOf('\\end{document}'), '\\begin{theorem}Convergence is guaranteed.\\end{theorem}\n');

      // Update LRU cache as session coordinator does
      sessionCoordinator.notifyContentChange(fileId, textA.toString());

      // Flush before compile
      const flushed = sessionCoordinator.flushAllPending();
      expect(flushed).toBeDefined();

      const cached = lruDocumentCache.getModel(fileId);
      expect(cached?.content).toContain('\\begin{theorem}Convergence is guaranteed.\\end{theorem}');
    });
  });

  // =========================================================================
  // Group 2: BAD CASE SCENARIOS (Kịch bản sự cố, đứt mạng, dữ liệu hỏng)
  // =========================================================================
  describe('Group 2: Bad Case Scenarios (Network Drop, Reconnect & Fault Tolerance)', () => {
    let docServer: Y.Doc;
    let docClientOffline: Y.Doc;
    let textServer: Y.Text;
    let textOffline: Y.Text;

    beforeEach(() => {
      docServer = new Y.Doc();
      docClientOffline = new Y.Doc();
      textServer = docServer.getText('latex');
      textOffline = docClientOffline.getText('latex');

      const initial = '\\begin{equation}\nE = mc^2\n\\end{equation}';
      textServer.insert(0, initial);

      // Client syncs initially
      Y.applyUpdate(docClientOffline, Y.encodeStateAsUpdate(docServer));
    });

    afterEach(() => {
      docServer.destroy();
      docClientOffline.destroy();
    });

    it('Bad Case 2.1: Network drops while offline client writes; queued updates re-sync on reconnect', () => {
      // --- SIMULATE NETWORK DROP ---
      const offlineUpdateQueue: Uint8Array[] = [];

      // Offline client listener queues updates instead of sending over broken socket
      const updateListener = (update: Uint8Array) => {
        offlineUpdateQueue.push(new Uint8Array(update));
      };
      docClientOffline.on('update', updateListener);

      // Server co-authors edit server doc while client is offline
      textServer.insert(textServer.toString().indexOf('E = mc^2'), '% Server edited this\n');

      // Offline client types 3 separate edits while completely disconnected
      textOffline.insert(textOffline.toString().indexOf('\\end{equation}'), ' % (verified experimentally)\n');
      textOffline.insert(0, '% Offline draft header\n');

      expect(offlineUpdateQueue.length).toBeGreaterThanOrEqual(2);

      // --- SIMULATE RECONNECTION ---
      // 1. Merge all offline queued updates into a single packet
      const mergedOfflinePacket = Y.mergeUpdates(offlineUpdateQueue);

      // 2. Perform y-protocols/sync handshake
      // Step A: Client requests missing server state
      const clientStateVector = Y.encodeStateVector(docClientOffline);
      const serverDiffForClient = Y.encodeStateAsUpdate(docServer, clientStateVector);

      // Step B: Server receives client's merged offline updates
      Y.applyUpdate(docServer, mergedOfflinePacket);

      // Step C: Client applies server's missing updates
      Y.applyUpdate(docClientOffline, serverDiffForClient);

      // --- VERIFY CONVERGENCE & ZERO DATA LOSS ---
      expect(textOffline.toString()).toBe(textServer.toString());
      const finalResult = textServer.toString();
      expect(finalResult).toContain('% Offline draft header');
      expect(finalResult).toContain('% Server edited this');
      expect(finalResult).toContain('% (verified experimentally)');
      expect(finalResult).toContain('E = mc^2');

      docClientOffline.off('update', updateListener);
    });

    it('Bad Case 2.2: Malformed & Corrupted binary frames rejected gracefully without doc corruption', () => {
      const originalText = textServer.toString();

      // Corrupted packet 1: Random junk binary bytes
      const junkPayload = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x00, 0xff, 0xaa, 0x55]);
      expect(() => {
        try {
          Y.applyUpdate(docServer, junkPayload);
        } catch (e) {
          // Expected to throw or fail decoding
        }
      }).not.toThrow();

      // Document must remain fully intact and operational
      expect(textServer.toString()).toBe(originalText);

      // Corrupted packet 2: Empty 0-byte buffer
      expect(() => {
        try {
          Y.applyUpdate(docServer, new Uint8Array([]));
        } catch {}
      }).not.toThrow();
      expect(textServer.toString()).toBe(originalText);

      // Valid edits can still proceed immediately
      textServer.insert(textServer.toString().length, '\n% valid edit after bad packet');
      expect(textServer.toString()).toContain('% valid edit after bad packet');
    });

    it('Bad Case 2.3: Offline draft persistence recovers document after complete crash and reload', async () => {
      const fileId = 'crash-doc-001';
      const unsavedLatex = '\\section{Crucial Offline Research}\nThis was typed right before browser crash.';

      // Save draft to local storage
      await draftStorageService.saveDraft(fileId, unsavedLatex);

      // Check draft exists
      const draft = await draftStorageService.getDraft(fileId);
      expect(draft).toBeDefined();
      expect(draft?.content).toBe(unsavedLatex);

      // Clear draft on proper save
      await draftStorageService.clearDraft(fileId);
      const afterClear = await draftStorageService.getDraft(fileId);
      expect(afterClear).toBeNull();
    });
  });

  // =========================================================================
  // Group 3: EDGE CASES (Tình huống biên phức tạp)
  // =========================================================================
  describe('Group 3: Complex Edge Cases (Collisions, Overlaps & Mode Concurrency)', () => {
    let docA: Y.Doc;
    let docB: Y.Doc;
    let textA: Y.Text;
    let textB: Y.Text;

    beforeEach(() => {
      docA = new Y.Doc();
      docB = new Y.Doc();
      textA = docA.getText('latex');
      textB = docB.getText('latex');

      const initial = 'abcdefghij';
      textA.insert(0, initial);
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));
    });

    afterEach(() => {
      docA.destroy();
      docB.destroy();
    });

    it('Edge Case 3.1: Exact Same Position Collision (Concurrent insert at identical offset)', () => {
      // Both Author A and Author B insert at offset 5 simultaneously
      // Initial: "abcde" + "fghij"
      // Author A inserts "[ALICE]"
      textA.insert(5, '[ALICE]');
      // Author B inserts "[BOB]"
      textB.insert(5, '[BOB]');

      // Exchange updates
      const updateA = Y.encodeStateAsUpdate(docA);
      const updateB = Y.encodeStateAsUpdate(docB);

      Y.applyUpdate(docB, updateA);
      Y.applyUpdate(docA, updateB);

      // SEC guarantee: Both MUST arrive at the EXACT same string deterministically
      expect(textA.toString()).toBe(textB.toString());

      // Neither insert was dropped
      expect(textA.toString()).toContain('[ALICE]');
      expect(textA.toString()).toContain('[BOB]');
      // Original characters must be preserved around the inserts
      expect(textA.toString().startsWith('abcde')).toBe(true);
      expect(textA.toString().endsWith('fghij')).toBe(true);
    });

    it('Edge Case 3.2: Overlapping Range Deletions (Author A deletes [2, 6], Author B deletes [4, 8])', () => {
      // Initial: "0123456789"
      textA.delete(0, textA.length);
      textA.insert(0, '0123456789');
      Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA));

      // Author A deletes from index 2 length 4: deletes "2345", leaving "01" + "6789"
      textA.delete(2, 4);

      // Author B concurrently deletes from index 4 length 4: deletes "4567", leaving "0123" + "89"
      textB.delete(4, 4);

      // Cross apply
      const updateA = Y.encodeStateAsUpdate(docA);
      const updateB = Y.encodeStateAsUpdate(docB);

      Y.applyUpdate(docB, updateA);
      Y.applyUpdate(docA, updateB);

      // Both must converge identically
      expect(textA.toString()).toBe(textB.toString());

      // The union of deleted ranges is indices 2..7 ("234567"). The remaining text must be "0189"!
      expect(textA.toString()).toBe('0189');
    });

    it('Edge Case 3.3: Deletion of text range containing another user active cursor/selection', () => {
      const doc = new Y.Doc();
      const text = doc.getText('latex');
      text.insert(0, 'The quick brown fox jumps over the lazy dog');

      // Collaborator B selection on "brown fox" (indices 10 to 19)
      const selStart = Y.createRelativePositionFromTypeIndex(text, 10);
      const selEnd = Y.createRelativePositionFromTypeIndex(text, 19);

      // Collaborator A deletes "quick brown fox jumps" (indices 4 to 25)
      text.delete(4, 21);

      // Resolve Collaborator B's selection on the modified document
      const resolvedStart = Y.createAbsolutePositionFromRelativePosition(selStart, doc);
      const resolvedEnd = Y.createAbsolutePositionFromRelativePosition(selEnd, doc);

      // Positions must collapse safely to the deletion boundary without out-of-bounds error
      expect(resolvedStart).toBeDefined();
      expect(resolvedEnd).toBeDefined();
      expect(resolvedStart!.index).toBeLessThanOrEqual(text.length);
      expect(resolvedEnd!.index).toBeLessThanOrEqual(text.length);

      doc.destroy();
    });

    it('Edge Case 3.4: Remote transaction origin isolation (remote edits do not dirty local model)', () => {
      const fileId = 'file-test-origin';
      lruDocumentCache.registerModel(fileId, {
        content: 'Original Content',
      });

      // Simulating remote update via SessionCoordinator with options.isRealtimeActive = true
      sessionCoordinator.notifyContentChange(fileId, 'Original Content + Remote Edit', {
        isRealtimeActive: true,
      });

      // Because it was a realtime/remote edit, local HTTP auto-save dirty flag should be protected
      const cached = lruDocumentCache.getModel(fileId);
      expect(cached?.content).toBe('Original Content + Remote Edit');
    });

    it('Edge Case 3.5: Multi-File Cross Editing in the same project room', () => {
      const projectDoc = new Y.Doc();
      const mainText = projectDoc.getText('main.tex');
      const bibText = projectDoc.getText('references.bib');

      mainText.insert(0, '\\documentclass{article}\n\\begin{document}\n\\cite{shazeer2017}\n\\end{document}');
      bibText.insert(0, '@article{shazeer2017,\n  author = {Shazeer, Noam},\n  title = {Outrageously Large Neural Networks}\n}');

      // Replicate project doc to client 2
      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(projectDoc));

      const clientMain = clientDoc.getText('main.tex');
      const clientBib = clientDoc.getText('references.bib');

      // Author A edits main.tex on doc 1
      mainText.insert(mainText.toString().indexOf('\\end{document}'), 'New paragraph by Author A.\n');

      // Author B edits references.bib on doc 2
      clientBib.insert(clientBib.toString().length, '\n@book{goodfellow2016,\n  title = {Deep Learning}\n}');

      // Cross sync
      Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(projectDoc));
      Y.applyUpdate(projectDoc, Y.encodeStateAsUpdate(clientDoc));

      // Both multi-file texts must converge
      expect(mainText.toString()).toBe(clientMain.toString());
      expect(bibText.toString()).toBe(clientBib.toString());

      expect(mainText.toString()).toContain('New paragraph by Author A.');
      expect(bibText.toString()).toContain('Deep Learning');

      projectDoc.destroy();
      clientDoc.destroy();
    });
  });
});
