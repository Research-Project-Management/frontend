/**
 * review-panel-overleaf-parity.test.tsx
 *
 * Comprehensive Unit & Integration Test Suite for:
 * - Overleaf Parity Review Panel & Track Changes
 * - Topbar "Review" toggle button with live pending badge count
 * - EditorToolbar "Add Comment" button & Ctrl+Alt+M keyboard shortcut
 * - SuggestionCard 1-click Accept / Reject mutations & diff rendering
 * - SuggestionBulkActions 1-click Accept All & Reject All
 * - CodeMirror line jump with centered scroll and flash highlight
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { useLayoutStore } from '@/features/editor/store/layout.store';
import { usePageStore } from '@/features/editor/store/editor.store';
import { useDocumentCollaborationStore } from '@/features/editor/store/collaboration.store';
import { useReviewPendingCount } from '@/features/editor/ui/features/sidebar/review/hooks/useReviewPendingCount';
import { SuggestionCard } from '@/features/editor/ui/features/sidebar/review/subcomponents/SuggestionCard';
import { SuggestionBulkActions } from '@/features/editor/ui/features/sidebar/review/subcomponents/SuggestionBulkActions';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { EditorToolbar } from '@/features/editor/ui/features/editor/EditorToolbar';
import { ActivityBar } from '@/features/editor/ui/shell/ActivityBar';
import { Topbar } from '@/features/editor/ui/shell/Topbar';
import { reviewCoordinator } from '@/features/editor/coordinators/review.coordinator';
import { jumpToEditorLine } from '@/features/editor/ui/features/sidebar/review/utils/review.util';
import { editorCommandBus, setActiveEditorEngine } from '@/features/editor/coordinators/command-bus';
import type { PageSuggestion } from '@/features/editor/domain/types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: 'proj-123', pageId: 'doc-456' }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/editor/proj-123',
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock hooks
const mockComments: any[] = [];
const mockSuggestions: PageSuggestion[] = [];

vi.mock('@/features/editor/ui/hooks/use-comment', () => ({
  usePageComments: () => ({
    data: mockComments,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/features/editor/ui/hooks/use-suggestion', () => ({
  usePageSuggestions: () => ({
    data: mockSuggestions,
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/features/editor/ui/hooks/use-core', () => ({
  usePageActions: () => ({
    updateTitle: { isPending: false },
  }),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        {ui}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

describe('Track Changes & Review Panel (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.removeAttribute('data-scroll-locked');
    document.body.style.pointerEvents = '';
    document.querySelectorAll('[aria-hidden]').forEach((el) => {
      el.removeAttribute('aria-hidden');
    });

    useLayoutStore.getState().resetLayout();
    useDocumentCollaborationStore.getState().clearPendingComment();
    usePageStore.setState({ activePageId: 'doc-456', projectId: 'proj-123' });

    mockComments.length = 0;
    mockSuggestions.length = 0;
  });

  afterEach(() => {
    cleanup();
    setActiveEditorEngine(null);
  });

  describe('1. Layout Store Review Panel State & Dimensions', () => {
    it('initializes reviewPanelOpen as false and reviewPanelWidth as 340', () => {
      const state = useLayoutStore.getState();
      expect(state.reviewPanelOpen).toBe(false);
      expect(state.reviewPanelWidth).toBe(340);
    });

    it('toggles reviewPanelOpen via toggleReviewPanel()', () => {
      useLayoutStore.getState().toggleReviewPanel();
      expect(useLayoutStore.getState().reviewPanelOpen).toBe(true);

      useLayoutStore.getState().toggleReviewPanel();
      expect(useLayoutStore.getState().reviewPanelOpen).toBe(false);
    });

    it('sets reviewPanelWidth with boundaries clamped between 260 and 520', () => {
      useLayoutStore.getState().setReviewPanelWidth(100);
      expect(useLayoutStore.getState().reviewPanelWidth).toBe(260);

      useLayoutStore.getState().setReviewPanelWidth(600);
      expect(useLayoutStore.getState().reviewPanelWidth).toBe(520);

      useLayoutStore.getState().setReviewPanelWidth(400);
      expect(useLayoutStore.getState().reviewPanelWidth).toBe(400);
    });
  });

  describe('2. Pending Count Badge Hook (useReviewPendingCount)', () => {
    function CountTestComponent() {
      const { pendingSuggestionsCount, openCommentsCount, totalPendingCount } =
        useReviewPendingCount('doc-456');
      return (
        <div>
          <span data-testid="suggestions-count">{pendingSuggestionsCount}</span>
          <span data-testid="comments-count">{openCommentsCount}</span>
          <span data-testid="total-count">{totalPendingCount}</span>
        </div>
      );
    }

    it('calculates counts accurately from active suggestions and comments', () => {
      mockSuggestions.push(
        {
          id: 'sug-1',
          pageId: 'doc-456',
          projectId: 'proj-123',
          type: 'insert',
          originalText: '',
          suggestedText: 'collaborative ',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: { id: 'u1', name: 'Alice' },
        },
        {
          id: 'sug-2',
          pageId: 'doc-456',
          projectId: 'proj-123',
          type: 'delete',
          originalText: 'obsolete',
          suggestedText: '',
          status: 'accepted',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          author: { id: 'u2', name: 'Bob' },
        }
      );

      mockComments.push(
        { id: 'com-1', pageId: 'doc-456', content: 'Note 1', status: 'open' },
        { id: 'com-2', pageId: 'doc-456', content: 'Note 2', status: 'resolved' }
      );

      renderWithClient(<CountTestComponent />);

      expect(screen.getByTestId('suggestions-count').textContent).toBe('1');
      expect(screen.getByTestId('comments-count').textContent).toBe('1');
      expect(screen.getByTestId('total-count').textContent).toBe('2');
    });
  });

  describe('3. ActivityBar "Review & Comments" Tab & Topbar Cleanup', () => {
    it('renders the Review tab in ActivityBar and toggles left sidebar to review on click', () => {
      renderWithClient(<ActivityBar />);

      const reviewTab = screen.getByRole('tab', { name: /Review & Comments/i });
      expect(reviewTab).toBeDefined();

      expect(useLayoutStore.getState().activeSidebarTab).toBe('files');
      fireEvent.click(reviewTab);
      expect(useLayoutStore.getState().activeSidebarTab).toBe('review');
      expect(useLayoutStore.getState().sidebarLeftOpen).toBe(true);

      fireEvent.click(reviewTab);
      expect(useLayoutStore.getState().sidebarLeftOpen).toBe(false);
    });

    it('displays live badge count on ActivityBar review tab when there are pending review items', () => {
      mockSuggestions.push({
        id: 'sug-1',
        pageId: 'doc-456',
        projectId: 'proj-123',
        type: 'insert',
        originalText: '',
        suggestedText: 'Hello',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: { id: 'u1', name: 'Alice' },
      });

      renderWithClient(<ActivityBar />);

      const reviewTab = screen.getByRole('tab', { name: /Review & Comments/i });
      expect(reviewTab).toBeDefined();
      expect(reviewTab.textContent).toContain('1');
    });

    it('verifies Topbar does not render the redundant review button', () => {
      renderWithClient(<Topbar />);
      const reviewBtn = screen.queryByRole('button', { name: /Review/i });
      expect(reviewBtn).toBeNull();
    });
  });

  describe('4. EditorToolbar "Add Comment" Button & Ctrl+Alt+M Shortcut', () => {
    it('renders Add Comment button and opens PrimarySidebar review tab with pendingComment', () => {
      const mockEngine = {
        getSelection: vi.fn().mockReturnValue({ fromLine: 12, toLine: 14 }),
        getCursorPosition: vi.fn().mockReturnValue({ line: 12, column: 1 }),
        getSelectedText: vi.fn().mockReturnValue('\\textbf{Collaborative research}'),
      };
      setActiveEditorEngine(mockEngine as any);

      renderWithClient(<EditorToolbar />);

      const commentBtn = screen.getByRole('button', { name: /Add Comment/i });
      expect(commentBtn).toBeDefined();

      fireEvent.click(commentBtn);

      const pending = useDocumentCollaborationStore.getState().pendingComment;
      expect(pending).toBeDefined();
      expect(pending?.startLine).toBe(12);
      expect(pending?.endLine).toBe(14);
      expect(pending?.selectedText).toBe('\\textbf{Collaborative research}');
      expect(useLayoutStore.getState().activeSidebarTab).toBe('review');
      expect(useLayoutStore.getState().sidebarLeftOpen).toBe(true);
    });

    it('triggers Add Comment on Ctrl+Alt+M keydown', () => {
      const mockEngine = {
        getSelection: vi.fn().mockReturnValue({ fromLine: 5, toLine: 5 }),
        getCursorPosition: vi.fn().mockReturnValue({ line: 5, column: 1 }),
        getSelectedText: vi.fn().mockReturnValue('Theorem 1'),
      };
      setActiveEditorEngine(mockEngine as any);

      renderWithClient(<EditorToolbar />);

      fireEvent.keyDown(window, {
        key: 'm',
        ctrlKey: true,
        altKey: true,
      });

      const pending = useDocumentCollaborationStore.getState().pendingComment;
      expect(pending).toBeDefined();
      expect(pending?.startLine).toBe(5);
      expect(pending?.selectedText).toBe('Theorem 1');
      expect(useLayoutStore.getState().activeSidebarTab).toBe('review');
      expect(useLayoutStore.getState().sidebarLeftOpen).toBe(true);
    });
  });

  describe('5. SuggestionCard UI & 1-Click Accept/Reject Actions', () => {
    const testSuggestion: PageSuggestion = {
      id: 'sug-42',
      pageId: 'doc-456',
      projectId: 'proj-123',
      type: 'insert',
      originalText: 'old text',
      suggestedText: 'modern text',
      status: 'pending',
      createdAt: '2026-10-08T12:00:00Z',
      updatedAt: '2026-10-08T12:00:00Z',
      fromLine: 25,
      fromColumn: 1,
      toLine: 25,
      toColumn: 10,
      author: {
        id: 'user-7',
        name: 'Dr. Katherine',
        email: 'katherine@mit.edu',
      },
      description: 'Updated nomenclature',
    };

    it('renders author metadata, line badge, and diff representation', () => {
      const handleNavigate = vi.fn();
      const handleAccept = vi.fn();
      const handleReject = vi.fn();

      renderWithClient(
        <SuggestionCard
          suggestion={testSuggestion}
          onNavigate={handleNavigate}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      );

      expect(screen.getByText('Dr. Katherine')).toBeDefined();
      expect(screen.getByText('- old text')).toBeDefined();
      expect(screen.getByText('+ modern text')).toBeDefined();
      expect(screen.getByText('“Updated nomenclature”')).toBeDefined();

      const lineBadge = screen.getByRole('button', { name: /Jump to line 25/i });
      fireEvent.click(lineBadge);
      expect(handleNavigate).toHaveBeenCalledWith(25);
    });

    it('triggers 1-click Accept and Reject callbacks', () => {
      const handleAccept = vi.fn();
      const handleReject = vi.fn();

      renderWithClient(
        <SuggestionCard
          suggestion={testSuggestion}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      );

      const acceptBtn = screen.getByRole('button', { name: /Accept/i });
      fireEvent.click(acceptBtn);
      expect(handleAccept).toHaveBeenCalledWith('sug-42');

      const rejectBtn = screen.getByRole('button', { name: /Reject/i });
      fireEvent.click(rejectBtn);
      expect(handleReject).toHaveBeenCalledWith('sug-42');
    });
  });

  describe('6. SuggestionBulkActions (Accept All / Reject All)', () => {
    it('renders pending count and calls bulk mutations on click', () => {
      const onAcceptAll = vi.fn();
      const onRejectAll = vi.fn();

      renderWithClient(
        <SuggestionBulkActions
          count={5}
          onAcceptAll={onAcceptAll}
          onRejectAll={onRejectAll}
        />
      );

      expect(screen.getByText('5 pending suggestions')).toBeDefined();

      const acceptAllBtn = screen.getByRole('button', { name: /Accept All/i });
      fireEvent.click(acceptAllBtn);
      expect(onAcceptAll).toHaveBeenCalledTimes(1);

      const rejectAllBtn = screen.getByRole('button', { name: /Reject All/i });
      fireEvent.click(rejectAllBtn);
      expect(onRejectAll).toHaveBeenCalledTimes(1);
    });

    it('returns null when count is 0', () => {
      const { container } = renderWithClient(
        <SuggestionBulkActions
          count={0}
          onAcceptAll={vi.fn()}
          onRejectAll={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('7. CodeMirror Centered Navigation & Flash Highlight', () => {
    it('dispatches editor:jump-to-line with synctex highlight on jumpToEditorLine', () => {
      const jumpEvents: any[] = [];
      const unsub = editorCommandBus.subscribe('editor:jump-to-line', (cmd) => {
        jumpEvents.push(cmd);
      });

      jumpToEditorLine(42);

      expect(jumpEvents.length).toBe(1);
      expect(jumpEvents[0]).toEqual({
        type: 'editor:jump-to-line',
        line: 42,
        highlight: 'synctex',
      });

      unsub();
    });

    it('delegates navigateToLine in reviewCoordinator to active engine with synctex highlight', () => {
      const jumpToLineMock = vi.fn();
      setActiveEditorEngine({
        jumpToLine: jumpToLineMock,
      } as any);

      reviewCoordinator.navigateToLine(88);

      expect(jumpToLineMock).toHaveBeenCalledWith(88, 'synctex');
    });
  });
});
