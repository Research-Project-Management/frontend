import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useRef } from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import {
  usePdfSearch,
  buildPdfSearchRegex,
  escapePdfSearchRegExp,
} from '@/features/editor/ui/features/preview/hooks/use-pdf-search';
import { PdfFindBar } from '@/features/editor/ui/features/preview/PdfFindBar';
import {
  editorCommandBus,
  setActiveEditorEngine,
} from '@/features/editor/coordinators/command-bus';

describe('Phase 11: In-Document PDF Text Search & Selection Layer Sync (Overleaf Parity)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
    cleanup();
    vi.restoreAllMocks();
    setActiveEditorEngine(null);
  });

  describe('1. Search Regex & Query Parser', () => {
    it('escapes special regex characters when regex is disabled', () => {
      const rx = buildPdfSearchRegex('foo.bar (test) [1]', false, false, false);
      expect(rx).not.toBeNull();
      expect(rx?.test('foo.bar (test) [1]')).toBe(true);
      expect(rx?.test('fooxbar (test) [1]')).toBe(false);
    });

    it('honors case sensitivity flag', () => {
      const caseInsensitive = buildPdfSearchRegex('LaTeX', false, false, false, false);
      expect(caseInsensitive?.test('latex')).toBe(true);
      expect(caseInsensitive?.test('LATEX')).toBe(true);

      const caseSensitive = buildPdfSearchRegex('LaTeX', true, false, false, false);
      expect(caseSensitive?.test('latex')).toBe(false);
      expect(caseSensitive?.test('LaTeX')).toBe(true);
    });

    it('enforces whole word boundaries when requested', () => {
      const substringRx = buildPdfSearchRegex('cat', false, false, false);
      expect(substringRx?.test('caterpillar')).toBe(true);
      expect(substringRx?.test('the cat sat')).toBe(true);

      const wholeWordRx = buildPdfSearchRegex('cat', false, true, false);
      expect(wholeWordRx?.test('caterpillar')).toBe(false);
      expect(wholeWordRx?.test('the cat sat')).toBe(true);
    });

    it('supports arbitrary regular expressions when regex flag is true', () => {
      const rx = buildPdfSearchRegex('\\bEq\\.\\s*\\d+', false, false, true);
      expect(rx).not.toBeNull();
      expect(rx?.test('refer to Eq. 42')).toBe(true);
      expect(rx?.test('refer to Equation 42')).toBe(false);
    });

    it('gracefully handles invalid regex syntax without crashing', () => {
      const invalidRx = buildPdfSearchRegex('[unclosed-bracket', false, false, true);
      expect(invalidRx).toBeNull();
    });
  });

  describe('2. PdfFindBar Component UI & Keyboard Shortcuts', () => {
    it('renders search input, filter toggles, navigation buttons, and counter', () => {
      const onQueryChange = vi.fn();
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const onClose = vi.fn();
      const onToggleCaseSensitive = vi.fn();
      const onToggleWholeWord = vi.fn();
      const onToggleRegex = vi.fn();

      render(
        <PdfFindBar
          isOpen={true}
          query="Quantum"
          onQueryChange={onQueryChange}
          matchesCount={5}
          currentMatchIndex={1}
          isSearching={false}
          caseSensitive={true}
          onToggleCaseSensitive={onToggleCaseSensitive}
          wholeWord={false}
          onToggleWholeWord={onToggleWholeWord}
          useRegex={false}
          onToggleRegex={onToggleRegex}
          onNext={onNext}
          onPrev={onPrev}
          onClose={onClose}
        />,
      );

      expect(screen.getByPlaceholderText('Find in document…')).toHaveValue('Quantum');
      expect(screen.getByText('2/5')).toBeInTheDocument();

      // Case Sensitive toggle button is pressed
      const caseBtn = screen.getByLabelText('Match Case');
      expect(caseBtn).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(caseBtn);
      expect(onToggleCaseSensitive).toHaveBeenCalledTimes(1);

      // Whole Word toggle button
      const wordBtn = screen.getByLabelText('Match Whole Word');
      fireEvent.click(wordBtn);
      expect(onToggleWholeWord).toHaveBeenCalledTimes(1);

      // Regex toggle button
      const regexBtn = screen.getByLabelText('Use Regular Expression');
      fireEvent.click(regexBtn);
      expect(onToggleRegex).toHaveBeenCalledTimes(1);

      // Navigation buttons
      fireEvent.click(screen.getByLabelText('Next match'));
      expect(onNext).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText('Previous match'));
      expect(onPrev).toHaveBeenCalledTimes(1);

      // Close button
      fireEvent.click(screen.getByLabelText('Close find bar'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('displays "No matches" when query yields 0 results and "Invalid regex" on regex error', () => {
      const { rerender } = render(
        <PdfFindBar
          isOpen={true}
          query="NonExistentTerm"
          onQueryChange={vi.fn()}
          matchesCount={0}
          currentMatchIndex={0}
          isSearching={false}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('No matches')).toBeInTheDocument();

      rerender(
        <PdfFindBar
          isOpen={true}
          query="[invalid"
          onQueryChange={vi.fn()}
          matchesCount={0}
          currentMatchIndex={0}
          isSearching={false}
          isRegexError={true}
          onNext={vi.fn()}
          onPrev={vi.fn()}
          onClose={vi.fn()}
        />,
      );
      expect(screen.getByText('Invalid regex')).toBeInTheDocument();
    });

    it('triggers Next on Enter, Prev on Shift+Enter, Close on Esc, and shortcut toggles', () => {
      const onNext = vi.fn();
      const onPrev = vi.fn();
      const onClose = vi.fn();
      const onToggleCaseSensitive = vi.fn();
      const onToggleWholeWord = vi.fn();
      const onToggleRegex = vi.fn();

      render(
        <PdfFindBar
          isOpen={true}
          query="test"
          onQueryChange={vi.fn()}
          matchesCount={3}
          currentMatchIndex={0}
          isSearching={false}
          onToggleCaseSensitive={onToggleCaseSensitive}
          onToggleWholeWord={onToggleWholeWord}
          onToggleRegex={onToggleRegex}
          onNext={onNext}
          onPrev={onPrev}
          onClose={onClose}
        />,
      );

      const input = screen.getByPlaceholderText('Find in document…');

      // Enter -> Next
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
      expect(onNext).toHaveBeenCalledTimes(1);

      // Shift+Enter -> Prev
      fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
      expect(onPrev).toHaveBeenCalledTimes(1);

      // Alt+C -> Toggle Case
      fireEvent.keyDown(input, { key: 'c', altKey: true });
      expect(onToggleCaseSensitive).toHaveBeenCalledTimes(1);

      // Alt+W -> Toggle Whole Word
      fireEvent.keyDown(input, { key: 'w', altKey: true });
      expect(onToggleWholeWord).toHaveBeenCalledTimes(1);

      // Alt+R -> Toggle Regex
      fireEvent.keyDown(input, { key: 'r', altKey: true });
      expect(onToggleRegex).toHaveBeenCalledTimes(1);

      // Esc -> Close
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. usePdfSearch Engine & Multi-Page Scanning', () => {
    function createMockPdfDoc() {
      return {
        numPages: 2,
        getPage: vi.fn().mockImplementation(async (pageNum: number) => {
          if (pageNum === 1) {
            return {
              getTextContent: async () => ({
                items: [
                  { str: 'Introduction to Quantum Mechanics' },
                  { str: 'In this section, we study quantum states.' },
                ],
              }),
            };
          } else {
            return {
              getTextContent: async () => ({
                items: [
                  { str: 'Conclusion and summary of quantum entanglement.' },
                ],
              }),
            };
          }
        }),
      };
    }

    function TestSearchHarness({
      initialOpen = false,
      onScrollToPage = vi.fn(),
    }: {
      initialOpen?: boolean;
      onScrollToPage?: (p: number) => void;
    }) {
      const mockPdf = useRef<any>(createMockPdfDoc());
      const containerRef = useRef<HTMLDivElement | null>(null);

      const search = usePdfSearch({
        pdfDocRef: mockPdf,
        pdfContainerRef: containerRef,
        onScrollToPage,
      });

      return (
        <div>
          <button data-testid="toggle-btn" onClick={() => search.toggleSearch()}>
            Toggle
          </button>
          <button
            data-testid="search-quantum"
            onClick={() => {
              search.openSearch('quantum');
            }}
          >
            Search Quantum
          </button>
          <button data-testid="next-btn" onClick={() => search.nextMatch()}>
            Next
          </button>
          <button data-testid="prev-btn" onClick={() => search.prevMatch()}>
            Prev
          </button>
          <button
            data-testid="toggle-case"
            onClick={() => search.toggleCaseSensitive()}
          >
            Toggle Case
          </button>
          <button
            data-testid="toggle-word"
            onClick={() => search.toggleWholeWord()}
          >
            Toggle Word
          </button>

          <div data-testid="match-count">{search.matches.length}</div>
          <div data-testid="current-index">{search.currentMatchIndex}</div>
          <div data-testid="is-open">{search.isOpen ? 'open' : 'closed'}</div>
          <div data-testid="query-val">{search.query}</div>

          {/* Render mock DOM text layer for highlighting */}
          <div ref={containerRef} data-testid="pdf-container">
            <div className="textLayer" data-page="1">
              <span data-testid="span-1">Introduction to Quantum Mechanics</span>
              <span data-testid="span-2">In this section, we study quantum states.</span>
            </div>
            <div className="textLayer" data-page="2">
              <span data-testid="span-3">Conclusion and summary of quantum entanglement.</span>
            </div>
          </div>
        </div>
      );
    }

    it('indexes text across multiple pages and finds all matching occurrences', async () => {
      const onScrollToPage = vi.fn();
      render(<TestSearchHarness onScrollToPage={onScrollToPage} />);

      expect(screen.getByTestId('is-open')).toHaveTextContent('closed');

      // Open and search "quantum" (case-insensitive)
      fireEvent.click(screen.getByTestId('search-quantum'));

      expect(screen.getByTestId('is-open')).toHaveTextContent('open');
      expect(screen.getByTestId('query-val')).toHaveTextContent('quantum');

      // Fast-forward debounce timer (180ms)
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      // 3 matches found: page 1 (Quantum), page 1 (quantum), page 2 (quantum)
      expect(screen.getByTestId('match-count')).toHaveTextContent('3');
      expect(screen.getByTestId('current-index')).toHaveTextContent('0');
      expect(onScrollToPage).toHaveBeenCalledWith(1);
    });

    it('navigates through matches with nextMatch and prevMatch wrapping around', async () => {
      const onScrollToPage = vi.fn();
      render(<TestSearchHarness onScrollToPage={onScrollToPage} />);

      fireEvent.click(screen.getByTestId('search-quantum'));
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.getByTestId('current-index')).toHaveTextContent('0');

      // Next -> match 1
      fireEvent.click(screen.getByTestId('next-btn'));
      expect(screen.getByTestId('current-index')).toHaveTextContent('1');

      // Next -> match 2 (on page 2)
      fireEvent.click(screen.getByTestId('next-btn'));
      expect(screen.getByTestId('current-index')).toHaveTextContent('2');
      expect(onScrollToPage).toHaveBeenLastCalledWith(2);

      // Next -> wraps back to match 0
      fireEvent.click(screen.getByTestId('next-btn'));
      expect(screen.getByTestId('current-index')).toHaveTextContent('0');
      expect(onScrollToPage).toHaveBeenLastCalledWith(1);

      // Prev -> wraps backwards to match 2
      fireEvent.click(screen.getByTestId('prev-btn'));
      expect(screen.getByTestId('current-index')).toHaveTextContent('2');
    });

    it('filters accurately when case sensitivity is toggled', async () => {
      render(<TestSearchHarness />);

      fireEvent.click(screen.getByTestId('search-quantum'));
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.getByTestId('match-count')).toHaveTextContent('3');

      // Toggle Case Sensitive: 'quantum' matches lowercase only (page 1: 1, page 2: 1 -> 2 matches)
      fireEvent.click(screen.getByTestId('toggle-case'));
      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.getByTestId('match-count')).toHaveTextContent('2');
    });

    it('applies DOM marks into .textLayer with active spotlight (.flux-pdf-highlight-current)', async () => {
      render(<TestSearchHarness />);

      fireEvent.click(screen.getByTestId('search-quantum'));
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      // Allow async search promise to complete
      await act(async () => {
        await Promise.resolve();
      });

      const container = screen.getByTestId('pdf-container');
      const marks = container.querySelectorAll('.flux-pdf-highlight');
      expect(marks.length).toBeGreaterThan(0);

      const activeMark = container.querySelector('.flux-pdf-highlight-current');
      expect(activeMark).not.toBeNull();
      expect(activeMark?.textContent?.toLowerCase()).toBe('quantum');
    });

    it('cleans up DOM marks and normalizes text nodes when closed', async () => {
      render(<TestSearchHarness />);

      fireEvent.click(screen.getByTestId('search-quantum'));
      await act(async () => {
        vi.advanceTimersByTime(250);
      });
      await act(async () => {
        await Promise.resolve();
      });

      const container = screen.getByTestId('pdf-container');
      expect(container.querySelectorAll('.flux-pdf-highlight').length).toBeGreaterThan(0);

      // Toggle search off
      fireEvent.click(screen.getByTestId('toggle-btn'));

      expect(screen.getByTestId('is-open')).toHaveTextContent('closed');
      expect(container.querySelectorAll('.flux-pdf-highlight').length).toBe(0);
      expect(container.querySelectorAll('.flux-pdf-highlight-current').length).toBe(0);
    });
  });

  describe('4. Selection Layer & Command Bus Synchronization', () => {
    it('pre-fills find bar with selected text from CodeMirror editor on open', () => {
      const mockEngine = {
        getSelectedText: vi.fn().mockReturnValue('Hamiltonian'),
      };
      setActiveEditorEngine(
        mockEngine as unknown as Parameters<typeof setActiveEditorEngine>[0],
      );

      const mockPdf = {
        current: {
          numPages: 1,
          getPage: vi.fn().mockResolvedValue({
            getTextContent: async () => ({ items: [] }),
          }),
        },
      };
      const containerRef = { current: document.createElement('div') };

      function SelectionHarness() {
        const search = usePdfSearch({
          pdfDocRef: mockPdf,
          pdfContainerRef: containerRef,
        });

        return (
          <div>
            <button data-testid="open-empty" onClick={() => search.openSearch()}>
              Open
            </button>
            <div data-testid="query-text">{search.query}</div>
          </div>
        );
      }

      render(<SelectionHarness />);

      fireEvent.click(screen.getByTestId('open-empty'));
      expect(screen.getByTestId('query-text')).toHaveTextContent('Hamiltonian');
    });

    it('responds to viewer:find, viewer:find-next, viewer:find-prev command bus events', async () => {
      const mockPdf = {
        current: {
          numPages: 1,
          getPage: vi.fn().mockResolvedValue({
            getTextContent: async () => ({
              items: [{ str: 'alpha beta gamma alpha delta' }],
            }),
          }),
        },
      };
      const containerRef = { current: document.createElement('div') };

      function BusHarness() {
        const search = usePdfSearch({
          pdfDocRef: mockPdf,
          pdfContainerRef: containerRef,
        });

        return (
          <div>
            <div data-testid="bus-open">{search.isOpen ? 'open' : 'closed'}</div>
            <div data-testid="bus-query">{search.query}</div>
            <div data-testid="bus-index">{search.currentMatchIndex}</div>
          </div>
        );
      }

      render(<BusHarness />);

      expect(screen.getByTestId('bus-open')).toHaveTextContent('closed');

      // Dispatch viewer:find from anywhere in the application
      act(() => {
        editorCommandBus.dispatch({
          type: 'viewer:find',
          query: 'alpha',
        });
      });

      expect(screen.getByTestId('bus-open')).toHaveTextContent('open');
      expect(screen.getByTestId('bus-query')).toHaveTextContent('alpha');

      await act(async () => {
        vi.advanceTimersByTime(250);
      });

      expect(screen.getByTestId('bus-index')).toHaveTextContent('0');

      // Dispatch viewer:find-next
      act(() => {
        editorCommandBus.dispatch({ type: 'viewer:find-next' });
      });
      expect(screen.getByTestId('bus-index')).toHaveTextContent('1');

      // Dispatch viewer:find-prev
      act(() => {
        editorCommandBus.dispatch({ type: 'viewer:find-prev' });
      });
      expect(screen.getByTestId('bus-index')).toHaveTextContent('0');

      // Dispatch close
      act(() => {
        editorCommandBus.dispatch({ type: 'viewer:find', open: false });
      });
      expect(screen.getByTestId('bus-open')).toHaveTextContent('closed');
    });
  });
});
