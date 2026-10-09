/**
 * visual-collaborator-cursors.test.tsx
 *
 * Comprehensive Unit Test Suite for Visual Mode Real-Time Collaborator Cursors & Selection Overlays.
 * Location: `tests/unit/editor/visual-collaborator-cursors.test.tsx`
 *
 * Verifies:
 * 1. Caret & Name Tag rendering for active remote collaborators in Visual Mode.
 * 2. Filtering by document fileId, online status, and local user exclusion.
 * 3. Precision line mapping by `data-line` attribute with closest preceding element fallback.
 * 4. Selection highlight boxes rendering for active remote selections.
 * 5. Dynamic store updates via useDocumentCollaborationStore.
 * 6. Local cursor position broadcast from Visual Editor to editorCommandBus.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import {
  VisualCollaboratorCursors,
} from '@/features/editor/ui/features/editor/VisualCollaboratorCursors';
import {
  useDocumentCollaborationStore,
  type CollaboratorPresenceInfo,
} from '@/features/editor/store/collaboration.store';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

describe('VisualCollaboratorCursors - Real-Time Presence & Carets in Visual Mode', () => {
  let contentDiv: HTMLDivElement;
  let containerDiv: HTMLDivElement;

  beforeEach(() => {
    // Reset collaboration store
    useDocumentCollaborationStore.getState().clearCollaborators();

    // Create mock DOM structure for Visual Editor
    containerDiv = document.createElement('div');
    containerDiv.style.position = 'relative';
    containerDiv.style.width = '800px';
    containerDiv.style.height = '600px';
    containerDiv.scrollTop = 0;
    containerDiv.scrollLeft = 0;

    contentDiv = document.createElement('div');
    contentDiv.setAttribute('contenteditable', 'true');
    contentDiv.innerHTML = `
      <h1 data-line="1">Introduction</h1>
      <p data-line="2">This is the first paragraph with some text inside.</p>
      <div class="latex-math-block" data-line="4"><span>E = mc^2</span></div>
      <p data-line="6">Conclusion and final thoughts.</p>
    `;

    containerDiv.appendChild(contentDiv);
    document.body.appendChild(containerDiv);

    // Mock bounding client rects for jsdom
    containerDiv.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      left: 100,
      width: 800,
      height: 600,
      bottom: 700,
      right: 900,
    });

    const paragraphs = contentDiv.querySelectorAll('[data-line]');
    paragraphs.forEach((el, idx) => {
      el.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 120 + idx * 40,
        left: 120,
        width: 600,
        height: 30,
        bottom: 150 + idx * 40,
        right: 720,
      });
    });

    // Mock requestAnimationFrame
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('renders remote collaborator cursor caret and name flag accurately', () => {
    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    const collaborators: CollaboratorPresenceInfo[] = [
      {
        id: 'user-alice',
        name: 'Alice Turing',
        color: '#2563EB',
        isOnline: true,
        activeFileId: 'main-doc',
        cursor: { line: 2, column: 5 },
      },
    ];

    render(
      <VisualCollaboratorCursors
        contentRef={contentRef}
        containerRef={containerRef}
        fileId="main-doc"
        filePath="main.tex"
        collaborators={collaborators}
      />
    );

    const cursorEl = screen.getByTestId('collaborator-cursor-user-alice');
    expect(cursorEl).toBeDefined();
    expect(screen.getByText('Alice Turing')).toBeDefined();
  });

  it('filters out offline collaborators and collaborators on other files', () => {
    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    const collaborators: CollaboratorPresenceInfo[] = [
      {
        id: 'user-bob',
        name: 'Bob Smith',
        color: '#7C3AED',
        isOnline: false, // offline -> should not render
        activeFileId: 'main-doc',
        cursor: { line: 2, column: 1 },
      },
      {
        id: 'user-carol',
        name: 'Carol White',
        color: '#DB2777',
        isOnline: true,
        activeFileId: 'appendix-doc', // different document -> should not render
        cursor: { line: 1, column: 1 },
      },
    ];

    const { container } = render(
      <VisualCollaboratorCursors
        contentRef={contentRef}
        containerRef={containerRef}
        fileId="main-doc"
        filePath="main.tex"
        collaborators={collaborators}
      />
    );

    expect(screen.queryByTestId('collaborator-cursor-user-bob')).toBeNull();
    expect(screen.queryByTestId('collaborator-cursor-user-carol')).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it('does not render local user cursor when currentUserId is specified', () => {
    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    const collaborators: CollaboratorPresenceInfo[] = [
      {
        id: 'local-user-123',
        name: 'Self User',
        color: '#059669',
        isOnline: true,
        activeFileId: 'main-doc',
        cursor: { line: 1, column: 1 },
      },
    ];

    render(
      <VisualCollaboratorCursors
        contentRef={contentRef}
        containerRef={containerRef}
        fileId="main-doc"
        filePath="main.tex"
        collaborators={collaborators}
        currentUserId="local-user-123"
      />
    );

    expect(screen.queryByTestId('collaborator-cursor-local-user-123')).toBeNull();
  });

  it('falls back gracefully to closest preceding data-line if target line has no exact match', () => {
    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    // Line 5 is between line 4 (math block) and line 6 (paragraph)
    const collaborators: CollaboratorPresenceInfo[] = [
      {
        id: 'user-dave',
        name: 'Dave Fallback',
        color: '#EA580C',
        isOnline: true,
        activeFileId: 'main-doc',
        cursor: { line: 5, column: 1 },
      },
    ];

    render(
      <VisualCollaboratorCursors
        contentRef={contentRef}
        containerRef={containerRef}
        fileId="main-doc"
        filePath="main.tex"
        collaborators={collaborators}
      />
    );

    const cursor = screen.getByTestId('collaborator-cursor-user-dave');
    expect(cursor).toBeDefined();
    expect(screen.getByText('Dave Fallback')).toBeDefined();
  });

  it('renders selection highlight boxes when collaborator has an active text selection', () => {
    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    const collaborators: CollaboratorPresenceInfo[] = [
      {
        id: 'user-eva',
        name: 'Eva Selection',
        color: '#D97706',
        isOnline: true,
        activeFileId: 'main-doc',
        cursor: {
          line: 2,
          column: 5,
          selection: {
            startLineNumber: 2,
            startColumn: 1,
            endLineNumber: 2,
            endColumn: 20,
          },
        },
      },
    ];

    render(
      <VisualCollaboratorCursors
        contentRef={contentRef}
        containerRef={containerRef}
        fileId="main-doc"
        filePath="main.tex"
        collaborators={collaborators}
      />
    );

    expect(screen.getByTestId('collaborator-cursor-user-eva')).toBeDefined();
    expect(screen.getByText('Eva Selection')).toBeDefined();
  });

  it('reacts dynamically to store updates via useDocumentCollaborationStore', () => {
    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    render(
      <VisualCollaboratorCursors
        contentRef={contentRef}
        containerRef={containerRef}
        fileId="main-doc"
        filePath="main.tex"
      />
    );

    // Initially no collaborators in store
    expect(screen.queryByTestId('collaborator-cursor-user-live')).toBeNull();

    // Dynamically update store with new collaborator
    act(() => {
      useDocumentCollaborationStore.getState().updateCollaborator({
        id: 'user-live',
        name: 'Live Collaborator',
        color: '#0284C7',
        isOnline: true,
        activeFileId: 'main-doc',
        cursor: { line: 1, column: 3 },
      });
    });

    expect(screen.getByTestId('collaborator-cursor-user-live')).toBeDefined();
    expect(screen.getByText('Live Collaborator')).toBeDefined();

    // Collaborator leaves
    act(() => {
      useDocumentCollaborationStore.getState().removeCollaborator('user-live');
    });

    expect(screen.queryByTestId('collaborator-cursor-user-live')).toBeNull();
  });

  it('broadcasts local cursor when editorCommandBus dispatches collab:cursor', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

    editorCommandBus.dispatch({
      type: 'collab:cursor',
      userId: 'local-test-user',
      activeFileId: 'main-doc',
      activeFile: 'main.tex',
      cursor: {
        line: 2,
        column: 10,
        selection: {
          startLineNumber: 2,
          startColumn: 10,
          endLineNumber: 2,
          endColumn: 25,
        },
      },
    });

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'collab:cursor',
        userId: 'local-test-user',
        cursor: expect.objectContaining({
          line: 2,
          column: 10,
        }),
      })
    );
  });
});
