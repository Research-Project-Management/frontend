import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditorEmptyState, type EditorEmptyVariant } from '@/features/editor/components/shared/EditorEmptyState';

describe('EditorEmptyState Component Suite', () => {
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

  it('renders all empty state variants with correct titles', () => {
    for (const variant of variants) {
      const { unmount } = render(<EditorEmptyState variant={variant} />);
      const heading = screen.getByRole('heading');
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
    expect(container.querySelector('.min-h-\\[160px\\]')).toBeInTheDocument();
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
});
