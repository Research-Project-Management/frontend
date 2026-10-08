import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createRef } from 'react';
import { render, screen, act, cleanup } from '@testing-library/react';
import {
  PdfSyncTeXHighlightBox,
  PdfSurface,
  type SurfaceHandle,
  type SynctexHighlightState,
} from '@/features/editor/ui/features/preview/PdfSurface';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { LatexCompilerEngine } from '@/features/editor/coordinators/services/latex-compiler-engine.service';
import { usePageStore } from '@/features/editor/store';

// Mock react-pdf to avoid canvas & worker initialization in jsdom
vi.mock('react-pdf', () => ({
  Document: ({ children, onLoadSuccess }: any) => {
    React.useEffect(() => {
      onLoadSuccess?.({ numPages: 2 });
    }, [onLoadSuccess]);
    return <div data-testid="mock-pdf-document">{children}</div>;
  },
  Page: ({ pageNumber }: any) => (
    <div data-testid={`mock-pdf-page-${pageNumber}`} style={{ width: 600, height: 800 }}>
      Page Content {pageNumber}
    </div>
  ),
  pdfjs: {
    GlobalWorkerOptions: {
      workerSrc: '',
    },
  },
}));

// Mock intersection observer for jsdom
vi.mock('@/shared/hooks', () => ({
  useIntersectionObserver: () => ({
    isIntersecting: true,
    entry: null,
  }),
}));

