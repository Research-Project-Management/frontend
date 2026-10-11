import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createRef } from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import {
  getCollaboratorColor,
  COLLABORATOR_PALETTE,
  buildCollaboratorCursorCss,
  CollaboratorCursors,
} from '@/features/editor/ui/features/editor/CollaboratorCursors';
import {
  VisualCollaboratorCursors,
} from '@/features/editor/ui/features/editor/VisualCollaboratorCursors';
import {
  useDocumentCollaborationStore,
  type CollaboratorPresenceInfo,
} from '@/features/editor/store/collaboration.store';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

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
    });

    it('renders CollaboratorCursors component with dynamic style tag and avatars', () => {
      const { container } = render(
        <CollaboratorCursors
          collaborators={[
            { id: 'c1', name: 'Alice', color: '#2563EB', isOnline: true },
            { id: 'c2', name: 'Bob', color: '#DC2626', isOnline: false },
          ]}
        />,
      );

      const style = container.querySelector('style');
      expect(style).not.toBeNull();
      expect(style?.innerHTML).toContain('cm-ySelectionCaret');

      expect(screen.getByTitle('Alice (Online)')).toBeInTheDocument();
      expect(screen.getByTitle('Bob (Idle)')).toBeInTheDocument();
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

  describe('4. VisualCollaboratorCursors: Smoothing, Fade-Out & Multi-File Filtering', () => {
    function createMockDomContainers() {
      const container = document.createElement('div');
      const content = document.createElement('div');

      // Create lines with data-line attributes
      const line1 = document.createElement('p');
      line1.setAttribute('data-line', '1');
      line1.textContent = 'Hello world from document';
      content.appendChild(line1);

      const line2 = document.createElement('p');
      line2.setAttribute('data-line', '2');
      line2.textContent = 'Second line of collaborative LaTeX';
      content.appendChild(line2);

      container.appendChild(content);
      document.body.appendChild(container);

      return {
        containerRef: { current: container },
        contentRef: { current: content },
      };
    }

    it('renders remote cursor and name flag at target line', () => {
      const { containerRef, contentRef } = createMockDomContainers();

      const collaborators: CollaboratorPresenceInfo[] = [
        {
          id: 'user-1',
          name: 'Elena Rostova',
          color: '#2563EB',
          isOnline: true,
          cursor: { line: 1, column: 6 },
          lastActiveAt: Date.now(),
        },
      ];

      render(
        <VisualCollaboratorCursors
          containerRef={containerRef}
          contentRef={contentRef}
          collaborators={collaborators}
        />,
      );

      // Caret and Flag are rendered
      expect(screen.getByTestId('collaborator-cursor-user-1')).toBeInTheDocument();
      expect(screen.getByTestId('collaborator-caret-bar-user-1')).toBeInTheDocument();
      expect(screen.getByTestId('collaborator-flag-user-1')).toBeInTheDocument();
      expect(screen.getByText('Elena Rostova')).toBeInTheDocument();
    });

    it('fades out name tag flag after 3 seconds of typing inactivity', () => {
      const { containerRef, contentRef } = createMockDomContainers();

      const initialTime = Date.now();
      const collaborators: CollaboratorPresenceInfo[] = [
        {
          id: 'user-idle',
          name: 'Idle User',
          color: '#EA580C',
          isOnline: true,
          cursor: { line: 1, column: 2 },
          lastActiveAt: initialTime,
        },
      ];

      render(
        <VisualCollaboratorCursors
          containerRef={containerRef}
          contentRef={contentRef}
          collaborators={collaborators}
        />,
      );

      const flag = screen.getByTestId('collaborator-flag-user-idle');
      // Initially visible
      expect(flag.className).toContain('opacity-95');

      // Fast-forward past 3 seconds (e.g. 4000ms)
      act(() => {
        vi.advanceTimersByTime(4000);
      });

      // Name tag auto-fades to opacity-0
      expect(flag.className).toContain('opacity-0');
      expect(flag.className).toContain('pointer-events-none');

      // Caret bar remains visible for visual reference
      expect(screen.getByTestId('collaborator-caret-bar-user-idle')).toBeInTheDocument();

      // Hovering restores full opacity
      fireEvent.mouseEnter(flag);
      expect(flag.className).toContain('opacity-100');
    });

    it('filters out collaborators active on different files in multi-file projects', () => {
      const { containerRef, contentRef } = createMockDomContainers();

      const collaborators: CollaboratorPresenceInfo[] = [
        {
          id: 'user-main',
          name: 'Main Editor',
          color: '#2563EB',
          isOnline: true,
          activeFileId: 'main-file-id',
          cursor: { line: 1, column: 5 },
          lastActiveAt: Date.now(),
        },
        {
          id: 'user-chapter1',
          name: 'Chapter Editor',
          color: '#059669',
          isOnline: true,
          activeFileId: 'ch1-file-id',
          cursor: { line: 2, column: 1 },
          lastActiveAt: Date.now(),
        },
      ];

      render(
        <VisualCollaboratorCursors
          containerRef={containerRef}
          contentRef={contentRef}
          fileId="main-file-id"
          collaborators={collaborators}
        />,
      );

      // Only collaborator on 'main-file-id' is rendered
      expect(screen.queryByTestId('collaborator-cursor-user-main')).toBeInTheDocument();
      expect(screen.queryByTestId('collaborator-cursor-user-chapter1')).not.toBeInTheDocument();
    });

    it('renders selection highlight boxes for collaborators with text selections', () => {
      const { containerRef, contentRef } = createMockDomContainers();

      const collaborators: CollaboratorPresenceInfo[] = [
        {
          id: 'user-sel',
          name: 'Selecting User',
          color: '#7C3AED',
          isOnline: true,
          cursor: {
            line: 1,
            column: 10,
            selection: {
              startLineNumber: 1,
              startColumn: 1,
              endLineNumber: 1,
              endColumn: 10,
            },
          },
          lastActiveAt: Date.now(),
        },
      ];

      render(
        <VisualCollaboratorCursors
          containerRef={containerRef}
          contentRef={contentRef}
          collaborators={collaborators}
        />,
      );

      expect(screen.getByTestId('collaborator-cursor-user-sel')).toBeInTheDocument();
    });
  });
});
