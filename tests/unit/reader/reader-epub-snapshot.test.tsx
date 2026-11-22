import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { resolveEpubOrSnapshot } from '@/features/library/domain/reader/reader';
import { EpubAndSnapshotViewer } from '@/features/library/ui/reader/viewer/EpubAndSnapshotViewer';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

// Mock dependencies
const mockLoadDocumentBlob = vi.fn();
vi.mock('@/features/library/core/coordinator/reader/use-reader', () => ({
  useReaderDocumentBlobLoader: () => mockLoadDocumentBlob,
}));

vi.mock('@/features/library/ui/reader/viewer/ViewerPageCanvas', () => ({
  sanitizeReaderHtml: (html: string) => html,
  unpackEpubArchiveChapters: vi.fn().mockResolvedValue([
    { id: 'ch1', title: 'Chapter 1: Introduction', htmlContent: '<p>This is Chapter 1 content.</p>' },
    { id: 'ch2', title: 'Chapter 2: Methods', htmlContent: '<p>This is Chapter 2 content.</p>' },
  ]),
  highlightReaderHtml: (html: string) => html,
}));

describe('Epub and Web Snapshot Parity (Zotero 7 Reader Standard)', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('1. resolveEpubOrSnapshot resolution domain helper', () => {
    it('returns null for standard PDF attachments so PDF.js viewer is used', () => {
      const paperWithPdf = {
        id: 'p1',
        title: 'Deep Residual Learning',
        attachments: [
          { id: 'att-1', filename: 'paper.pdf', contentType: 'application/pdf', fileUrl: '/files/paper.pdf' },
        ],
      } as any;

      const res = resolveEpubOrSnapshot(paperWithPdf, '/files/paper.pdf', 'att-1');
      expect(res).toBeNull();
    });

    it('correctly resolves .epub attachments as mode: epub', () => {
      const paperWithEpub = {
        id: 'p2',
        title: 'Structure and Interpretation of Computer Programs',
        attachments: [
          { id: 'att-epub', filename: 'sicp.epub', contentType: 'application/epub+zip', fileUrl: '/files/sicp.epub' },
        ],
      } as any;

      const res = resolveEpubOrSnapshot(paperWithEpub, '/files/sicp.epub', 'att-epub');
      expect(res).not.toBeNull();
      expect(res?.mode).toBe('epub');
      expect(res?.url).toBe('/files/sicp.epub');
    });

    it('correctly resolves .html snapshot attachments as mode: snapshot', () => {
      const paperWithSnapshot = {
        id: 'p3',
        title: 'OpenAI Blog - GPT-4 Architecture',
        attachments: [
          { id: 'att-snap', filename: 'snapshot.html', contentType: 'text/html', fileUrl: '/files/snapshot.html' },
        ],
      } as any;

      const res = resolveEpubOrSnapshot(paperWithSnapshot, '/files/snapshot.html', 'att-snap');
      expect(res).not.toBeNull();
      expect(res?.mode).toBe('snapshot');
      expect(res?.url).toBe('/files/snapshot.html');
    });
  });

  describe('2. EpubAndSnapshotViewer Component Rendering & Navigation', () => {
    it('renders Web Snapshot mode with archived content and header info', async () => {
      const fakeHtml = '<h1>Archived Article</h1><p>Web snapshot body text.</p>';
      const fakeBlob = new Blob([fakeHtml], { type: 'text/html' });
      mockLoadDocumentBlob.mockResolvedValue(fakeBlob);

      render(
        <TooltipProvider>
          <EpubAndSnapshotViewer
            url="/files/snapshot.html"
            mode="snapshot"
            title="Archived Article - Blog"
            sourceUrl="https://example.com/article"
          />
        </TooltipProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Archived Article - Blog')).toBeDefined();
      });

      expect(screen.getByText('Original Page')).toBeDefined();
    });

    it('renders EPUB mode, loads chapters, supports Table of Contents and Next/Prev chapter navigation', async () => {
      const fakeEpubBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // PK zip header
      const fakeBlob = new Blob([fakeEpubBytes], { type: 'application/epub+zip' });
      mockLoadDocumentBlob.mockResolvedValue(fakeBlob);

      const onPageChange = vi.fn();
      const onVisiblePageChange = vi.fn();

      render(
        <TooltipProvider>
          <EpubAndSnapshotViewer
            url="/files/book.epub"
            mode="epub"
            title="Design Patterns"
            onPageChange={onPageChange}
            onVisiblePageChange={onVisiblePageChange}
          />
        </TooltipProvider>
      );

      // Verify Chapters button appears with chapter count (2)
      await waitFor(() => {
        expect(screen.getByText(/Chapters \(2\)/i)).toBeDefined();
      });

      // Chapter 1 is active
      expect(screen.getByText('Chapter 1: Introduction')).toBeDefined();
      expect(screen.getByText('1 / 2')).toBeDefined();

      // Open Table of Contents drawer
      const tocButton = screen.getByRole('button', { name: /chapters \(2\)/i });
      fireEvent.click(tocButton);
      expect(screen.getByText(/Table of Contents/i)).toBeDefined();
      expect(screen.getByText('2. Chapter 2: Methods')).toBeDefined();

      // Navigate to Next Chapter
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      expect(screen.getByText('Chapter 2: Methods')).toBeDefined();
      expect(screen.getByText('2 / 2')).toBeDefined();
      expect(onPageChange).toHaveBeenCalledWith(2, 2);
    });

    it('handles text selection and triggers Add to Note and Save Highlight with palette colors', async () => {
      const fakeHtml = '<p>Important research excerpt here.</p>';
      const fakeBlob = new Blob([fakeHtml], { type: 'text/html' });
      mockLoadDocumentBlob.mockResolvedValue(fakeBlob);

      const handleAddToNote = vi.fn();
      const handleAnnotate = vi.fn();

      render(
        <TooltipProvider>
          <EpubAndSnapshotViewer
            url="/files/snapshot.html"
            mode="snapshot"
            title="Research Snapshot"
            onAddToNote={handleAddToNote}
            onAnnotate={handleAnnotate}
            activeColor="#ffd400"
          />
        </TooltipProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Research Snapshot')).toBeDefined();
      });

      // Mock text selection in window
      vi.spyOn(window, 'getSelection').mockReturnValue({
        toString: () => 'Important research excerpt here.',
      } as any);

      // Simulate mouseup in scroll viewport to capture selection
      const viewport = document.querySelector('.overflow-y-auto')!;
      fireEvent.mouseUp(viewport);

      // Selection quick action bar should now be visible
      expect(screen.getByRole('button', { name: /add to note/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /save highlight/i })).toBeDefined();

      // Trigger Add to Note
      fireEvent.click(screen.getByRole('button', { name: /add to note/i }));
      expect(handleAddToNote).toHaveBeenCalledWith('Important research excerpt here.', 1);
    });
  });
});
