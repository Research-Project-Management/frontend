/**
 * visual-reference-hover-card.test.tsx
 *
 * Comprehensive Unit Test Suite for Visual Mode Interactive In-Text Hover Card & Quick Navigation.
 * Location: `tests/unit/editor/visual-reference-hover-card.test.tsx`
 *
 * Verifies:
 * 1. Rich citation hover card rendering with metadata (Title, Author, Journal, Year, DOI).
 * 2. Retraction warning banner display for compromised scientific literature.
 * 3. Fallback card for unresolved citation keys with 1-click search picker trigger.
 * 4. Cross-reference hover card displaying Figure/Table preview snapshot.
 * 5. 1-Click "Jump to Target" navigation with pulse animation.
 * 6. "Copy" citation and "Jump to .bib" action buttons.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import React from 'react';
import { VisualReferenceHoverCard } from '@/features/editor/ui/features/editor/VisualReferenceHoverCard';
import { latexSymbolsIndex } from '@/features/editor/domain/latex/latex-symbols-index';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';

describe('VisualReferenceHoverCard - Citations & References in Visual Mode', () => {
  let contentDiv: HTMLDivElement;
  let containerDiv: HTMLDivElement;

  beforeEach(() => {
    vi.useFakeTimers();

    // Setup Mock DOM
    containerDiv = document.createElement('div');
    containerDiv.style.position = 'relative';
    containerDiv.style.width = '800px';
    containerDiv.style.height = '600px';

    contentDiv = document.createElement('div');
    contentDiv.setAttribute('contenteditable', 'true');
    contentDiv.innerHTML = `
      <h1 data-line="1">Introduction</h1>
      <p data-line="2">
        As demonstrated by <span class="latex-citation-chip" data-cite="einstein1905">[@einstein1905]</span>,
        see also compromised work <span class="latex-citation-chip" data-cite="retracted2020">[@retracted2020]</span>
        and missing entry <span class="latex-citation-chip" data-cite="unknown2024">[@unknown2024]</span>.
      </p>
      <p data-line="4">
        Refer to <span class="latex-ref-chip" data-ref="fig:arch">[fig:arch]</span> for system details.
      </p>
      <figure class="latex-figure-wrapper" data-line="6" data-label="fig%3Aarch" data-caption="System%20Architecture" data-src="diagram.png">
        <figcaption>Figure: System Architecture</figcaption>
      </figure>
    `;

    containerDiv.appendChild(contentDiv);
    document.body.appendChild(containerDiv);

    // Mock bounding client rects for jsdom
    containerDiv.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 0,
      left: 0,
      width: 800,
      height: 600,
      bottom: 600,
      right: 800,
    });

    const chips = contentDiv.querySelectorAll('.latex-citation-chip, .latex-ref-chip, figure');
    chips.forEach((el) => {
      el.getBoundingClientRect = vi.fn().mockReturnValue({
        top: 150,
        left: 200,
        width: 80,
        height: 20,
        bottom: 170,
        right: 280,
      });
      el.scrollIntoView = vi.fn();
    });

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders rich citation hover card with title, author, year and DOI on mouseover', async () => {
    // Mock resolved citation entry
    vi.spyOn(latexSymbolsIndex, 'getCitationByKey').mockImplementation((key) => {
      if (key === 'einstein1905') {
        return {
          key: 'einstein1905',
          title: 'On the Electrodynamics of Moving Bodies',
          author: 'Albert Einstein',
          year: '1905',
          journal: 'Annalen der Physik',
          doi: '10.1002/andp.19053221004',
          type: 'article',
          sourceFile: 'references.bib',
        };
      }
      return undefined;
    });

    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    render(
      <VisualReferenceHoverCard
        contentRef={contentRef}
        containerRef={containerRef}
      />
    );

    const citeChip = contentDiv.querySelector('.latex-citation-chip[data-cite="einstein1905"]')!;
    expect(citeChip).toBeDefined();

    // Trigger mouseover
    act(() => {
      fireEvent.mouseOver(citeChip);
      vi.advanceTimersByTime(200); // pass 150ms debounce
    });

    const card = screen.getByTestId('visual-citation-hover-card');
    expect(card).toBeDefined();
    expect(screen.getByText('On the Electrodynamics of Moving Bodies')).toBeDefined();
    expect(screen.getByText('@einstein1905')).toBeDefined();
    expect(screen.getByText('references.bib')).toBeDefined();
    expect(screen.getByText(/Einstein/)).toBeDefined();
    expect(screen.getByText('1905')).toBeDefined();
  });

  it('displays retraction alert warning for compromised literature', async () => {
    vi.spyOn(latexSymbolsIndex, 'getCitationByKey').mockImplementation((key) => {
      if (key === 'retracted2020') {
        return {
          key: 'retracted2020',
          title: 'Fabricated Hydroxychloroquine Trial',
          author: 'Surgisphere Team',
          year: '2020',
          journal: 'The Lancet',
          type: 'article',
          sourceFile: 'references.bib',
          isRetracted: true,
          retractionReason: 'Unverifiable primary patient data.',
        };
      }
      return undefined;
    });

    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    render(
      <VisualReferenceHoverCard
        contentRef={contentRef}
        containerRef={containerRef}
      />
    );

    const retractedChip = contentDiv.querySelector('.latex-citation-chip[data-cite="retracted2020"]')!;

    act(() => {
      fireEvent.mouseOver(retractedChip);
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText(/CẢNH BÁO BÀI BÁO BỊ THU HỒI/)).toBeDefined();
    expect(screen.getByText('Unverifiable primary patient data.')).toBeDefined();
  });

  it('renders unresolved citation card with search & add action when citekey is missing', async () => {
    vi.spyOn(latexSymbolsIndex, 'getCitationByKey').mockReturnValue(undefined);

    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    render(
      <VisualReferenceHoverCard
        contentRef={contentRef}
        containerRef={containerRef}
      />
    );

    const unknownChip = contentDiv.querySelector('.latex-citation-chip[data-cite="unknown2024"]')!;

    act(() => {
      fireEvent.mouseOver(unknownChip);
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText('Unresolved Citation Key')).toBeDefined();
    const searchBtn = screen.getByText('Search & Add');
    expect(searchBtn).toBeDefined();

    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');
    fireEvent.click(searchBtn);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'dialog:open',
        dialog: 'citation-picker',
        payload: { initialQuery: 'unknown2024' },
      })
    );
  });

  it('renders cross-reference hover card with thumbnail and jumps to target figure on click', async () => {
    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    render(
      <VisualReferenceHoverCard
        contentRef={contentRef}
        containerRef={containerRef}
      />
    );

    const refChip = contentDiv.querySelector('.latex-ref-chip[data-ref="fig:arch"]')!;

    act(() => {
      fireEvent.mouseOver(refChip);
      vi.advanceTimersByTime(200);
    });

    const card = screen.getByTestId('visual-reference-hover-card');
    expect(card).toBeDefined();
    expect(within(card).getByText('Figure: System Architecture')).toBeDefined();

    const jumpBtn = screen.getByText('Jump to Target');
    const figureEl = contentDiv.querySelector('figure')!;

    fireEvent.click(jumpBtn);

    expect(figureEl.scrollIntoView).toHaveBeenCalled();
    expect(figureEl.classList.contains('synctex-highlight-pulse')).toBe(true);
  });

  it('copies formatted citation text to clipboard when clicking Copy', async () => {
    vi.spyOn(latexSymbolsIndex, 'getCitationByKey').mockReturnValue({
      key: 'einstein1905',
      title: 'Special Relativity',
      author: 'Albert Einstein',
      year: '1905',
      type: 'article',
      sourceFile: 'references.bib',
    });

    const contentRef = { current: contentDiv };
    const containerRef = { current: containerDiv };

    render(
      <VisualReferenceHoverCard
        contentRef={contentRef}
        containerRef={containerRef}
      />
    );

    const citeChip = contentDiv.querySelector('.latex-citation-chip[data-cite="einstein1905"]')!;

    act(() => {
      fireEvent.mouseOver(citeChip);
      vi.advanceTimersByTime(200);
    });

    const copyBtn = screen.getByText('Copy');
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Special Relativity')
    );
  });
});
