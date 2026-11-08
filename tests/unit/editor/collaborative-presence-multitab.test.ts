// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';
import { uuidv7 } from '@/shared/utils/uuid.util';
import {
  aggregateCollaboratorPresences,
  shouldRenderRemoteCursor,
} from '@/features/editor/domain/collaboration/presence-aggregation';
import type { CollaboratorPresenceInfo } from '@/features/editor/core/store/collaboration.store';
import { withWebLock, multiTabBus } from '@/shared/lib/multi-tab';

describe('Real-Time Multi-User Collaboration & Presence (Phân hệ 4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Multi-Tab Collaborator Presence Aggregation (User A: 10 tabs, User B: 15 tabs)', () => {
    it('aggregates 25 individual tab sessions into 2 clean collaborator entities', () => {
      const presences: CollaboratorPresenceInfo[] = [];

      // User A (Alice): 10 browser tabs on Machine 1
      for (let i = 1; i <= 10; i++) {
        presences.push({
          id: `sock-alice-${i}`,
          userId: 'usr-alice',
          socketId: `sock-alice-${i}`,
          name: 'Alice Cooper',
          email: 'alice@example.com',
          color: '#3b82f6',
          isOnline: true,
          activeFile: 'main.tex',
          activeFileId: 'file-main-tex',
          cursor: {
            line: 10 + i,
            column: 4,
          },
          lastActiveAt: 1000 + i * 10,
        });
      }

      // User B (Bob): 15 browser tabs on Machine 2
      for (let j = 1; j <= 15; j++) {
        presences.push({
          id: `sock-bob-${j}`,
          userId: 'usr-bob',
          socketId: `sock-bob-${j}`,
          name: 'Bob Martin',
          email: 'bob@example.com',
          color: '#10b981',
          isOnline: true,
          activeFile: 'chapters/methodology.tex',
          activeFileId: 'file-methodology',
          cursor: {
            line: 50 + j,
            column: 8,
          },
          lastActiveAt: 2000 + j * 10,
        });
      }

      expect(presences.length).toBe(25);

      // When viewed from Alice's client (currentUserId: 'usr-alice')
      const aggregated = aggregateCollaboratorPresences(presences, 'usr-alice');

      expect(aggregated.length).toBe(2);

      // Verify Bob (remote collaborator) is sorted first
      const bob = aggregated.find((u) => u.userId === 'usr-bob');
      expect(bob).toBeDefined();
      expect(bob!.tabCount).toBe(15);
      expect(bob!.socketIds.length).toBe(15);
      expect(bob!.isSelf).toBe(false);
      expect(bob!.isOnline).toBe(true);
      // Keeps latest active cursor (tab 15: line 65)
      expect(bob!.cursor?.line).toBe(65);
      expect(bob!.activeFile).toBe('chapters/methodology.tex');

      // Verify Alice (self) is aggregated with 10 tabs
      const alice = aggregated.find((u) => u.userId === 'usr-alice');
      expect(alice).toBeDefined();
      expect(alice!.tabCount).toBe(10);
      expect(alice!.socketIds.length).toBe(10);
      expect(alice!.isSelf).toBe(true);
      expect(alice!.isOnline).toBe(true);
      // Keeps latest active cursor (tab 10: line 20)
      expect(alice!.cursor?.line).toBe(20);
    });

    it('handles empty presence list gracefully', () => {
      const result = aggregateCollaboratorPresences([], 'usr-alice');
      expect(result).toEqual([]);
    });

    it('correctly marks offline status only when all tabs are offline', () => {
      const presences: CollaboratorPresenceInfo[] = [
        {
          id: 'sock-1',
          userId: 'usr-bob',
          name: 'Bob',
          color: '#10b981',
          isOnline: false,
          lastActiveAt: 100,
        },
        {
          id: 'sock-2',
          userId: 'usr-bob',
          name: 'Bob',
          color: '#10b981',
          isOnline: true,
          lastActiveAt: 200,
        },
      ];

      const res = aggregateCollaboratorPresences(presences, 'usr-alice');
      expect(res.length).toBe(1);
      // If at least one tab is online, user is marked online
      expect(res[0].isOnline).toBe(true);
      expect(res[0].tabCount).toBe(2);
    });
  });

  describe('2. Editor Ghost Cursor & Self-Tab Collision Filtering', () => {
    const localUserId = 'usr-alice';
    const localSocketId = 'sock-alice-tab-1';

    it('suppresses cursor if it belongs to the exact local tab', () => {
      const shouldRender = shouldRenderRemoteCursor({
        cursorUserId: 'usr-alice',
        cursorSocketId: localSocketId,
        currentUserId: localUserId,
        localSocketId,
      });
      expect(shouldRender).toBe(false);
    });

    it('suppresses ghost cursor from secondary tabs of the same user by default', () => {
      const shouldRender = shouldRenderRemoteCursor({
        cursorUserId: 'usr-alice',
        cursorSocketId: 'sock-alice-tab-2',
        currentUserId: localUserId,
        localSocketId,
        allowSelfSecondaryTabs: false,
      });
      expect(shouldRender).toBe(false);
    });

    it('allows cursor from secondary tab if allowSelfSecondaryTabs is enabled', () => {
      const shouldRender = shouldRenderRemoteCursor({
        cursorUserId: 'usr-alice',
        cursorSocketId: 'sock-alice-tab-2',
        currentUserId: localUserId,
        localSocketId,
        allowSelfSecondaryTabs: true,
      });
      expect(shouldRender).toBe(true);
    });

    it('always renders cursor from remote collaborators', () => {
      const shouldRender = shouldRenderRemoteCursor({
        cursorUserId: 'usr-bob',
        cursorSocketId: 'sock-bob-tab-1',
        currentUserId: localUserId,
        localSocketId,
      });
      expect(shouldRender).toBe(true);
    });
  });

  describe('3. Yjs CRDT Multi-Tab Concurrent Editing & Deterministic Convergence', () => {
    it('achieves 100% convergence across 5 concurrent tabs with out-of-order edits', () => {
      // Simulate 5 active tabs (e.g. 2 tabs of Alice, 3 tabs of Bob)
      const tabs = Array.from({ length: 5 }, (_, idx) => {
        const doc = new Y.Doc();
        const tabId = uuidv7();
        return {
          tabId,
          doc,
          text: doc.getText('latex'),
          userId: idx < 2 ? 'usr-alice' : 'usr-bob',
        };
      });

      const initialManuscript = '\\documentclass{article}\n\\begin{document}\n\\section{Intro}\n\\end{document}';
      tabs[0].text.insert(0, initialManuscript);

      // Distribute initial state to all tabs
      const initialUpdate = Y.encodeStateAsUpdate(tabs[0].doc);
      for (let i = 1; i < tabs.length; i++) {
        Y.applyUpdate(tabs[i].doc, initialUpdate);
      }

      // Concurrently perform edits across all 5 tabs
      const pendingUpdates: Uint8Array[] = [];

      // Tab 0 (Alice tab 1) edits title
      tabs[0].text.insert(0, '% Title: Quantum Neural Fields\n');
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[0].doc));

      // Tab 1 (Alice tab 2) adds author
      tabs[1].text.insert(tabs[1].text.toString().indexOf('\\begin{document}'), '\\author{Alice \\& Bob}\n');
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[1].doc));

      // Tab 2 (Bob tab 1) inserts abstract
      tabs[2].text.insert(tabs[2].text.toString().indexOf('\\section{Intro}'), '\\begin{abstract}Novel findings.\\end{abstract}\n');
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[2].doc));

      // Tab 3 (Bob tab 2) edits intro content
      tabs[3].text.insert(tabs[3].text.toString().indexOf('\\end{document}'), 'Deep representation models show strong empirical scaling.\n');
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[3].doc));

      // Tab 4 (Bob tab 3) adds bibliography citation
      tabs[4].text.insert(tabs[4].text.toString().indexOf('\\end{document}'), '\\cite{Vaswani2017}\n');
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[4].doc));

      // Shuffle updates to simulate out-of-order asynchronous network delivery across machines
      const shuffledUpdates = [...pendingUpdates].reverse();

      // Apply all updates to every tab
      for (const update of shuffledUpdates) {
        for (const tab of tabs) {
          Y.applyUpdate(tab.doc, update);
        }
      }

      // Verify all 5 tabs have converged to the exact same character sequence
      const referenceContent = tabs[0].text.toString();
      for (let i = 1; i < tabs.length; i++) {
        expect(tabs[i].text.toString()).toBe(referenceContent);
      }

      // Verify all edits are present
      expect(referenceContent).toContain('Quantum Neural Fields');
      expect(referenceContent).toContain('\\author{Alice \\& Bob}');
      expect(referenceContent).toContain('Novel findings.');
      expect(referenceContent).toContain('Deep representation models');
      expect(referenceContent).toContain('\\cite{Vaswani2017}');

      // Cleanup
      tabs.forEach((t) => t.doc.destroy());
    });
  });

  describe('4. Multi-Tab Leader Election & Coordination via W3C Web Locks', () => {
    it('elects exactly one leader tab among multiple tabs on the same machine', async () => {
      let leaderCount = 0;
      let followerRejectionCount = 0;

      // Simulate 3 tabs contending for the offline sync lock with ifAvailable: true
      const simulateTabContention = async (tabName: string) => {
        return withWebLock(
          'flux:test:leader:election',
          async () => {
            leaderCount++;
            // Hold the lock briefly
            await new Promise((r) => setTimeout(r, 25));
            return `${tabName}-elected`;
          },
          { ifAvailable: true },
        );
      };

      const results = await Promise.all([
        simulateTabContention('tab-1'),
        simulateTabContention('tab-2'),
        simulateTabContention('tab-3'),
      ]);

      const elected = results.filter((r) => r !== null);
      const rejected = results.filter((r) => r === null);

      expect(elected.length).toBe(1);
      expect(rejected.length).toBe(2);
      expect(leaderCount).toBe(1);
    });
  });
});
