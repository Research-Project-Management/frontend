import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LazyThumbnailPage } from '@/features/library/ui/reader/ReaderThumbnailsPanel';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

describe('ReaderThumbnailsPanel Context Menu Parity (Zotero 7)', () => {
  it('renders Rotate Page Right and Rotate Page Left in thumbnail context menu', () => {
    const onJumpToPage = vi.fn();
    const onRotatePageRight = vi.fn();
    const onRotatePageLeft = vi.fn();

    render(
      <TooltipProvider>
        <LazyThumbnailPage
          pageNum={3}
          isCurrent={false}
          showPdfCanvas={false}
          onJumpToPage={onJumpToPage}
          onRotatePageRight={onRotatePageRight}
          onRotatePageLeft={onRotatePageLeft}
        />
      </TooltipProvider>
    );

    const pageCard = screen.getByText('Page 3');
    fireEvent.contextMenu(pageCard);

    const rotateRightItem = screen.getByText('Rotate Page Right');
    const rotateLeftItem = screen.getByText('Rotate Page Left');

    expect(rotateRightItem).toBeInTheDocument();
    expect(rotateLeftItem).toBeInTheDocument();

    fireEvent.click(rotateRightItem);
    expect(onRotatePageRight).toHaveBeenCalledWith(3);

    fireEvent.contextMenu(pageCard);
    fireEvent.click(screen.getByText('Rotate Page Left'));
    expect(onRotatePageLeft).toHaveBeenCalledWith(3);
  });
});
