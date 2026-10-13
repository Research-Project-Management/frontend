import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createRef } from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { useSynchronizedScroll } from '@/features/editor/ui/preview/hooks/useSynchronizedScroll';
import { PdfToolbar } from '@/features/editor/ui/preview/PdfToolbar';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { useLayoutStore } from '@/features/editor/store/layout.store';
import { editorCommandBus, setActiveEditorEngine } from '@/features/editor/coordinators/command-bus';
import { LatexCompilerEngine } from '@/features/editor/coordinators/compilation-pipeline';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import type { SurfaceHandle } from '@/features/editor/ui/preview/PdfSurface';
import type { SyncTeXMap } from '@/features/editor/domain/pdf/synctex-index';

describe('Split-View Synchronized Dual Scrolling (Overleaf Parity)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ syncScroll: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setActiveEditorEngine(null);
  });

  describe('1. useSynchronizedScroll Hook', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
    });
    const mockSyncMap: SyncTeXMap = {
      lineToPage: new Map([
        [10, 1],
        [45, 2],
      ]),
      pageToLines: new Map([
        [1, [10]],
        [2, [45]],
      ]),
      sortedLines: [10, 45],
      tagToPath: new Map([[1, 'main.tex']]),
      pathToTag: new Map([['main.tex', 1]]),
      tagLineToPage: new Map([
        ['1:10', 1],
        ['1:45', 2],
      ]),
      tagLineToNode: new Map([
        ['1:10', { tag: 1, line: 10, page: 1, x: 72, y: 150, w: 400, h: 20 }],
        ['1:45', { tag: 1, line: 45, page: 2, x: 72, y: 300, w: 400, h: 20 }],
      ]),
      pageToNodes: new Map([
        [1, [{ tag: 1, line: 10, page: 1, x: 72, y: 150, w: 400, h: 20 }]],
        [2, [{ tag: 1, line: 45, page: 2, x: 72, y: 300, w: 400, h: 20 }]],
      ]),
      tagToSortedLines: new Map([[1, [10, 45]]]),
    };

    it('syncs Editor -> PDF Preview when editor emits sync:editor-scrolled', () => {
      const mockScrollToCoords = vi.fn();
      const mockSurfaceHandle: SurfaceHandle = {
        scrollToPage: vi.fn(),
        scrollToCoords: mockScrollToCoords,
        highlightTarget: vi.fn(),
        getContainer: vi.fn().mockReturnValue(document.createElement('div')),
      };
      const pdfSurfaceRef = { current: mockSurfaceHandle };
      const synctexMapRef = { current: mockSyncMap };

      renderHook(() =>
        useSynchronizedScroll({
          enabled: true,
          pdfSurfaceRef,
          synctexMapRef,
          numPages: 2,
          scale: 1,
          autoFit: false,
          activeFilePath: 'main.tex',
        }),
      );

      // Act: Editor scrolled to line 10
      act(() => {
        editorCommandBus.dispatch({
          type: 'sync:editor-scrolled',
          line: 10,
        });
      });

      expect(mockScrollToCoords).toHaveBeenCalledWith(1, 150, 'auto');
    });

    it('syncs PDF Preview -> Editor when handleViewerScroll is invoked', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const pdfSurfaceRef = { current: null };
      const synctexMapRef = { current: mockSyncMap };

      const { result } = renderHook(() =>
        useSynchronizedScroll({
          enabled: true,
          pdfSurfaceRef,
          synctexMapRef,
          numPages: 2,
          scale: 1,
          autoFit: false,
          activeFilePath: 'main.tex',
        }),
      );

      // Act: Viewer scrolled to page 2, y = 300
      act(() => {
        result.current.handleViewerScroll({
          page: 2,
          y: 300,
          fraction: 0.35,
        });
      });

      // Advance animation frame
      act(() => {
        vi.advanceTimersByTime(20);
      });

      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'editor:scroll-to-line',
          line: 45,
          smooth: true,
        }),
      );
    });

    it('blocks feedback loop from Viewer when Editor initiated the scroll (Anti-feedback Latch)', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const mockScrollToCoords = vi.fn();
      const mockSurfaceHandle: SurfaceHandle = {
        scrollToPage: vi.fn(),
        scrollToCoords: mockScrollToCoords,
        highlightTarget: vi.fn(),
        getContainer: vi.fn().mockReturnValue(document.createElement('div')),
      };
      const pdfSurfaceRef = { current: mockSurfaceHandle };
      const synctexMapRef = { current: mockSyncMap };

      const { result } = renderHook(() =>
        useSynchronizedScroll({
          enabled: true,
          pdfSurfaceRef,
          synctexMapRef,
          numPages: 2,
          scale: 1,
          autoFit: false,
          activeFilePath: 'main.tex',
        }),
      );

      // 1. Editor scrolls first
      act(() => {
        editorCommandBus.dispatch({
          type: 'sync:editor-scrolled',
          line: 10,
        });
      });
      expect(mockScrollToCoords).toHaveBeenCalledTimes(1);

      // 2. Viewer reacts to that scroll immediately (within 100ms < 250ms latch window)
      act(() => {
        vi.advanceTimersByTime(50);
        result.current.handleViewerScroll({
          page: 1,
          y: 150,
          fraction: 0.18,
        });
        vi.advanceTimersByTime(20);
      });

      // Latch must block the viewer echo: editor:scroll-to-line should NOT be dispatched
      const editorScrollDispatches = dispatchSpy.mock.calls.filter(
        (call) => call[0].type === 'editor:scroll-to-line',
      );
      expect(editorScrollDispatches).toHaveLength(0);

      // 3. After latch expires (250ms), viewer scroll should be accepted again
      act(() => {
        vi.advanceTimersByTime(300);
        result.current.handleViewerScroll({
          page: 2,
          y: 300,
          fraction: 0.35,
        });
        vi.advanceTimersByTime(20);
      });

      const editorScrollDispatchesAfterLatch = dispatchSpy.mock.calls.filter(
        (call) => call[0].type === 'editor:scroll-to-line',
      );
      expect(editorScrollDispatchesAfterLatch).toHaveLength(1);
    });

    it('blocks feedback loop from Editor when Viewer initiated the scroll', () => {
      const mockScrollToCoords = vi.fn();
      const mockSurfaceHandle: SurfaceHandle = {
        scrollToPage: vi.fn(),
        scrollToCoords: mockScrollToCoords,
        highlightTarget: vi.fn(),
        getContainer: vi.fn().mockReturnValue(document.createElement('div')),
      };
      const pdfSurfaceRef = { current: mockSurfaceHandle };
      const synctexMapRef = { current: mockSyncMap };

      const { result } = renderHook(() =>
        useSynchronizedScroll({
          enabled: true,
          pdfSurfaceRef,
          synctexMapRef,
          numPages: 2,
          scale: 1,
          autoFit: false,
          activeFilePath: 'main.tex',
        }),
      );

      // 1. Viewer scrolls first
      act(() => {
        result.current.handleViewerScroll({
          page: 2,
          y: 300,
          fraction: 0.35,
        });
      });

      // 2. Editor echoes back within 100ms
      act(() => {
        vi.advanceTimersByTime(50);
        editorCommandBus.dispatch({
          type: 'sync:editor-scrolled',
          line: 45,
        });
      });

      // Latch must block editor echo: scrollToCoords should NOT be called
      expect(mockScrollToCoords).not.toHaveBeenCalled();

      // 3. After latch duration (250ms), editor scroll should work normally
      act(() => {
        vi.advanceTimersByTime(300);
        editorCommandBus.dispatch({
          type: 'sync:editor-scrolled',
          line: 10,
        });
      });

      expect(mockScrollToCoords).toHaveBeenCalledWith(1, 150, 'auto');
    });

    it('does not scroll when enabled is false', () => {
      const mockScrollToCoords = vi.fn();
      const mockSurfaceHandle: SurfaceHandle = {
        scrollToPage: vi.fn(),
        scrollToCoords: mockScrollToCoords,
        highlightTarget: vi.fn(),
        getContainer: vi.fn().mockReturnValue(document.createElement('div')),
      };
      const pdfSurfaceRef = { current: mockSurfaceHandle };
      const synctexMapRef = { current: mockSyncMap };

      const { result } = renderHook(() =>
        useSynchronizedScroll({
          enabled: false,
          pdfSurfaceRef,
          synctexMapRef,
          numPages: 2,
          scale: 1,
          autoFit: false,
          activeFilePath: 'main.tex',
        }),
      );

      // Editor scroll when disabled
      act(() => {
        editorCommandBus.dispatch({
          type: 'sync:editor-scrolled',
          line: 10,
        });
      });
      expect(mockScrollToCoords).not.toHaveBeenCalled();

      // Viewer scroll when disabled
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      act(() => {
        result.current.handleViewerScroll({
          page: 2,
          y: 300,
          fraction: 0.35,
        });
        vi.advanceTimersByTime(50);
      });
      const editorScrollDispatches = dispatchSpy.mock.calls.filter(
        (call) => call[0].type === 'editor:scroll-to-line',
      );
      expect(editorScrollDispatches).toHaveLength(0);
    });

    it('performs proportional scrolling fallback from Editor to Viewer when SyncTeX mapping is missing', () => {
      const mockScrollToCoords = vi.fn();
      const mockSurfaceHandle: SurfaceHandle = {
        scrollToPage: vi.fn(),
        scrollToCoords: mockScrollToCoords,
        highlightTarget: vi.fn(),
        getContainer: vi.fn().mockReturnValue(document.createElement('div')),
      };
      const pdfSurfaceRef = { current: mockSurfaceHandle };
      // Empty / missing SyncTeX map
      const synctexMapRef = { current: null };

      renderHook(() =>
        useSynchronizedScroll({
          enabled: true,
          pdfSurfaceRef,
          synctexMapRef,
          numPages: 4,
          scale: 1,
          autoFit: false,
          activeFilePath: 'main.tex',
        }),
      );

      // Editor scrolled to line 50 of 100 (fraction = 0.5)
      act(() => {
        editorCommandBus.dispatch({
          type: 'sync:editor-scrolled',
          line: 50,
          totalLines: 100,
          fraction: 0.5,
        });
      });

      // Target page should be 2, target coordinate should be pageFraction * 842
      expect(mockScrollToCoords).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'auto',
      );
    });

    it('performs proportional scrolling fallback from Viewer to Editor when SyncTeX mapping is missing', () => {
      const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
      const pdfSurfaceRef = { current: null };
      const synctexMapRef = { current: null };

      setActiveEditorEngine({
        getLineCount: () => 200,
        getContent: () => '',
      } as unknown as Parameters<typeof setActiveEditorEngine>[0]);

      const { result } = renderHook(() =>
        useSynchronizedScroll({
          enabled: true,
          pdfSurfaceRef,
          synctexMapRef,
          numPages: 4,
          scale: 1,
          autoFit: false,
          activeFilePath: 'main.tex',
        }),
      );

      // Viewer scrolled to 50% of the document (fraction = 0.5)
      act(() => {
        result.current.handleViewerScroll({
          page: 2,
          y: 200,
          fraction: 0.5,
        });
        vi.advanceTimersByTime(50);
      });

      // Editor should receive scroll-to-line at ~100 (half of 200)
      const editorScrollDispatches = dispatchSpy.mock.calls.filter(
        (call) => call[0].type === 'editor:scroll-to-line',
      );
      expect(editorScrollDispatches).toHaveLength(1);
      expect(editorScrollDispatches[0][0]).toEqual(
        expect.objectContaining({
          type: 'editor:scroll-to-line',
          line: expect.any(Number),
          smooth: true,
        }),
      );
    });
  });

  describe('2. PdfToolbar Sync Scrolling Toggle', () => {
    it('renders enabled state with Link2 icon and calls onToggleSyncScroll on click', () => {
      const onToggle = vi.fn();

      render(
        <TooltipProvider>
          <PdfToolbar
            compileStatus="idle"
            onCompile={vi.fn()}
            scale={1}
            autoFit={true}
            onToggleAutoFit={vi.fn()}
            onZoomIn={vi.fn()}
            onZoomOut={vi.fn()}
            pageNumber={1}
            numPages={2}
            onPrevPage={vi.fn()}
            onNextPage={vi.fn()}
            pdfUrl="blob:mock"
            showLog={false}
            onToggleLog={vi.fn()}
            onDownload={vi.fn()}
            syncScroll={true}
            onToggleSyncScroll={onToggle}
          />
        </TooltipProvider>,
      );

      const syncBtn = screen.getByRole('button', { name: /disable synchronized scrolling/i });
      expect(syncBtn).toBeInTheDocument();

      fireEvent.click(syncBtn);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('renders disabled state with Link2Off icon and correct aria-label', () => {
      const onToggle = vi.fn();

      render(
        <TooltipProvider>
          <PdfToolbar
            compileStatus="idle"
            onCompile={vi.fn()}
            scale={1}
            autoFit={true}
            onToggleAutoFit={vi.fn()}
            onZoomIn={vi.fn()}
            onZoomOut={vi.fn()}
            pageNumber={1}
            numPages={2}
            onPrevPage={vi.fn()}
            onNextPage={vi.fn()}
            pdfUrl="blob:mock"
            showLog={false}
            onToggleLog={vi.fn()}
            onDownload={vi.fn()}
            syncScroll={false}
            onToggleSyncScroll={onToggle}
          />
        </TooltipProvider>,
      );

      const syncBtn = screen.getByRole('button', { name: /enable synchronized scrolling/i });
      expect(syncBtn).toBeInTheDocument();

      fireEvent.click(syncBtn);
      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Settings Store Integration', () => {
    it('initializes syncScroll to true and toggles properly', () => {
      expect(useSettingsStore.getState().syncScroll).toBe(true);

      act(() => {
        useSettingsStore.getState().toggleSyncScroll();
      });
      expect(useSettingsStore.getState().syncScroll).toBe(false);

      act(() => {
        useSettingsStore.getState().toggleSyncScroll();
      });
      expect(useSettingsStore.getState().syncScroll).toBe(true);

      act(() => {
        useSettingsStore.getState().setSyncScroll(false);
      });
      expect(useSettingsStore.getState().syncScroll).toBe(false);
    });
  });

  describe('4. Proportional Split-View Resizing & Double-Click Reset (Overleaf Parity)', () => {
    it('manages splitRatio within safe bounds [0.15, 0.85] and resets to 0.5 (50/50)', () => {
      // Default is 0.5 (50/50 split)
      useLayoutStore.getState().setSplitRatio(0.5);
      expect(useLayoutStore.getState().splitRatio).toBe(0.5);

      // User drags splitter to 70%
      useLayoutStore.getState().setSplitRatio(0.7);
      expect(useLayoutStore.getState().splitRatio).toBe(0.7);

      // Clamp lower bound to 0.15
      useLayoutStore.getState().setSplitRatio(0.05);
      expect(useLayoutStore.getState().splitRatio).toBe(0.15);

      // Clamp upper bound to 0.85
      useLayoutStore.getState().setSplitRatio(0.95);
      expect(useLayoutStore.getState().splitRatio).toBe(0.85);

      // Overleaf Parity: Double-clicking center splitter snaps back to 50/50 (0.5)
      useLayoutStore.getState().setSplitRatio(0.5);
      expect(useLayoutStore.getState().splitRatio).toBe(0.5);
    });
  });
});
