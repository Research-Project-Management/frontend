import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LibraryEmptyState } from '@/features/library/components/content/LibraryEmptyState';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn().mockReturnValue('/library'),
}));

// Mock child illustration components to keep unit test light
vi.mock('@/features/library/components/content/RecentlyReadEmptyState', () => ({
  RecentlyReadEmptyState: () => <div data-testid="recently-read-empty">Recently Read Empty</div>,
}));

vi.mock('@/features/library/components/content/LibraryIllustrations', () => ({
  libraryIllustrationStyles: '',
  StarredStackIllustration: () => <div data-testid="starred-icon" />,
  TrashStackIllustration: () => <div data-testid="trash-icon" />,
  RetractedStackIllustration: () => <div data-testid="retracted-icon" />,
  UnfiledStackIllustration: () => <div data-testid="unfiled-icon" />,
  PublicationsStackIllustration: () => <div data-testid="publications-icon" />,
  CollectionStackIllustration: () => <div data-testid="collection-icon" />,
  AllReferencesStackIllustration: () => <div data-testid="all-icon" />,
  SearchStackIllustration: () => <div data-testid="search-icon" />,
}));

describe('LibraryEmptyState Rules of Hooks Invariants', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render default empty state', () => {
    render(<LibraryEmptyState activeFilter={null} search="" />);
    expect(screen.getByText('Start with your first reference')).toBeDefined();
  });

  it('should render RecentlyReadEmptyState when filter is recent', () => {
    render(<LibraryEmptyState activeFilter="recent" search="" />);
    expect(screen.getByTestId('recently-read-empty')).toBeDefined();
  });

  it('should safely transition between recently-read and regular filters without hook ordering violation', () => {
    const { rerender } = render(<LibraryEmptyState activeFilter="recent" search="" />);
    expect(screen.getByTestId('recently-read-empty')).toBeDefined();

    // Rerender with trash filter (different branch that calls callbacks and state)
    rerender(<LibraryEmptyState activeFilter="trash" search="" />);
    expect(screen.getByText('Trash is empty')).toBeDefined();

    // Rerender back to recent
    rerender(<LibraryEmptyState activeFilter="recent" search="" />);
    expect(screen.getByTestId('recently-read-empty')).toBeDefined();

    // Rerender with active search in recent
    rerender(<LibraryEmptyState activeFilter="recent" search="quantum" />);
    expect(screen.getByText('No matching references')).toBeDefined();
  });
});
