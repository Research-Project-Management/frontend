'use client';

import { useState, useCallback } from 'react';
import type { CollaborationPresence } from '@/features/editor/services/collaboration.service';
import type { ConnectionStatus } from '@/features/editor/collaboration/yjs-socket-provider';

export interface UseEditorCollaboratorsOptions {
  projectId: string;
  pageId: string;
  editorRef?: React.MutableRefObject<any>;
  monacoRef?: React.MutableRefObject<any>;
  currentUserId?: string;
}

export function useEditorCollaborators({
  projectId: _projectId,
  pageId: _pageId,
  editorRef: _editorRef,
  monacoRef: _monacoRef,
  currentUserId: _currentUserId,
}: UseEditorCollaboratorsOptions) {
  const [collaborators] = useState<CollaborationPresence[]>([]);
  const [isDocumentLocked] = useState(false);
  const [lockedBy] = useState<string | null>(null);
  const [connectionStatus] = useState<ConnectionStatus>('connected');
  const [isSynced] = useState(true);

  const bindMonacoCursorListeners = useCallback(() => {
    return {
      dispose: () => {},
    };
  }, []);

  return {
    activeCollaborators: collaborators,
    isDocumentLocked,
    lockedBy,
    bindMonacoCursorListeners,
    connectionStatus,
    isSynced,
    isRealtimeActive: false,
    triggerCheckpoint: () => {},
    yText: null,
    awareness: null,
  };
}
