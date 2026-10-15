'use client';

import React, { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LibraryInspector,
  type LibraryInspectorProps,
  INSPECTOR_LEVELS_FROM_BOTTOM,
  INSPECTOR_LEVELS,
} from './LibraryInspector';
import { useLibraryUIStore } from '@/features/library/store/library-ui.store';
import type { Item } from '@/features/library/types/library.types';
import type { ReaderDocument } from '@/features/library/types/reader.types';

export { INSPECTOR_LEVELS_FROM_BOTTOM, INSPECTOR_LEVELS };

export interface ReaderInspectorProps extends Omit<LibraryInspectorProps, 'showAiCopilot' | 'item' | 'paper'> {
  item?: Item | ReaderDocument | null;
  paper?: Item | ReaderDocument | null;
}

/**
 * Autonomous Zone 4: ReaderInspector
 * Thin wrapper around the shared LibraryInspector with Paper AI Copilot enabled
 * and reader-specific navigation fallbacks.
 */
export function ReaderInspector({
  item,
  paper,
  onSelectItem,
  onSelectPaper,
  ...rest
}: ReaderInspectorProps) {
  const router = useRouter();

  // Ensure the shared inspector is open by default when entering the Reader
  useEffect(() => {
    useLibraryUIStore.getState().setIsInspectorOpen(true);
  }, []);

  const defaultSelectPaper = useCallback(
    (paperId: string) => {
      router.push(`/library/papers/${paperId}`);
    },
    [router],
  );

  const effectiveItem = (item || paper || null) as Item | null;
  const effectiveOnSelect = onSelectItem || onSelectPaper || defaultSelectPaper;

  return (
    <LibraryInspector
      {...rest}
      item={effectiveItem}
      paper={effectiveItem}
      onSelectItem={effectiveOnSelect}
      onSelectPaper={effectiveOnSelect}
      showAiCopilot
    />
  );
}

export default ReaderInspector;
