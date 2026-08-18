/**
 * use-click-outside.test.tsx
 *
 * Unit tests for `useClickOutside` hook.
 */

import React, { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useClickOutside } from '@/shared/hooks/use-click-outside';

function TestComponent({
  onOutsideClick,
  enabled = true,
}: {
  onOutsideClick: (e: Event) => void;
  enabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, onOutsideClick, { enabled });

  return (
    <div>
      <div ref={containerRef} data-testid="inside">
        Inside Box
      </div>
      <div data-testid="outside">Outside Box</div>
    </div>
  );
}

function MultiRefComponent({ onOutsideClick }: { onOutsideClick: (e: Event) => void }) {
  const ref1 = useRef<HTMLDivElement>(null);
  const ref2 = useRef<HTMLDivElement>(null);
  useClickOutside([ref1, ref2], onOutsideClick);

  return (
    <div>
      <div ref={ref1} data-testid="inside-1">
        Box 1
      </div>
      <div ref={ref2} data-testid="inside-2">
        Box 2
      </div>
      <div data-testid="outside">Outside Box</div>
    </div>
  );
}

describe('useClickOutside', () => {
  it('calls handler when clicking outside target element', () => {
    const onOutsideClick = vi.fn();
    const { getByTestId } = render(<TestComponent onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(getByTestId('outside'));
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it('does not call handler when clicking inside target element', () => {
    const onOutsideClick = vi.fn();
    const { getByTestId } = render(<TestComponent onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(getByTestId('inside'));
    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it('handles multi-ref targets correctly without triggering when clicking either target', () => {
    const onOutsideClick = vi.fn();
    const { getByTestId } = render(<MultiRefComponent onOutsideClick={onOutsideClick} />);

    fireEvent.mouseDown(getByTestId('inside-1'));
    expect(onOutsideClick).not.toHaveBeenCalled();

    fireEvent.mouseDown(getByTestId('inside-2'));
    expect(onOutsideClick).not.toHaveBeenCalled();

    fireEvent.mouseDown(getByTestId('outside'));
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire when enabled is false', () => {
    const onOutsideClick = vi.fn();
    const { getByTestId } = render(
      <TestComponent onOutsideClick={onOutsideClick} enabled={false} />,
    );

    fireEvent.mouseDown(getByTestId('outside'));
    expect(onOutsideClick).not.toHaveBeenCalled();
  });
});
