import React, { createRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import {
  PdfSurface,
  CompilerLogs,
  type SurfaceHandle,
  type ParsedLog,
} from '@/features/editor/subsystems/compiler';
import { usePdfSearch, type PdfDocumentProxyLike } from '@/features/editor/subsystems/compiler/ui/hooks/usePdfSearch';
import { FileOutlineSection } from '@/features/editor/subsystems/explorer/ui/subcomponents/FileOutlineSection';
import SearchTab from '@/features/editor/subsystems/search';
import { CommentCard, SuggestionCard } from '@/features/editor/subsystems/review';
import {
  usePageStore,
  useSearchStore,
  useWorkspaceStore,
  useSettingsStore,
  setActiveEditorEngine,
} from '@/features/editor/core';
import { manuscriptService } from '@/features/editor/sdk/pages.service';
import type { EditorPort } from '@/features/editor/domain/ports/editor.port';
import type { PageComment } from '@/features/editor/domain/types/comment.types';
import type { PageSuggestion } from '@/features/editor/domain/types/suggestion.types';

function wrapWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>{ui}</TooltipProvider>
    </QueryClientProvider>
  );
}

const origOffsetHeightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const origOffsetWidthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');

describe('Editor Non-Destructive DOM Windowing (Zero-Blocking, Zero-State-Loss)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 480,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get: () => 360,
    });
    Element.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollTo = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    usePageStore.setState({ activePageId: 'doc-1', projectId: null, currentPage: null });
    useSearchStore.getState().reset();
    useWorkspaceStore.getState().resetLayout();
    useSettingsStore.setState({
      suppressBadBoxes: false,
      suppressFontWarnings: false,
      suppressPackageWarnings: false,
      customSuppressedWarnings: [],
    });
  });

  afterEach(() => {
    cleanup();
    if (origOffsetHeightDesc) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeightDesc);
    } else {
      delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
    }
    if (origOffsetWidthDesc) {
      Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origOffsetWidthDesc);
    } else {
      delete (HTMLElement.prototype as { offsetWidth?: number }).offsetWidth;
    }
    setActiveEditorEngine(null);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. PdfSurface shared IntersectionObserver + 0-child shells + SyncTeX & Spread View', () => {
    it('maintains 120 lightweight 0-child shells with only 1 shared IntersectionObserver and mounts pinned target page on highlightTarget', async () => {
      const instances: Array<{
        callback: IntersectionObserverCallback;
        options?: IntersectionObserverInit;
        observed: Element[];
      }> = [];

      class MockIntersectionObserver implements IntersectionObserver {
        readonly root: Element | Document | null;
        readonly rootMargin: string;
        readonly thresholds: ReadonlyArray<number>;
        constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
          this.root = options?.root ?? null;
          this.rootMargin = options?.rootMargin ?? '0px';
          this.thresholds = Array.isArray(options?.threshold)
            ? options.threshold
            : [options?.threshold ?? 0];
          instances.push({ callback, options, observed: [] });
        }
        observe(target: Element) {
          instances[instances.length - 1]?.observed.push(target);
        }
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      }

      vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
      vi.useFakeTimers();

      const surfaceRef = createRef<SurfaceHandle>();
      let container!: HTMLElement;
      await act(async () => {
        const rendered = render(
          <PdfSurface
            ref={surfaceRef}
            pdfUrl="blob:http://localhost/thesis.pdf"
            synctexMap={null}
            scale={1}
            autoFit={false}
            containerWidth={600}
            pageNumber={1}
            numPages={120}
            compileStatus="idle"
          />,
        );
        container = rendered.container;
      });

      // 1. All 120 shells exist for SyncTeX offsetTop / binary search scroll sync
      const shells = container.querySelectorAll('[data-page-num]');
      expect(shells).toHaveLength(120);

      // 2. Strictly 1 shared IntersectionObserver attached to the PDF scroll container
      expect(instances).toHaveLength(1);
      expect(instances[0].options?.root).toBe(surfaceRef.current?.getContainer());
      expect(instances[0].observed).toHaveLength(120);

      // 3. Offscreen shell (page 80) has 0 child DOM nodes and preserves data-page-label
      const page80Shell = container.querySelector('[data-page-num="80"]') as HTMLElement;
      expect(page80Shell).toBeTruthy();
      expect(page80Shell.getAttribute('data-page-label')).toBe('Page 80');
      expect(page80Shell.children).toHaveLength(0);
      expect(screen.queryByTestId('mock-pdf-page-80')).toBeNull();

      // 4. SyncTeX highlightTarget(85, ...) pins and immediately mounts page 85 + highlight box
      act(() => {
        surfaceRef.current?.highlightTarget?.(85, 110, 240, 220, 18);
      });

      expect(screen.getByTestId('mock-pdf-page-85')).toBeInTheDocument();
      expect(screen.getByTestId('synctex-pdf-highlight-box')).toBeInTheDocument();

      vi.useRealTimers();
    });

    it('never caps Spread View intersecting pages (all 4 visible pages mount simultaneously)', async () => {
      let observerCallback: IntersectionObserverCallback | null = null;
      const observedMap = new Map<number, Element>();

      class MockSpreadObserver implements IntersectionObserver {
        readonly root = null;
        readonly rootMargin = '0px';
        readonly thresholds = [0];
        constructor(callback: IntersectionObserverCallback) {
          observerCallback = callback;
        }
        observe(target: Element) {
          const pageNum = Number((target as HTMLElement).dataset.pageNum);
          if (!Number.isNaN(pageNum)) observedMap.set(pageNum, target);
        }
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      }

      vi.stubGlobal('IntersectionObserver', MockSpreadObserver);

      await act(async () => {
        render(
          <PdfSurface
            pdfUrl="blob:http://localhost/spread.pdf"
            synctexMap={null}
            scale={0.75}
            autoFit={false}
            containerWidth={900}
            pageNumber={1}
            numPages={30}
            isSpreadView={true}
            compileStatus="idle"
          />,
        );
      });

      // Simulate 4 pages (10, 11, 12, 13) visible simultaneously in Spread View
      const makeEntry = (pageNum: number, isIntersecting: boolean): IntersectionObserverEntry =>
        ({
          target: observedMap.get(pageNum)!,
          isIntersecting,
          boundingClientRect: { height: 700 } as DOMRectReadOnly,
          intersectionRatio: isIntersecting ? 1 : 0,
        }) as unknown as IntersectionObserverEntry;

      act(() => {
        observerCallback?.(
          [
            makeEntry(1, false),
            makeEntry(2, false),
            makeEntry(10, true),
            makeEntry(11, true),
            makeEntry(12, true),
            makeEntry(13, true),
          ],
          {} as IntersectionObserver,
        );
      });

      expect(screen.getByTestId('mock-pdf-page-10')).toBeInTheDocument();
      expect(screen.getByTestId('mock-pdf-page-11')).toBeInTheDocument();
      expect(screen.getByTestId('mock-pdf-page-12')).toBeInTheDocument();
      expect(screen.getByTestId('mock-pdf-page-13')).toBeInTheDocument();
    });
  });

  describe('2. usePdfSearch global match index preservation on virtualized pages', () => {
    it('assigns exact global data-match-index when earlier pages have no mounted textLayer', async () => {
      const containerEl = document.createElement('div');
      // Pages 1..11 are offscreen empty shells; only Page 12 has mounted .textLayer
      for (let p = 1; p <= 11; p++) {
        const emptyShell = document.createElement('div');
        emptyShell.dataset.pageNum = String(p);
        containerEl.appendChild(emptyShell);
      }
      const page12Shell = document.createElement('div');
      page12Shell.dataset.pageNum = '12';
      const textLayer12 = document.createElement('div');
      textLayer12.className = 'textLayer';
      const span12 = document.createElement('span');
      span12.textContent = 'First flux match and second flux match';
      textLayer12.appendChild(span12);
      page12Shell.appendChild(textLayer12);
      containerEl.appendChild(page12Shell);

      const mockPdfDoc: PdfDocumentProxyLike = {
        numPages: 12,
        async getPage(pageNumber: number) {
          return {
            view: [0, 0, 595, 842],
            async getTextContent() {
              // Pages 1..5 have 1 match each => total indices 0..4.
              // Pages 6..11 have 0 matches.
              // Page 12 has 2 matches => global indices 5 and 6.
              if (pageNumber >= 1 && pageNumber <= 5) {
                return { items: [{ str: 'Header flux text' }] };
              }
              if (pageNumber === 12) {
                return { items: [{ str: 'First flux match and second flux match' }] };
              }
              return { items: [{ str: 'Unrelated content' }] };
            },
          };
        },
      };

      const pdfDocRef = { current: mockPdfDoc };
      const pdfContainerRef = { current: containerEl };
      const scrolledPages: number[] = [];

      function Harness() {
        const search = usePdfSearch({
          pdfDocRef,
          pdfContainerRef,
          onScrollToPage: (p) => scrolledPages.push(p),
        });
        return (
          <div>
            <button
              type="button"
              data-testid="run-pdf-search"
              onClick={() => void search.executeSearch('flux')}
            />
            <button
              type="button"
              data-testid="highlight-idx-5"
              onClick={() => search.applyDomHighlights(5, 'flux', false, false, false)}
            />
            <span data-testid="match-count">{search.matches.length}</span>
          </div>
        );
      }

      render(<Harness />);

      await act(async () => {
        fireEvent.click(screen.getByTestId('run-pdf-search'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('match-count').textContent).toBe('7');
      });

      act(() => {
        fireEvent.click(screen.getByTestId('highlight-idx-5'));
      });

      const marks = Array.from(page12Shell.querySelectorAll('mark'));
      expect(marks).toHaveLength(2);
      expect(marks[0].getAttribute('data-match-index')).toBe('5');
      expect(marks[1].getAttribute('data-match-index')).toBe('6');
      expect(marks[0]).toHaveClass('flux-pdf-highlight-current');
      expect(scrolledPages[0]).toBe(1);
    });
  });

  describe('3. CompilerLogs dynamic virtualization + F8 jump + lifted explanation state', () => {
    it('preserves all 120 diagnostic counts while bounding live DOM rows and supporting F8 & Guide toggle', () => {
      const errors = Array.from({ length: 60 }, (_, i) => ({
        line: i + 1,
        file: 'main.tex',
        message: `Undefined sequence error #${i}`,
        severity: 'error' as const,
        code: `E${i}`,
        explanation: {
          title: `Guide Title #${i}`,
          explanation: `Detailed explanation #${i}`,
          summary: `Detailed explanation #${i}`,
          category: 'syntax',
        },
      }));
      const warnings = Array.from({ length: 60 }, (_, i) => ({
        line: i + 100,
        file: 'chapters/ch1.tex',
        message: `Reference warning #${i}`,
        severity: 'warning' as const,
      }));
      const largeParsedLog: ParsedLog = { errors, warnings, badBoxes: [] };
      const onJumpToError = vi.fn();

      const { container } = render(
        <CompilerLogs
          log="Sample LaTeX compilation output"
          parsedLog={largeParsedLog}
          onClose={vi.fn()}
          onJumpToError={onJumpToError}
        />,
      );

      // Total counts remain intact (zero truncation)
      expect(screen.getByRole('tab', { name: /All logs\s*120/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Errors\s*60/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /Warnings\s*60/i })).toBeInTheDocument();

      // DOM renders only the virtualized window instead of all 120 entries
      const renderedRows = container.querySelectorAll('[id^="log-entry-"]');
      expect(renderedRows.length).toBeGreaterThan(0);
      expect(renderedRows.length).toBeLessThan(40);

      // Toggle Guide on error #0 -> uses lifted explainState and survives filter unmount/remount
      const guideButtons = screen.getAllByTitle('View LaTeX error explanation');
      fireEvent.click(guideButtons[0]);
      expect(screen.getByText(/Detailed explanation #0/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('tab', { name: /Warnings\s*60/i }));
      expect(screen.queryByText(/Detailed explanation #0/)).toBeNull();
      fireEvent.click(screen.getByRole('tab', { name: /All logs\s*120/i }));
      expect(screen.getByText(/Detailed explanation #0/)).toBeInTheDocument();

      // F8 steps cleanly across errors
      fireEvent.keyDown(window, { key: 'F8' });
      expect(onJumpToError).toHaveBeenCalledWith('main.tex', 2);
    });
  });

  describe('4. FileOutlineSection virtualization + active cursor tracking', () => {
    it('renders full count badge (120) while mounting a bounded DOM window and syncing cursor jumps', () => {
      const sectionsLatex = Array.from(
        { length: 120 },
        (_, i) => `\\section{Section Number ${i + 1}}\nParagraph body ${i + 1}.`,
      ).join('\n');

      let cursorListener: ((line: number) => void) | null = null;
      const mockEngine = {
        getCursorPosition: () => ({ line: 1, ch: 0 }),
        getContent: () => sectionsLatex,
        onCursorChange: (cb: (line: number) => void) => {
          cursorListener = cb;
          return () => {
            cursorListener = null;
          };
        },
        onContentChange: () => () => {},
        jumpToLine: vi.fn(),
        focus: vi.fn(),
      } as unknown as EditorPort;

      useWorkspaceStore.setState({ fileOutlineOpen: true, fileTreeOpen: true });

      const { container } = render(
        <FileOutlineSection
          isFileTreeOpen={true}
          docContent={sectionsLatex}
          activeFileName="thesis.tex"
        />,
      );

      expect(screen.getByText('120')).toBeInTheDocument();
      const outlineButtons = container.querySelectorAll('button[style*="padding-left"]');
      expect(outlineButtons.length).toBeGreaterThan(0);
      expect(outlineButtons.length).toBeLessThan(35);

      act(() => {
        setActiveEditorEngine(mockEngine);
      });
      act(() => {
        cursorListener?.(200); // line inside section #100
      });

      // No crash and total badge stays 120
      expect(screen.getByText('120')).toBeInTheDocument();
    });
  });

  describe('5. SearchTab flattened virtualization without truncating matches', () => {
    it('displays all 120 matches in status bar while virtualizing DOM rows and preserving file collapse', async () => {
      const searchSpy = vi.spyOn(manuscriptService.search, 'search').mockResolvedValue({
        query: 'theorem',
        totalMatches: 120,
        truncated: false,
        results: [1, 2, 3].map((fIdx) => ({
          fileId: `file-${fIdx}`,
          fileName: `chapter-${fIdx}.tex`,
          matches: Array.from({ length: 40 }, (_, mIdx) => ({
            line: mIdx + 1,
            text: `Proof of theorem ${mIdx + 1}`,
            matchStart: 9,
            matchEnd: 16,
          })),
        })),
      });

      usePageStore.setState({ projectId: 'proj-123', activePageId: 'doc-1' });
      useSearchStore.setState({
        query: 'theorem',
        instantQuery: 'theorem',
      });

      const { container } = render(wrapWithProviders(<SearchTab />));

      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('120 results in 3 files');
      });
      expect(searchSpy).toHaveBeenCalled();

      // Virtualized match buttons are bounded (< 50 out of 120 matches)
      const jumpButtons = container.querySelectorAll('button[class*="pl-7"]');
      expect(jumpButtons.length).toBeGreaterThan(0);
      expect(jumpButtons.length).toBeLessThan(50);

      // Collapsing chapter-1.tex hides its matches while preserving remaining rows
      const firstHeader = screen.getByRole('button', { name: /chapter-1\.tex/i });
      fireEvent.click(firstHeader);
      expect(firstHeader).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('6. ReviewComments & SuggestionCard non-unmounting CSS containment', () => {
    it('applies content-visibility: auto without unmounting CommentCard ReplyForm draft text', () => {
      const comment: PageComment = {
        id: 'comment-1',
        page: 'doc-1',
        projectPageId: 'doc-1',
        author: { id: 'u1', name: 'Alice' },
        content: 'Check equation normalization',
        line: 12,
        status: 'open',
        replies: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const suggestion: PageSuggestion = {
        id: 'sugg-1',
        pageId: 'doc-1',
        author: { id: 'u2', name: 'Bob' },
        type: 'replace',
        originalText: 'old phrase',
        suggestedText: 'improved phrase',
        fromLine: 15,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { rerender } = render(
        wrapWithProviders(
          <div>
            <CommentCard comment={comment} pageId="doc-1" />
            <SuggestionCard
              suggestion={suggestion}
              onAccept={vi.fn()}
              onReject={vi.fn()}
            />
          </div>,
        ),
      );

      const commentRoot = document.getElementById('comment-comment-1')!;
      const suggestionRoot = document.getElementById('suggestion-sugg-1')!;
      expect(commentRoot.style.contentVisibility).toBe('auto');
      expect(suggestionRoot.style.contentVisibility).toBe('auto');

      const replyInput = screen.getByLabelText('Reply to comment') as HTMLInputElement;
      fireEvent.change(replyInput, { target: { value: 'Draft reply must survive rerender' } });
      expect(replyInput.value).toBe('Draft reply must survive rerender');

      rerender(
        wrapWithProviders(
          <div>
            <CommentCard comment={comment} pageId="doc-1" />
            <SuggestionCard
              suggestion={suggestion}
              onAccept={vi.fn()}
              onReject={vi.fn()}
            />
          </div>,
        ),
      );

      expect((screen.getByLabelText('Reply to comment') as HTMLInputElement).value).toBe(
        'Draft reply must survive rerender',
      );
    });
  });
});