describe('PDF Canvas SyncTeX Visual Highlight Box (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. PdfSyncTeXHighlightBox Component', () => {
    it('renders forward highlight box with synctex-pdf-highlight-box styling and testid', () => {
      const indicator: SynctexHighlightState = {
        page: 1,
        x: 100,
        y: 250,
        w: 300,
        h: 20,
        id: 12345,
        type: 'forward',
      };

      render(
        <PdfSyncTeXHighlightBox
          indicator={indicator}
          pageWidth={600}
          scale={1}
        />
      );

      const box = screen.getByTestId('synctex-pdf-highlight-box');
      expect(box).toBeInTheDocument();
      expect(box).toHaveClass('synctex-pdf-highlight-box');

      // Left accent bar
      const accentBar = screen.getByTestId('synctex-pdf-accent-bar');
      expect(accentBar).toBeInTheDocument();

      // Style assertions
      expect(box.style.left).toBe('96px'); // max(8, 100 - 4)
      expect(box.style.top).toBe('250px');
      expect(box.style.width).toBe('308px'); // max(300 + 8, 48)
      expect(box.style.height).toBe('24px'); // max(20 + 4, 16)
    });

    it('computes robust fallback width and height when w and h are omitted (SyncTeX point records)', () => {
      const indicator: SynctexHighlightState = {
        page: 1,
        x: 80,
        y: 350,
        id: 23456,
        type: 'forward',
      };

      render(
        <PdfSyncTeXHighlightBox
          indicator={indicator}
          pageWidth={600}
          scale={1.2}
        />
      );

      const box = screen.getByTestId('synctex-pdf-highlight-box');
      expect(box).toBeInTheDocument();
      expect(box.style.left).toBe('76px'); // 80 - 4
      expect(box.style.top).toBe('350px');

      // Fallback width spans up to pageWidth - left - 24 = 600 - 76 - 24 = 500 clamped at max 480
      expect(box.style.width).toBe('480px');
      // Fallback height is proportional to scale: 18 * 1.2 = 21.6 -> 22px
      expect(parseInt(box.style.height, 10)).toBeGreaterThanOrEqual(18);
    });

    it('renders backward ripple radar marker when type is backward without box dimensions', () => {
      const indicator: SynctexHighlightState = {
        page: 1,
        x: 200,
        y: 400,
        id: 34567,
        type: 'backward',
      };

      render(
        <PdfSyncTeXHighlightBox
          indicator={indicator}
          pageWidth={600}
          scale={1}
        />
      );

      expect(screen.queryByTestId('synctex-pdf-highlight-box')).toBeNull();
      const ripple = screen.getByTestId('synctex-pdf-backward-ripple');
      expect(ripple).toBeInTheDocument();
      expect(ripple.style.left).toBe('200px');
      expect(ripple.style.top).toBe('400px');
    });
  });

  describe('2. PdfSurface Imperative Handle & Interaction', () => {
    it('triggers highlight box on target page when highlightTarget is called', () => {
      const surfaceRef = createRef<SurfaceHandle>();

      act(() => {
        render(
          <PdfSurface
            ref={surfaceRef}
            pdfUrl="blob:http://localhost/test.pdf"
            synctexMap={null}
            scale={1}
            autoFit={false}
            containerWidth={600}
            pageNumber={1}
            numPages={2}
            compileStatus="idle"
          />
        );
      });

      expect(surfaceRef.current).toBeTruthy();

      act(() => {
        surfaceRef.current?.highlightTarget?.(1, 120, 280, 250, 18);
      });

      const highlightBox = screen.getByTestId('synctex-pdf-highlight-box');
      expect(highlightBox).toBeInTheDocument();
      expect(highlightBox.style.left).toBe('116px');
      expect(highlightBox.style.top).toBe('280px');
    });

    it('clears highlight box when clearHighlight is called', () => {
      const surfaceRef = createRef<SurfaceHandle>();

      act(() => {
        render(
          <PdfSurface
            ref={surfaceRef}
            pdfUrl="blob:http://localhost/test.pdf"
            synctexMap={null}
            scale={1}
            autoFit={false}
            containerWidth={600}
            pageNumber={1}
            numPages={2}
            compileStatus="idle"
          />
        );
      });

      act(() => {
        surfaceRef.current?.highlightTarget?.(1, 120, 280, 250, 18);
      });
      expect(screen.getByTestId('synctex-pdf-highlight-box')).toBeInTheDocument();

      act(() => {
        surfaceRef.current?.clearHighlight?.();
      });
      expect(screen.queryByTestId('synctex-pdf-highlight-box')).toBeNull();
    });

    it('auto-dismisses highlight box after fade duration (1900ms)', () => {
      const surfaceRef = createRef<SurfaceHandle>();

      act(() => {
        render(
          <PdfSurface
            ref={surfaceRef}
            pdfUrl="blob:http://localhost/test.pdf"
            synctexMap={null}
            scale={1}
            autoFit={false}
            containerWidth={600}
            pageNumber={1}
            numPages={2}
            compileStatus="idle"
          />
        );
      });

      act(() => {
        surfaceRef.current?.highlightTarget?.(1, 120, 280, 250, 18);
      });
      expect(screen.getByTestId('synctex-pdf-highlight-box')).toBeInTheDocument();

      // Advance timers by 1000ms: still visible while fading
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('synctex-pdf-highlight-box')).toBeInTheDocument();

      // Advance timers past 1900ms: cleanly unmounted from DOM
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByTestId('synctex-pdf-highlight-box')).toBeNull();
    });

    it('scrolls container to golden 1/3 viewport offset', () => {
      const surfaceRef = createRef<SurfaceHandle>();

      act(() => {
        render(
          <PdfSurface
            ref={surfaceRef}
            pdfUrl="blob:http://localhost/test.pdf"
            synctexMap={null}
            scale={1}
            autoFit={false}
            containerWidth={600}
            pageNumber={1}
            numPages={2}
            compileStatus="idle"
          />
        );
      });

      const container = surfaceRef.current?.getContainer();
      expect(container).toBeTruthy();

      const scrollToSpy = vi.spyOn(container!, 'scrollTo');

      act(() => {
        surfaceRef.current?.highlightTarget?.(1, 100, 300, 200, 20);
      });

      expect(scrollToSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          behavior: 'smooth',
        })
      );
    });
  });
});
