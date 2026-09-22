'use client';

/**
 * viewer-instance.context.tsx
 *
 * React lifecycle provider for the active IPdfViewer.
 * Wires IPdfViewer to the EditorCommandBus, eliminating imperative viewer refs in Zustand.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { IPdfViewer } from '../../ports/pdf-viewer.port';
import { editorCommandBus } from '../command-bus/editor-command-bus';

interface ViewerInstanceContextValue {
  viewer: IPdfViewer | null;
  setViewer: (viewer: IPdfViewer | null) => void;
}

const ViewerInstanceContext = createContext<ViewerInstanceContextValue | null>(null);

export function ViewerInstanceProvider({ children }: { children: React.ReactNode }) {
  const [viewer, setViewerState] = useState<IPdfViewer | null>(null);

  const setViewer = useCallback((newViewer: IPdfViewer | null) => {
    setViewerState(newViewer);
  }, []);

  // Wire incoming CommandBus commands to the active viewer
  useEffect(() => {
    if (!viewer) return;

    const unsubs = [
      editorCommandBus.subscribe('viewer:goto-page', (cmd) => {
        viewer.gotoPage(cmd.page);
      }),
      editorCommandBus.subscribe('viewer:scroll-to-coords', (cmd) => {
        viewer.scrollToCoordinates(cmd.page, cmd.x, cmd.y);
      }),
      editorCommandBus.subscribe('viewer:zoom-in', () => {
        viewer.zoomIn();
      }),
      editorCommandBus.subscribe('viewer:zoom-out', () => {
        viewer.zoomOut();
      }),
      editorCommandBus.subscribe('viewer:fit-width', () => {
        viewer.fitWidth();
      }),
      editorCommandBus.subscribe('viewer:fit-height', () => {
        viewer.fitHeight();
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [viewer]);

  const value = useMemo(
    () => ({
      viewer,
      setViewer,
    }),
    [viewer, setViewer],
  );

  return (
    <ViewerInstanceContext.Provider value={value}>
      {children}
    </ViewerInstanceContext.Provider>
  );
}

export function useViewerInstance(): ViewerInstanceContextValue {
  const ctx = useContext(ViewerInstanceContext);
  if (!ctx) {
    throw new Error('useViewerInstance must be used within a ViewerInstanceProvider');
  }
  return ctx;
}
