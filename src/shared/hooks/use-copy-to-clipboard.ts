'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { copyToClipboard } from '@/shared/lib/clipboard';

export type CopyState = 'idle' | 'copied' | 'error';

/**
 * Copy text to clipboard with reactive status feedback.
 * Backed by resilient `clipboardClient` (modern API + legacy DOM fallback).
 *
 * @example
 * const { copy, isCopied } = useCopyToClipboard();
 * <button onClick={() => copy(url)}>{isCopied ? 'Copied!' : 'Copy'}</button>
 */
export function useCopyToClipboard(resetMs = 2000) {
  const [state, setState] = useState<CopyState>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up pending timeout on component unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const success = await copyToClipboard(text);
      setState(success ? 'copied' : 'error');

      timeoutRef.current = setTimeout(() => {
        setState('idle');
      }, resetMs);

      return success;
    },
    [resetMs],
  );

  return {
    copy,
    isCopied: state === 'copied',
    isError: state === 'error',
    state,
  };
}

export { copyToClipboard };

