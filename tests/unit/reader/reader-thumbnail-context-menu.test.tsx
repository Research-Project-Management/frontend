import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LazyThumbnailPage } from '@/features/library/ui/reader/ReaderThumbnailsPanel';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

describe('ReaderThumbnailsPanel Context Menu Parity (Zotero 7)', () => {
  it('renders Rotate Page Right, Rotate Page Left, and Bookmark Page in thumbnail context menu', () => {
    const onJumpToPage = vi.fn();
    const onToggleBookmarkPage = vi.fn();
    const onRotatePageRight = vi.fn();
    const onRotatePageLeft = vi.fn();

    render(
      <TooltipProvider>
        <LazyThumbnailPage
          pageNum={3}
          isCurrent={false}
          isBookmarked={false}
          showPdfCanvas={false}
          onJumpToPage={onJumpToPage}
          onToggleBookmarkPage={onToggleBookmarkPage}
          onRotatePageRight={onRotatePageRight}
          onRotatePageLeft={onRotatePageLeft}
        />
      </TooltipProvider>
    );

    const pageCard = screen.getByText('Page 3');
    fireEvent.contextMenu(pageCard);

    const rotateRightItem = screen.getByText('Rotate Page Right');
    const rotateLeftItem = screen.getByText('Rotate Page Left');
    const bookmarkItem = screen.getByText('Bookmark Page');

    expect(rotateRightItem).toBeInTheDocument();
    expect(rotateLeftItem).toBeInTheDocument();
    expect(bookmarkItem).toBeInTheDocument();

    fireEvent.click(rotateRightItem);
    expect(onRotatePageRight).toHaveBeenCalledWith(3);

    fireEvent.contextMenu(pageCard);
    fireEvent.click(screen.getByText('Rotate Page Left'));
    expect(onRotatePageLeft).toHaveBeenCalledWith(3);

    fireEvent.contextMenu(pageCard);
    fireEvent.click(screen.getByText('Bookmark Page'));
    expect(onToggleBookmarkPage).toHaveBeenCalledWith(3);
  });
});
