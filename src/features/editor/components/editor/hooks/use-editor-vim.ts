'use client';

import { useEffect, useState } from 'react';
import type { KeybindingMode } from '@/features/editor/store/settings.store';

export interface UseEditorVimOptions {
  editor: any;
  keybinding: KeybindingMode;
  statusNodeRef: React.RefObject<HTMLDivElement | null>;
  onSave?: () => void;
}

export function useEditorVim({
  editor,
  keybinding,
  statusNodeRef,
  onSave,
}: UseEditorVimOptions) {
  const [isVimActive, setIsVimActive] = useState(false);

  useEffect(() => {
    if (keybinding === 'vim') {
      setIsVimActive(true);
    } else {
      setIsVimActive(false);
      if (statusNodeRef.current) {
        statusNodeRef.current.innerHTML = '';
      }
    }
  }, [keybinding, statusNodeRef]);

  return { isVimActive };
}
