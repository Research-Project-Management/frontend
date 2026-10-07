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
import { EditorInstanceProvider } from '../../core/context/editor-instance.context';
import { ViewerInstanceProvider } from '../../core/context/viewer-instance.context';
import { keybindingCoordinator } from '../../coordinators/keybinding.coordinator';
import { sessionCoordinator } from '../../coordinators/session.coordinator';

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
      <EditorInstanceProvider>
        <ViewerInstanceProvider>
          <ModernWorkbenchLayout />
        </ViewerInstanceProvider>
      </EditorInstanceProvider>
    </TooltipProvider>
  );
}

export default EditorPage;
