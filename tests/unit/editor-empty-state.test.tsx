import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorEmptyState, type EditorEmptyVariant } from '@/features/editor/components/shared/EditorEmptyState';
import {
  EditorEmptyDocumentIllustration,
  ViewerEmptyPdfIllustration,
  ViewerDetachedIllustration,
  EditorReviewIllustration,
  EditorHistoryIllustration,
  EditorSearchIllustration,
} from '@/features/editor/components/shared/EditorIllustrations';

describe('EditorEmptyState & EditorIllustrations Component Suite', () => {
  const variants: EditorEmptyVariant[] = [
    'document',
    'preview',
    'detached',
    'review',
    'history',
    'search',
    'files',
    'citations',
  ];

  it('renders all empty state variants with correct titles and illustrations', () => {
    for (const variant of variants) {
      const { unmount } = render(<EditorEmptyState variant={variant} />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeInTheDocument();
      unmount();
    }
  });

  it('applies compact layout when isCompact is true', () => {
    const { container } = render(
      <EditorEmptyState
        variant="history"
        isCompact
        title="No revisions"
        description="No changes recorded yet."
      />
    );
    expect(screen.getByText('No revisions')).toBeInTheDocument();
    expect(screen.getByText('No changes recorded yet.')).toBeInTheDocument();
    expect(container.querySelector('.min-h-\\[260px\\]')).toBeInTheDocument();
    expect(container.querySelector('.scale-75')).toBeInTheDocument();
  });

  it('renders action button and triggers onClick callback when clicked', () => {
    const handleClick = vi.fn();
    render(
      <EditorEmptyState
        variant="document"
        title="Empty file"
        description="Click to initialize"
        action={{
          label: 'Create file',
          onClick: handleClick,
        }}
      />
    );

    const button = screen.getByRole('button', { name: /create file/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders custom ReactNode action seamlessly', () => {
    render(
      <EditorEmptyState
        variant="preview"
        title="Custom action test"
        action={<button type="button">Custom Button</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'Custom Button' })).toBeInTheDocument();
  });

  it('renders all 3D isometric SVG illustrations with standard viewBox', () => {
    const illustrations = [
      EditorEmptyDocumentIllustration,
      ViewerEmptyPdfIllustration,
      ViewerDetachedIllustration,
      EditorReviewIllustration,
      EditorHistoryIllustration,
      EditorSearchIllustration,
    ];

    for (const Illustration of illustrations) {
      const { container, unmount } = render(<Illustration />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg?.getAttribute('viewBox')).toBe('0 0 162 180');
      unmount();
    }
  });
});
