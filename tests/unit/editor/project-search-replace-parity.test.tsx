import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { editorCommandBus } from '@/features/editor/core';
import { keybindingCoordinator } from '@/features/editor/subsystems/keybinding';
import { useSearchStore } from '@/features/editor/core';
import { useWorkspaceStore } from '@/features/editor/core';
import { useProjectSearchActions } from '@/features/editor/subsystems/search';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import SearchTab from '@/features/editor/subsystems/search';
import { toast } from 'sonner';


vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/project/p1',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ projectId: 'proj-123', pageId: 'page-123' }),
}));

describe('Project Search & Replace (Overleaf Parity: Ctrl+Shift+F & Replace)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchStore.getState().reset();
    useWorkspaceStore.setState({ sidebarLeftOpen: false, activeSidebarTab: 'files' });
  });

  afterEach(() => {
    cleanup();
  });

  it('triggers sidebar:open-panel for Search when Ctrl+Shift+F keydown occurs', () => {
    const unsub = keybindingCoordinator.init();
    const commandSpy = vi.fn();
    const unsubBus = editorCommandBus.subscribe('sidebar:open-panel', commandSpy);

    // Press Ctrl+Shift+F
    fireEvent.keyDown(window, {
      key: 'F',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
    expect(useWorkspaceStore.getState().activeSidebarTab).toBe('search');
    expect(commandSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sidebar:open-panel',
        panel: 'Search',
      })
    );

    unsub();
    unsubBus();
  });

  it('prefills search query from active window text selection when Ctrl+Shift+F is pressed', () => {
    const unsub = keybindingCoordinator.init();
    const commandSpy = vi.fn();
    const unsubBus = editorCommandBus.subscribe('sidebar:open-panel', commandSpy);

    // Mock window.getSelection()
    const getSelectionSpy = vi.spyOn(window, 'getSelection').mockReturnValue({
      toString: () => 'quantum-computing',
    } as any);

    fireEvent.keyDown(window, {
      key: 'F',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(commandSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sidebar:open-panel',
        panel: 'Search',
        query: 'quantum-computing',
      })
    );

    getSelectionSpy.mockRestore();
    unsub();
    unsubBus();
  });

  it('opens Project Search with Replace expanded when Ctrl+Shift+H is pressed (Overleaf Parity)', () => {
    const unsub = keybindingCoordinator.init();
    const commandSpy = vi.fn();
    const unsubBus = editorCommandBus.subscribe('sidebar:open-panel', commandSpy);

    fireEvent.keyDown(window, {
      key: 'H',
      ctrlKey: true,
      shiftKey: true,
    });

    expect(useWorkspaceStore.getState().sidebarLeftOpen).toBe(true);
    expect(useWorkspaceStore.getState().activeSidebarTab).toBe('search');
    expect(commandSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sidebar:open-panel',
        panel: 'Search',
        showReplace: true,
      })
    );

    unsub();
    unsubBus();
  });

  it('useProjectSearchActions replaces single match accurately without modifying other occurrences', () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    let docContent = 'First algorithm in Section 1.\nSecond algorithm in Section 2.';
    const mockEngine: any = {
      getContent: () => docContent,
      setContent: vi.fn((newContent: string) => {
        docContent = newContent;
      }),
      jumpToLine: vi.fn(),
      focus: vi.fn(),
    };

    const { result } = renderHook(
      () =>
        useProjectSearchActions({
          engine: mockEngine,
          effectiveQuery: 'algorithm',
          replaceText: 'method',
          useRegex: false,
          wholeWord: false,
          caseSensitive: false,
          rootProjectId: 'proj-1',
          rootPageId: 'page-1',
          activeFileId: 'main.tex',
        }),
      { wrapper }
    );

    // Replace only the occurrence on line 2: "Second algorithm in Section 2."
    // matchStart = 7 ("algorithm" starts at index 7 in "Second algorithm...")
    // matchEnd = 16
    act(() => {
      result.current.handleReplaceSingleMatch('main.tex', 2, 7, 16);
    });

    expect(mockEngine.setContent).toHaveBeenCalledWith(
      'First algorithm in Section 1.\nSecond method in Section 2.'
    );
    expect(mockEngine.jumpToLine).toHaveBeenCalledWith(2, undefined, 7, 6);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Replaced occurrence'), expect.anything());
  });

  it('useProjectSearchActions replaces all matches in active file', () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    let docContent = 'First algorithm in Section 1.\nSecond algorithm in Section 2.';
    const mockEngine: any = {
      getContent: () => docContent,
      setContent: vi.fn((newContent: string) => {
        docContent = newContent;
      }),
      jumpToLine: vi.fn(),
      focus: vi.fn(),
    };

    const { result } = renderHook(
      () =>
        useProjectSearchActions({
          engine: mockEngine,
          effectiveQuery: 'algorithm',
          replaceText: 'procedure',
          useRegex: false,
          wholeWord: false,
          caseSensitive: false,
          rootProjectId: 'proj-1',
          rootPageId: 'page-1',
          activeFileId: 'main.tex',
        }),
      { wrapper }
    );

    act(() => {
      result.current.handleReplaceAllCurrentFile();
    });

    expect(mockEngine.setContent).toHaveBeenCalledWith(
      'First procedure in Section 1.\nSecond procedure in Section 2.'
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('active file'), expect.anything());
  });

  it('handleReplaceAllEverywhere flushes pending sessions, reconciles split-pane engines, and evicts cache', async () => {
    const { documentSearchService } = await import('@/features/editor/sdk/manuscript.service');
    const { sessionCoordinator, documentAuthority, lruDocumentCache } = await import('@/features/editor/core');
    const flushSpy = vi.spyOn(sessionCoordinator, 'flushAllPending').mockResolvedValue(undefined as any);
    const batchReplaceSpy = vi.spyOn(documentSearchService, 'batchReplace').mockResolvedValue({
      totalFilesAffected: 2,
      totalOccurrencesReplaced: 3,
      affectedFileIds: ['file-main', 'file-sec'],
      failedFileIds: [],
    } as any);

    let secContent = 'Old text in sec';
    const mockSecEngine: any = {
      getContent: () => secContent,
      setContent: (c: string) => {
        secContent = c;
      },
    };
    const getEngineSpy = vi.spyOn(documentAuthority, 'getEditorEngineForFile').mockImplementation((id: string) => {
      if (id === 'file-sec') return mockSecEngine;
      return null;
    });
    const evictSpy = vi.spyOn(lruDocumentCache, 'evictModel');

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () =>
        useProjectSearchActions({
          engine: null,
          effectiveQuery: 'Old',
          replaceText: 'New',
          useRegex: false,
          wholeWord: false,
          caseSensitive: false,
          rootProjectId: 'proj-1',
          rootPageId: 'page-1',
          activeFileId: 'file-main',
        }),
      { wrapper }
    );

    await act(async () => {
      await result.current.handleReplaceAllEverywhere();
    });

    expect(flushSpy).toHaveBeenCalled();
    expect(batchReplaceSpy).toHaveBeenCalledWith('proj-1', 'Old', 'New', expect.anything());
    // file-sec was mounted in split-pane -> content replaced directly
    expect(secContent).toBe('New text in sec');
    // file-main was not mounted in editor engine -> model evicted from cache
    expect(evictSpy).toHaveBeenCalledWith('file-main');

    flushSpy.mockRestore();
    batchReplaceSpy.mockRestore();
    getEngineSpy.mockRestore();
    evictSpy.mockRestore();
  });

  it('renders SearchTab header without close button (Overleaf parity)', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SearchTab />
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Header has title "Search"
    expect(screen.getByText('Search')).toBeInTheDocument();

    // Does NOT render Close button in header
    expect(screen.queryByRole('button', { name: /close search/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/close search/i)).not.toBeInTheDocument();
  });

  it('renders strictly 1:1 Overleaf project search options: Aa, [.*], W only', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SearchTab />
        </TooltipProvider>
      </QueryClientProvider>
    );

    // Overleaf project search input placeholder
    expect(screen.getByPlaceholderText('Search all project files...')).toBeInTheDocument();

    // 1:1 Overleaf search options present
    expect(screen.getByRole('button', { name: 'Match Case' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Regular Expression' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Whole Word' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle replace/i })).toBeInTheDocument();

    // Elements NOT in Overleaf Project Search sidebar
    expect(screen.queryByRole('button', { name: /find in selection/i })).not.toBeInTheDocument();
    expect(screen.queryByText('All project files')).not.toBeInTheDocument();
    expect(screen.queryByText('Current file')).not.toBeInTheDocument();
  });
});
