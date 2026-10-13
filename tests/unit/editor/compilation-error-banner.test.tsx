import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CompilationErrorBanner } from '@/features/editor/ui/preview/CompilationErrorBanner';

describe('CompilationErrorBanner (Overleaf 1:1 Parity)', () => {
  beforeEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

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
    const { getByTestId, getByText, getByRole } = render(
      <CompilationErrorBanner
        errorCount={91}
        onJumpToFirstError={vi.fn()}
      />
    );

    const banner = getByTestId('compilation-error-banner');
    expect(banner).toBeInTheDocument();
    expect(getByText(/91 compilation errors detected in this build/i)).toBeInTheDocument();
    expect(getByRole('button', { name: /jump to first error/i })).toBeInTheDocument();
  });

  it('handles singular form for 1 compilation error', () => {
    const { getByText } = render(
      <CompilationErrorBanner
        errorCount={1}
        onJumpToFirstError={vi.fn()}
      />
    );

    expect(getByText(/1 compilation error detected in this build/i)).toBeInTheDocument();
  });

  it('calls onJumpToFirstError when button is clicked', () => {
    const jumpSpy = vi.fn();
    const { getByRole } = render(
      <CompilationErrorBanner
        errorCount={3}
        onJumpToFirstError={jumpSpy}
      />
    );

    const button = getByRole('button', { name: /jump to first error/i });
    fireEvent.click(button);
    expect(jumpSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenLogs when message is clicked', () => {
    const openLogsSpy = vi.fn();
    const { getByText } = render(
      <CompilationErrorBanner
        errorCount={5}
        onJumpToFirstError={vi.fn()}
        onOpenLogs={openLogsSpy}
      />
    );

    const textEl = getByText(/5 compilation errors detected in this build/i);
    fireEvent.click(textEl);
    expect(openLogsSpy).toHaveBeenCalledTimes(1);
  });
});
