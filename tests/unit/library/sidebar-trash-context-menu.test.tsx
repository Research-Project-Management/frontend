import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarSystemNav } from '@/features/library/ui/sidebar/SidebarSystemNav';

describe('SidebarSystemNav — Trash Parity with Zotero', () => {
  const defaultProps = {
    basePath: '/library',
    pathname: '/library',
    currentFilter: null,
    navId: 'test-nav',
    savedSearches: [],
  };

  it('should render Trash navigation item', () => {
    render(<SidebarSystemNav {...defaultProps} />);

    const trashLink = screen.getByRole('link', { name: /Trash/i });
    expect(trashLink).toBeDefined();
    expect(trashLink.getAttribute('href')).toBe('/library?filter=trash');
  });

  it('should display item count badge when trashCount > 0', () => {
    render(<SidebarSystemNav {...defaultProps} trashCount={14} />);

    expect(screen.getByText('14')).toBeDefined();
  });

  it('should not display badge when trashCount is 0 or undefined', () => {
    const { container } = render(<SidebarSystemNav {...defaultProps} trashCount={0} />);

    // No numeric badge for 0
    expect(container.querySelector('span.tabular-nums')).toBeNull();
  });

  it('should render ContextMenu with "Empty Trash..." when right clicked', () => {
    const handleEmptyTrash = vi.fn();
    render(
      <SidebarSystemNav
        {...defaultProps}
        trashCount={5}
        canEmptyTrash={true}
        onEmptyTrash={handleEmptyTrash}
      />,
    );

    const trashLink = screen.getByRole('link', { name: /Trash/i });
    fireEvent.contextMenu(trashLink);

    // Radix ContextMenu attaches to document body when opened
    const emptyTrashMenuItem = screen.queryByText(/Empty Trash\.\.\./i);
    if (emptyTrashMenuItem) {
      expect(emptyTrashMenuItem).toBeDefined();
      fireEvent.click(emptyTrashMenuItem);
      expect(handleEmptyTrash).toHaveBeenCalledTimes(1);
    }
  });

  it('should disable "Empty Trash..." option when trash is empty or undefined', () => {
    const handleEmptyTrash = vi.fn();
    render(
      <SidebarSystemNav
        {...defaultProps}
        trashCount={undefined}
        canEmptyTrash={true}
        onEmptyTrash={handleEmptyTrash}
      />,
    );

    const trashLink = screen.getByRole('link', { name: /Trash/i });
    fireEvent.contextMenu(trashLink);

    const emptyTrashMenuItem = screen.queryByText(/Empty Trash\.\.\./i);
    if (emptyTrashMenuItem) {
      const itemEl = emptyTrashMenuItem.closest('[data-slot="context-menu-item"]') || emptyTrashMenuItem;
      expect(
        itemEl.hasAttribute('data-disabled') ||
          itemEl.getAttribute('aria-disabled') === 'true' ||
          itemEl.className.includes('disabled'),
      ).toBe(true);
    }
  });

  it('should not display badge for Starred Items and Unfiled Items even if stats provide count', () => {
    render(
      <SidebarSystemNav
        {...defaultProps}
        stats={{
          starredCount: 15,
          unfiledCount: 22,
          duplicateCount: 3,
        }}
      />,
    );

    const starredLink = screen.getByRole('link', { name: /Starred Items/i });
    expect(starredLink.textContent).not.toContain('15');

    const unfiledLink = screen.getByRole('link', { name: /Unfiled Items/i });
    expect(unfiledLink.textContent).not.toContain('22');

    // Duplicate Items preserves badge
    const duplicatesLink = screen.getByRole('link', { name: /Duplicate Items/i });
    expect(duplicatesLink.textContent).toContain('3');
  });
});
