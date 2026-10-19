import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import {
  getCollaboratorColor,
  COLLABORATOR_PALETTE,
  buildCollaboratorCursorCss,
} from '@/features/editor/ui/editor/CollaboratorCursors';
import {
  useDocumentCollaborationStore,
} from '@/features/editor/core';

describe('Phase 12: Realtime Collab Cursor & Awareness Smoothing (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDocumentCollaborationStore.getState().clearCollaborators();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
    useDocumentCollaborationStore.getState().clearCollaborators();
    document.body.innerHTML = '';
  });

  describe('1. Collaborator Color Palettes & Deterministic Hashing', () => {
    it('produces valid hex colors from the collaborator palette', () => {
      expect(COLLABORATOR_PALETTE.length).toBeGreaterThanOrEqual(8);
      for (const color of COLLABORATOR_PALETTE) {
        expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('hashes user IDs deterministically into consistent colors', () => {
      const color1 = getCollaboratorColor('user-alice-123');
      const color2 = getCollaboratorColor('user-alice-123');
      expect(color1).toBe(color2);

      const colorBob = getCollaboratorColor('user-bob-456');
      expect(COLLABORATOR_PALETTE).toContain(colorBob);
    });
  });

  describe('2. CodeMirror Dynamic Cursor CSS & Inactivity Fade-Out', () => {
    it('generates smooth cursor animations and 3s inactivity fade-out CSS', () => {
      const css = buildCollaboratorCursorCss();

      // Keyframes for smooth entrance and 3-second auto-fade
      expect(css).toContain('@keyframes cm-ycaret-in');
      expect(css).toContain('@keyframes cm-ycaret-inactivity-fade');

      // Inactivity fade duration (~3.5s)
      expect(css).toContain('cm-ycaret-inactivity-fade 3.5s');

      // Hover override: name tag pops back in on cursor hover
      expect(css).toContain('.cm-ySelectionCaret:hover .cm-ySelectionCaretInfo');
      expect(css).toContain('opacity: 1 !important');

      // Selection opacity blending
      expect(css).toContain('.cm-ySelection');
      expect(css).toContain('opacity: 0.25');
      expect(css).toContain('.cm-ySelectionCaretDot');
    });
  });

  describe('3. Collaboration Store: Presence, Cursors & Disconnect Cleanup', () => {
    it('updates collaborator cursor and automatically timestamps lastActiveAt', () => {
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

      const updated = useDocumentCollaborationStore
        .getState()
        .collaborators.find((c) => c.id === 'user-charlie');
      expect(updated).toBeDefined();
      expect(updated?.cursor).toEqual({ line: 15, column: 8 });
      expect(updated?.activeFileId).toBe('main-tex-id');
      expect(updated?.lastActiveAt).toBeGreaterThanOrEqual(startTime);
    });

    it('clears remote cursor when collaborator goes offline or disconnects', () => {
      const store = useDocumentCollaborationStore.getState();

      store.updateCollaborator({
        id: 'user-dave',
        name: 'Dave',
        isOnline: true,
        cursor: { line: 42, column: 1 },
      });

      expect(
        useDocumentCollaborationStore
          .getState()
          .collaborators.find((c) => c.id === 'user-dave')?.cursor,
      ).toBeDefined();

      // Disconnect collaborator
      store.updateCollaborator({
        id: 'user-dave',
        isOnline: false,
      });

      const offlineCollab = useDocumentCollaborationStore
        .getState()
        .collaborators.find((c) => c.id === 'user-dave');
      expect(offlineCollab?.isOnline).toBe(false);
      expect(offlineCollab?.cursor).toBeUndefined();
    });
  });
});
