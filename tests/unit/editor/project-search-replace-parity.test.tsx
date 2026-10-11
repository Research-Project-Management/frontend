import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { keybindingCoordinator } from '@/features/editor/coordinators/keybinding.coordinator';
import { useSearchStore } from '@/features/editor/store/search.store';
import { useLayoutStore } from '@/features/editor/store/layout.store';
import { useProjectSearchActions } from '@/features/editor/ui/features/sidebar/search/useProjectSearchActions';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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
    useLayoutStore.setState({ sidebarLeftOpen: false, activeSidebarTab: 'files' });
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

    expect(useLayoutStore.getState().sidebarLeftOpen).toBe(true);
    expect(useLayoutStore.getState().activeSidebarTab).toBe('search');
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

    expect(useLayoutStore.getState().sidebarLeftOpen).toBe(true);
    expect(useLayoutStore.getState().activeSidebarTab).toBe('search');
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
    expect(mockEngine.jumpToLine).toHaveBeenCalledWith(2);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Replaced occurrence'));
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
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('active file'));
  });
});
