/**
 * EditorPage.tsx
 *
 * Root Editor Page Component (Block 7: UI Shell Layer).
 * Location: `features/editor/ui/shell/EditorPage.tsx`
 *
 * Wraps ModernWorkbenchLayout with Editor & Viewer Instance Context Providers.
 */

'use client';

import React, { useEffect } from 'react';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { ModernWorkbenchLayout } from './ModernWorkbenchLayout';
import { keybindingCoordinator } from '@/features/editor/coordinators/keybinding.coordinator';
import { sessionCoordinator } from '@/features/editor/coordinators/session.coordinator';

export function EditorPage() {
  useEffect(() => {
    const unsubKeybindings = keybindingCoordinator.init();
    const unsubBeforeUnload = sessionCoordinator.initBeforeUnloadProtection();
    return () => {
      unsubKeybindings();
      unsubBeforeUnload();
    };
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <ModernWorkbenchLayout />
    </TooltipProvider>
  );
}

export default EditorPage;
