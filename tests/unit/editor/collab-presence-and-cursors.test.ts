import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as Y from 'yjs';
import { uuidv7 } from '@/shared/utils/uuid.util';
import { withWebLock } from '@/shared/lib/multi-tab';
import {
  getCollaboratorColor,
  COLLABORATOR_PALETTE,
  buildCollaboratorCursorCss,
} from '@/features/editor/core/collaboration/CollaboratorCursors';
import {
  aggregateCollaboratorPresences,
  shouldRenderRemoteCursor,
} from '@/features/editor/domain/collaboration/presence-aggregation';
import {
  detectMentionQuery,
  extractMentions,
  parseMentionTokens,
  formatMention,
  filterMentionMembers,
  type MentionMember,
} from '@/features/editor/domain/collaboration/mention';
import {
  editorCommandBus,
  useDocumentCollaborationStore,
} from '@/features/editor/core';
import type { CollaboratorPresenceInfo } from '@/features/editor/core/store/collaboration.store';

describe('Collaboration Presence, Remote Cursors, Yjs CRDT & @Mentions', () => {
  beforeEach(() => {
    useDocumentCollaborationStore.getState().clearCollaborators();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    useDocumentCollaborationStore.getState().clearCollaborators();
    document.body.innerHTML = '';
  });

  describe('1. Collaborator Palette, Cursor CSS & Store Presence Cleanup', () => {
    it('produces deterministic hex colors and inactivity-fading cursor CSS', () => {
      expect(COLLABORATOR_PALETTE.length).toBeGreaterThanOrEqual(8);
      for (const color of COLLABORATOR_PALETTE) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
      expect(getCollaboratorColor('user-alice-123')).toBe(getCollaboratorColor('user-alice-123'));
      expect(COLLABORATOR_PALETTE).toContain(getCollaboratorColor('user-bob-456'));

      const css = buildCollaboratorCursorCss();
      expect(css).toContain('@keyframes cm-ycaret-in');
      expect(css).toContain('cm-ycaret-inactivity-fade 3.5s');
      expect(css).toContain('.cm-ySelectionCaret:hover .cm-ySelectionCaretInfo');
    });

    it('timestamps collaborator cursor updates and clears cursor on disconnect', () => {
      const store = useDocumentCollaborationStore.getState();
      const startTime = Date.now();

      store.updateCollaborator({
        id: 'user-charlie',
        name: 'Charlie',
        color: '#059669',
        isOnline: true,
        activeFileId: 'main-tex-id',
        cursor: { line: 15, column: 8 },
      });

      const online = useDocumentCollaborationStore
        .getState()
        .collaborators.find((c) => c.id === 'user-charlie');
      expect(online?.cursor).toEqual({ line: 15, column: 8 });
      expect(online?.lastActiveAt).toBeGreaterThanOrEqual(startTime);

      store.updateCollaborator({ id: 'user-charlie', isOnline: false });
      const offline = useDocumentCollaborationStore
        .getState()
        .collaborators.find((c) => c.id === 'user-charlie');
      expect(offline?.isOnline).toBe(false);
      expect(offline?.cursor).toBeUndefined();
    });
  });

  describe('2. Multi-Tab Presence Aggregation, Ghost Cursor Filtering & Web Locks', () => {
    it('aggregates 25 tab sessions into 2 deduplicated collaborators and filters self-tab ghost cursors', () => {
      const presences: CollaboratorPresenceInfo[] = [];
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
          cursor: { line: 10 + i, column: 4 },
          lastActiveAt: 1000 + i * 10,
        });
      }
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
          cursor: { line: 50 + j, column: 8 },
          lastActiveAt: 2000 + j * 10,
        });
      }

      const aggregated = aggregateCollaboratorPresences(presences, 'usr-alice');
      expect(aggregated).toHaveLength(2);
      expect(aggregated.find((u) => u.userId === 'usr-bob')).toMatchObject({
        tabCount: 15,
        isSelf: false,
        isOnline: true,
        cursor: { line: 65, column: 8 },
      });
      expect(aggregated.find((u) => u.userId === 'usr-alice')).toMatchObject({
        tabCount: 10,
        isSelf: true,
        isOnline: true,
        cursor: { line: 20, column: 4 },
      });
      expect(aggregateCollaboratorPresences([], 'usr-alice')).toEqual([]);

      expect(
        shouldRenderRemoteCursor({
          cursorUserId: 'usr-alice',
          cursorSocketId: 'sock-1',
          currentUserId: 'usr-alice',
          localSocketId: 'sock-1',
        }),
      ).toBe(false);
      expect(
        shouldRenderRemoteCursor({
          cursorUserId: 'usr-alice',
          cursorSocketId: 'sock-2',
          currentUserId: 'usr-alice',
          localSocketId: 'sock-1',
          allowSelfSecondaryTabs: false,
        }),
      ).toBe(false);
      expect(
        shouldRenderRemoteCursor({
          cursorUserId: 'usr-alice',
          cursorSocketId: 'sock-2',
          currentUserId: 'usr-alice',
          localSocketId: 'sock-1',
          allowSelfSecondaryTabs: true,
        }),
      ).toBe(true);
      expect(
        shouldRenderRemoteCursor({
          cursorUserId: 'usr-bob',
          cursorSocketId: 'sock-bob-1',
          currentUserId: 'usr-alice',
          localSocketId: 'sock-1',
        }),
      ).toBe(true);
    });

    it('converges 5 concurrent Yjs CRDT tabs under out-of-order updates and elects a single Web Lock leader', async () => {
      const tabs = Array.from({ length: 5 }, (_, idx) => {
        const doc = new Y.Doc();
        return {
          tabId: uuidv7(),
          doc,
          text: doc.getText('latex'),
          userId: idx < 2 ? 'usr-alice' : 'usr-bob',
        };
      });

      tabs[0]!.text.insert(
        0,
        '\\documentclass{article}\n\\begin{document}\n\\section{Intro}\n\\end{document}',
      );
      const initialUpdate = Y.encodeStateAsUpdate(tabs[0]!.doc);
      for (let i = 1; i < tabs.length; i++) {
        Y.applyUpdate(tabs[i]!.doc, initialUpdate);
      }

      const pendingUpdates: Uint8Array[] = [];
      tabs[0]!.text.insert(0, '% Title: Quantum Neural Fields\n');
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[0]!.doc));
      tabs[1]!.text.insert(
        tabs[1]!.text.toString().indexOf('\\begin{document}'),
        '\\author{Alice \\& Bob}\n',
      );
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[1]!.doc));
      tabs[2]!.text.insert(
        tabs[2]!.text.toString().indexOf('\\section{Intro}'),
        '\\begin{abstract}Novel findings.\\end{abstract}\n',
      );
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[2]!.doc));
      tabs[3]!.text.insert(
        tabs[3]!.text.toString().indexOf('\\end{document}'),
        'Deep representation models.\n',
      );
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[3]!.doc));
      tabs[4]!.text.insert(
        tabs[4]!.text.toString().indexOf('\\end{document}'),
        '\\cite{Vaswani2017}\n',
      );
      pendingUpdates.push(Y.encodeStateAsUpdate(tabs[4]!.doc));

      for (const update of [...pendingUpdates].reverse()) {
        for (const tab of tabs) {
          Y.applyUpdate(tab.doc, update);
        }
      }

      const referenceContent = tabs[0]!.text.toString();
      for (const tab of tabs) {
        expect(tab.text.toString()).toBe(referenceContent);
        tab.doc.destroy();
      }
      expect(referenceContent).toContain('Quantum Neural Fields');
      expect(referenceContent).toContain('\\cite{Vaswani2017}');

      let leaderCount = 0;
      const results = await Promise.all(
        ['tab-1', 'tab-2', 'tab-3'].map((tabName) =>
          withWebLock(
            'flux:test:leader:election',
            async () => {
              leaderCount++;
              await new Promise((r) => setTimeout(r, 20));
              return `${tabName}-elected`;
            },
            { ifAvailable: true },
          ),
        ),
      );
      expect(results.filter((r) => r !== null)).toHaveLength(1);
      expect(leaderCount).toBe(1);
    });
  });

  describe('3. @mention Autocomplete, Tokenization & Bus Events', () => {
    const mockMembers: MentionMember[] = [
      { id: 'u-1', name: 'Alice Johnson', email: 'alice@flux.latex', role: 'owner' },
      { id: 'u-2', name: 'Nguyễn Văn An', email: 'an.nguyen@flux.latex', role: 'coordinator' },
      { id: 'u-3', name: 'Bob Miller', email: 'bob@example.com', role: 'contributor' },
    ];

    it('detects active @queries (including Vietnamese diacritics) while ignoring email addresses', () => {
      expect(detectMentionQuery('Hello @', 7)).toMatchObject({
        active: true,
        query: '',
        startIndex: 6,
      });
      expect(detectMentionQuery('Nhờ @Nguyễn', 11)).toMatchObject({
        active: true,
        query: 'Nguyễn',
      });
      expect(detectMentionQuery('Contact us at user@test.com', 14).active).toBe(false);
    });

    it('extracts, tokenizes, formats, filters mentions, and dispatches comment:mention bus events', () => {
      const text = 'Can @[Alice Johnson](u-1) and @[Alice Johnson](u-1) verify @BobMiller?';
      const mentions = extractMentions(text);
      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toEqual({
        name: 'Alice Johnson',
        id: 'u-1',
        raw: '@[Alice Johnson](u-1)',
      });
      expect(mentions[1]?.name).toBe('BobMiller');

      expect(parseMentionTokens('Hi @[Alice](u-1)!')).toEqual([
        { type: 'text', content: 'Hi ' },
        { type: 'mention', content: '@[Alice](u-1)', name: 'Alice', id: 'u-1' },
        { type: 'text', content: '!' },
      ]);
      expect(formatMention({ name: 'Alice', id: 'u-1' }, 'rich')).toBe('@[Alice](u-1)');
      expect(formatMention({ name: 'Alice', id: 'u-1' }, 'plain')).toBe('@Alice');

      expect(filterMentionMembers(mockMembers, 'Nguyễn')).toHaveLength(1);
      expect(filterMentionMembers(mockMembers, 'example.com')[0]?.name).toBe('Bob Miller');
      expect(filterMentionMembers(mockMembers, '')).toHaveLength(3);

      const listener = vi.fn();
      const unsubscribe = editorCommandBus.subscribe('editor:review-event', listener);
      editorCommandBus.dispatch({
        type: 'editor:review-event',
        pageId: 'page-101',
        event: 'comment:mention',
        payload: {
          pageId: 'page-101',
          commentId: 'comment-55',
          mentionedUserIds: ['u-1'],
          content: 'Hey @[Alice](u-1)',
        },
      });
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
    });
  });
});
