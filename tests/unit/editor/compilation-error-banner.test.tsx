import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompilationErrorBanner } from '@/features/editor/ui/features/preview/CompilationErrorBanner';

describe('CompilationErrorBanner (Overleaf 1:1 Parity)', () => {
  it('renders nothing when errorCount is 0', () => {
    const { container } = render(
      <CompilationErrorBanner
        errorCount={0}
        onJumpToFirstError={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders error count and message when errorCount > 0', () => {
    render(
      <CompilationErrorBanner
        errorCount={91}
        onJumpToFirstError={vi.fn()}
      />
    );

    const banner = screen.getByTestId('compilation-error-banner');
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/91 compilation errors detected in this build/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jump to first error/i })).toBeInTheDocument();
  });

  it('handles singular form for 1 compilation error', () => {
    render(
      <CompilationErrorBanner
        errorCount={1}
        onJumpToFirstError={vi.fn()}
      />
    );

    expect(screen.getByText(/1 compilation error detected in this build/i)).toBeInTheDocument();
  });

  it('calls onJumpToFirstError when button is clicked', () => {
    const jumpSpy = vi.fn();
    render(
      <CompilationErrorBanner
        errorCount={3}
        onJumpToFirstError={jumpSpy}
      />
    );

    const button = screen.getByRole('button', { name: /jump to first error/i });
    fireEvent.click(button);
    expect(jumpSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenLogs when message is clicked', () => {
    const openLogsSpy = vi.fn();
    render(
      <CompilationErrorBanner
        errorCount={5}
        onJumpToFirstError={vi.fn()}
        onOpenLogs={openLogsSpy}
      />
    );

    const textEl = screen.getByText(/5 compilation errors detected in this build/i);
    fireEvent.click(textEl);
    expect(openLogsSpy).toHaveBeenCalledTimes(1);
  });
});
