'use client';

import { useEffect, useState } from 'react';
import type { KeybindingMode } from '@/features/editor/store/settings.store';

export interface UseEditorEmacsOptions {
  editor: any;
  keybinding: KeybindingMode;
  statusNodeRef?: React.RefObject<HTMLDivElement | null>;
  onSave?: () => void;
}

export function useEditorEmacs({
  editor,
  keybinding,
  statusNodeRef,
  onSave,
}: UseEditorEmacsOptions) {
  const [isEmacsActive, setIsEmacsActive] = useState(false);
  const [emacsStatus, setEmacsStatus] = useState<string>('');

  useEffect(() => {
    if (keybinding === 'emacs') {
      setIsEmacsActive(true);
      setEmacsStatus('Ready');
    } else {
      setIsEmacsActive(false);
      setEmacsStatus('');
    }
  }, [keybinding]);

  return { isEmacsActive, emacsStatus };
}
