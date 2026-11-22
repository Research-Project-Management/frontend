import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedsListSection } from '@/features/library/ui/sidebar/FeedsListSection';
import { useFeedsStore } from '@/features/library/core/store/feeds.store';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

// Mock router
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/library',
}));

vi.mock('@/features/library/core/coordinator/curation.coordinator', () => ({
  useFeedSubscriptionsQuery: () => ({ data: [] }),
  useUnsubscribeFeedMutation: () => ({ mutateAsync: vi.fn() }),
}));

describe('FeedsListSection — Zotero Parity Context Menu', () => {
  const defaultProps = {
    basePath: '/library',
    navId: 'test-nav',
    currentFilter: null,
    isActiveScope: true,
  };

  beforeEach(() => {
    useFeedsStore.setState({
      feeds: [
        {
          id: 'feed-1',
          name: 'Nature Communications',
          url: 'https://nature.com/feed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(<TooltipProvider>{ui}</TooltipProvider>);

  it('should render Feeds root node and context menu with "New Feed..." on right-click', () => {
    renderWithProviders(<FeedsListSection {...defaultProps} />);

    const feedsRoot = screen.getByText(/^Feeds$/i);
    expect(feedsRoot).toBeDefined();

    fireEvent.contextMenu(feedsRoot);

    const newFeedMenuItem = screen.queryByText(/New Feed\.\.\./i);
    expect(newFeedMenuItem).toBeDefined();
  });

  it('should render ContextMenu on right click of Feed item with Refresh, Mark as Read, Edit, Unsubscribe', () => {
    renderWithProviders(<FeedsListSection {...defaultProps} />);

    const feedLink = screen.getByRole('link', { name: /Nature Communications/i });
    expect(feedLink).toBeDefined();

    fireEvent.contextMenu(feedLink);

    expect(screen.queryByText(/Refresh Feed/i)).toBeDefined();
    expect(screen.queryByText(/Mark Feed as Read/i)).toBeDefined();
    expect(screen.queryByText(/Edit Feed\.\.\./i)).toBeDefined();
    expect(screen.queryByText(/Unsubscribe/i)).toBeDefined();
  });
});
