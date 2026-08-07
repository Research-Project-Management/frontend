'use client';

import { useState, useCallback } from 'react';

type CopyState = 'idle' | 'copied' | 'error';

/**
 * Copy text to clipboard with status feedback.
 *
 * @example
 * const { copy, isCopied } = useCopyToClipboard();
 * <button onClick={() => copy(url)}>{isCopied ? 'Copied!' : 'Copy'}</button>
 */
export function useCopyToClipboard(resetMs = 2000) {
  const [state, setState] = useState<CopyState>('idle');

  const copy = useCallback(
    async (text: string) => {
      if (!navigator?.clipboard) {
        setState('error');
        return false;
      }
      try {
        await navigator.clipboard.writeText(text);
        setState('copied');
        setTimeout(() => setState('idle'), resetMs);
        return true;
      } catch {
        setState('error');
        setTimeout(() => setState('idle'), resetMs);
        return false;
      }
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
