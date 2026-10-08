/**
 * collaborator-avatar-stack.test.tsx
 *
 * Comprehensive Unit Test Suite for Topbar Collaborator Presence Avatar Stack.
 *
 * Verifies:
 * 1. Name initials extraction (getInitials) with Unicode/Vietnamese support.
 * 2. Empty state behavior (clean null return when solo/offline).
 * 3. Overlapping circular avatar stack with custom collaborator color rings.
 * 4. Image avatar fallback vs user initials rendering.
 * 5. Online pulse indicator (active green vs idle amber).
 * 6. Accessible aria-labels and tooltip information (document, line/column).
 * 7. 1-Click jump to collaborator's active document & cursor coordinates.
 * 8. Overflow badge (+N) rendering and interactive Popover participant list.
 * 9. Dynamic store updates via useDocumentCollaborationStore (set, update, remove).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import React from 'react';
import {
  CollaboratorAvatarStack,
  getInitials,
} from '@/features/editor/ui/shell/topbar/CollaboratorAvatarStack';
import {
  useDocumentCollaborationStore,
  type CollaboratorPresenceInfo,
} from '@/features/editor/store/collaboration.store';
import { navigationCoordinator } from '@/features/editor/coordinators/navigation.coordinator';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'proj-1', pageId: 'page-1' }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/projects/proj-1/pages/page-1',
}));

// Mock ProjectService.getMembers to avoid real network requests
vi.mock('@/features/projects/shell/services/project.service', () => ({
  ProjectService: {
    getMembers: vi.fn().mockResolvedValue({ members: [] }),
  },
}));

describe('CollaboratorAvatarStack - Real-Time Presence & Jump Subsystem', () => {
  const sampleCollaborators: CollaboratorPresenceInfo[] = [
    {
      id: 'user-1',
      name: 'Alice Johnson',
      email: 'alice@flux.latex',
      color: '#2563EB',
      isOnline: true,
      activeFile: 'chapters/intro.tex',
      activeFileId: 'doc-intro',
      cursor: { line: 42, column: 8 },
    },
    {
      id: 'user-2',
      name: 'Bob Smith',
      email: 'bob@flux.latex',
      color: '#7C3AED',
      isOnline: false,
      activeFile: 'main.tex',
      activeFileId: 'doc-main',
      cursor: { line: 110, column: 1 },
    },
    {
      id: 'user-3',
      name: 'Charlie Brown',
      color: '#DB2777',
      avatar: 'https://flux.latex/avatars/charlie.png',
      isOnline: true,
      activeFile: 'references.bib',
      activeFileId: 'doc-bib',
      cursor: { line: 15, column: 22 },
    },
  ];

  beforeEach(() => {
    cleanup();
    useDocumentCollaborationStore.getState().clearCollaborators();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Name Initials Utility (getInitials)', () => {
    it('generates 2-letter uppercase initials for two-word names', () => {
      expect(getInitials('Alice Smith')).toBe('AS');
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('generates 2 letters for single-word names', () => {
      expect(getInitials('Einstein')).toBe('EI');
      expect(getInitials('TeX')).toBe('TE');
    });

    it('handles first and last word initials for multi-word or Vietnamese names', () => {
      expect(getInitials('Nguyen Van An')).toBe('NA');
      expect(getInitials('Marie Sklodowska Curie')).toBe('MC');
    });

    it('returns "?" for empty or invalid names', () => {
      expect(getInitials('')).toBe('?');
      expect(getInitials('   ')).toBe('?');
      expect(getInitials(undefined)).toBe('?');
    });
  });

  describe('2. Empty State Handling', () => {
    it('renders null when there are no active collaborators', () => {
      const { container } = render(
        <TooltipProvider>
          <CollaboratorAvatarStack collaborators={[]} />
        </TooltipProvider>
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders null when store has empty collaborators list', () => {
      const { container } = render(
        <TooltipProvider>
          <CollaboratorAvatarStack />
        </TooltipProvider>
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('3. Avatar Stack Rendering & Color Rings', () => {
    it('renders circular avatars with user initials and custom color borders', () => {
      render(
        <TooltipProvider>
          <CollaboratorAvatarStack collaborators={sampleCollaborators} />
        </TooltipProvider>
      );

      // Check initials rendered
      expect(screen.getByText('AJ')).toBeDefined();
      expect(screen.getByText('BS')).toBeDefined();

      // Check aria-labels for accessibility
      const aliceBtn = screen.getByLabelText(/Collaborator Alice Johnson/i);
      expect(aliceBtn).toBeDefined();
      expect(aliceBtn.style.borderColor).toMatch(/rgb\(37,\s*99,\s*235\)|#2563EB/i);

      const bobBtn = screen.getByLabelText(/Collaborator Bob Smith/i);
      expect(bobBtn).toBeDefined();
      expect(bobBtn.style.borderColor).toMatch(/rgb\(124,\s*58,\s*237\)|#7C3AED/i);
    });

    it('renders profile image when avatar URL is provided', () => {
      render(
        <TooltipProvider>
          <CollaboratorAvatarStack collaborators={sampleCollaborators} />
        </TooltipProvider>
      );

      const charlieImg = screen.getByAltText('Charlie Brown') as HTMLImageElement;
      expect(charlieImg).toBeDefined();
      expect(charlieImg.src).toBe('https://flux.latex/avatars/charlie.png');
    });

    it('displays online pulse indicator for active users and idle for offline users', () => {
      render(
        <TooltipProvider>
          <CollaboratorAvatarStack collaborators={sampleCollaborators} />
        </TooltipProvider>
      );

      // Online user Alice has title Online
      expect(screen.getAllByTitle('Online').length).toBe(2); // Alice and Charlie
      expect(screen.getAllByTitle('Idle').length).toBe(1); // Bob
    });
  });

  describe('4. 1-Click Jump to Collaborator Cursor & File', () => {
    it('calls navigationCoordinator.jumpToLine and dispatches command on avatar click', () => {
      const jumpToLineSpy = vi.spyOn(navigationCoordinator, 'jumpToLine');
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

      render(
        <TooltipProvider>
          <CollaboratorAvatarStack collaborators={sampleCollaborators} />
        </TooltipProvider>
      );

      const aliceBtn = screen.getByLabelText(/Collaborator Alice Johnson/i);
      fireEvent.click(aliceBtn);

      expect(jumpToLineSpy).toHaveBeenCalledWith({
        fileId: 'doc-intro',
        filePath: 'chapters/intro.tex',
        line: 42,
        column: 8,
        highlight: 'synctex',
      });

      expect(dispatchSpy).toHaveBeenCalledWith({
        type: 'navigation:jump-to-line',
        fileId: 'doc-intro',
        filePath: 'chapters/intro.tex',
        line: 42,
        column: 8,
        highlight: 'synctex',
      });
    });

    it('invokes custom onJumpToCollaborator callback if provided', () => {
      const customCallback = vi.fn();

      render(
        <TooltipProvider>
          <CollaboratorAvatarStack
            collaborators={sampleCollaborators}
            onJumpToCollaborator={customCallback}
          />
        </TooltipProvider>
      );

      const bobBtn = screen.getByLabelText(/Collaborator Bob Smith/i);
      fireEvent.click(bobBtn);

      expect(customCallback).toHaveBeenCalledWith(sampleCollaborators[1]);
    });
  });

  describe('5. Overflow Handling & Popover List (+N)', () => {
    const manyCollaborators: CollaboratorPresenceInfo[] = [
      ...sampleCollaborators,
      {
        id: 'user-4',
        name: 'David Hilbert',
        color: '#059669',
        isOnline: true,
        activeFile: 'geometry.tex',
        cursor: { line: 75, column: 1 },
      },
      {
        id: 'user-5',
        name: 'Emmy Noether',
        color: '#EA580C',
        isOnline: true,
        activeFile: 'algebra.tex',
        cursor: { line: 200, column: 5 },
      },
    ];

    it('renders maximum visible avatars and +N badge when exceeding maxVisible', () => {
      render(
        <TooltipProvider>
          <CollaboratorAvatarStack
            collaborators={manyCollaborators}
            maxVisible={3}
          />
        </TooltipProvider>
      );

      // Visible 3: Alice, Bob, Charlie
      expect(screen.getByText('AJ')).toBeDefined();
      expect(screen.getByText('BS')).toBeDefined();
      expect(screen.getByAltText('Charlie Brown')).toBeDefined();

      // Overflow badge (+2)
      const overflowBadge = screen.getByText('+2');
      expect(overflowBadge).toBeDefined();
    });

    it('opens Popover showing all active collaborators with Jump buttons on +N click', () => {
      const jumpSpy = vi.spyOn(navigationCoordinator, 'jumpToLine');

      render(
        <TooltipProvider>
          <CollaboratorAvatarStack
            collaborators={manyCollaborators}
            maxVisible={3}
          />
        </TooltipProvider>
      );

      const overflowBtn = screen.getByLabelText('+2 more collaborators');
      fireEvent.click(overflowBtn);

      // Popover title
      expect(screen.getByText('Active Collaborators (5)')).toBeDefined();

      // David Hilbert and Emmy Noether are listed inside popover
      expect(screen.getByText('David Hilbert')).toBeDefined();
      expect(screen.getByText('Emmy Noether')).toBeDefined();

      // Click Jump button for David Hilbert
      const jumpDavid = screen.getByLabelText('Jump to David Hilbert');
      fireEvent.click(jumpDavid);

      expect(jumpSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: 'geometry.tex',
          line: 75,
        })
      );
    });
  });

  describe('6. Reactive Store Integration via useDocumentCollaborationStore', () => {
    it('reacts dynamically to store additions, updates, and removals', () => {
      const { rerender } = render(
        <TooltipProvider>
          <CollaboratorAvatarStack />
        </TooltipProvider>
      );

      // Initially empty
      expect(screen.queryByRole('group', { name: 'Active collaborators' })).toBeNull();

      // 1. setCollaborators
      act(() => {
        useDocumentCollaborationStore.getState().setCollaborators([
          {
            id: 'dyn-1',
            name: 'Kurt Godel',
            color: '#2563EB',
            isOnline: true,
            activeFile: 'logic.tex',
            cursor: { line: 10, column: 1 },
          },
        ]);
      });

      rerender(
        <TooltipProvider>
          <CollaboratorAvatarStack />
        </TooltipProvider>
      );

      expect(screen.getByText('KG')).toBeDefined();

      // 2. updateCollaborator (idle status change)
      act(() => {
        useDocumentCollaborationStore.getState().updateCollaborator({
          id: 'dyn-1',
          isOnline: false,
          activeFile: 'incompleteness.tex',
          cursor: { line: 88, column: 4 },
        });
      });

      rerender(
        <TooltipProvider>
          <CollaboratorAvatarStack />
        </TooltipProvider>
      );

      expect(screen.getByTitle('Idle')).toBeDefined();

      // 3. removeCollaborator
      act(() => {
        useDocumentCollaborationStore.getState().removeCollaborator('dyn-1');
      });

      rerender(
        <TooltipProvider>
          <CollaboratorAvatarStack />
        </TooltipProvider>
      );

      expect(screen.queryByText('KG')).toBeNull();
    });
  });
});
