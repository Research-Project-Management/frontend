/**
 * use-hotkeys.test.tsx
 *
 * Unit tests for `useHotkeys` hook.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useHotkeys } from '@/shared/hooks/use-hotkeys';

function TestHotkeysComponent({
  shortcut,
  onTrigger,
  enableOnFormTags = false,
}: {
  shortcut: string | string[];
  onTrigger: (e: KeyboardEvent) => void;
  enableOnFormTags?: boolean;
}) {
  useHotkeys(shortcut, onTrigger, { enableOnFormTags });

  return (
    <div>
      <input data-testid="test-input" placeholder="Type here..." />
      <div data-testid="outside">Outside Element</div>
    </div>
  );
}

describe('useHotkeys', () => {
  it('triggers handler when shortcut key is pressed', () => {
    const onTrigger = vi.fn();
    render(<TestHotkeysComponent shortcut="escape" onTrigger={onTrigger} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('triggers handler for modifier key combinations like ctrl+k / mod+k', () => {
    const onTrigger = vi.fn();
    render(<TestHotkeysComponent shortcut="ctrl+k" onTrigger={onTrigger} />);

    // Press just 'k' without ctrl -> should NOT trigger
    fireEvent.keyDown(window, { key: 'k', ctrlKey: false });
    expect(onTrigger).not.toHaveBeenCalled();

    // Press ctrl+k -> should trigger
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('ignores hotkey when typing inside an input element by default', () => {
    const onTrigger = vi.fn();
    const { getByTestId } = render(
      <TestHotkeysComponent shortcut="escape" onTrigger={onTrigger} enableOnFormTags={false} />,
    );

    fireEvent.keyDown(getByTestId('test-input'), { key: 'Escape' });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('triggers on input element when enableOnFormTags is true', () => {
    const onTrigger = vi.fn();
    const { getByTestId } = render(
      <TestHotkeysComponent shortcut="escape" onTrigger={onTrigger} enableOnFormTags={true} />,
    );

    fireEvent.keyDown(getByTestId('test-input'), { key: 'Escape' });
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
