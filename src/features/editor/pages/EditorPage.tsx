'use client';

/**
 * EditorPage.tsx
 *
 * Declarative root entry point for the Overleaf-grade Editor workspace.
 * Wraps the 3-pane cockpit layout with global tooltip lifecycle providers.
 */

import React from 'react';
import { TooltipProvider } from '@/shared/components/ui';
import { EditorWorkspaceLayout } from '../sub-features/workspace/layout/EditorWorkspaceLayout';
import { EditorInstanceProvider } from '../core/context/editor-instance.context';
import { ViewerInstanceProvider } from '../core/context/viewer-instance.context';

export function EditorPage() {
  return (
    <TooltipProvider delayDuration={200}>
      <EditorInstanceProvider>
        <ViewerInstanceProvider>
          <EditorWorkspaceLayout />
        </ViewerInstanceProvider>
      </EditorInstanceProvider>
    </TooltipProvider>
  );
}

export default EditorPage;
