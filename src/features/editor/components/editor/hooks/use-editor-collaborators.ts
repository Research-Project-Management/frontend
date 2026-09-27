'use client';

/**
 * use-editor-collaborators.ts
 *
 * Real-time presence & collaboration hook wired to:
 * - Socket.IO + Yjs Gateway (/manuscripts) with Redis room fan-out and cursor awareness
 * - Server-Sent Events stream for document locks and room events
 * - Initial REST presence hydration fallback
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  collaborationService,
  type CollaborationPresence,
  type CollaborationEvent,
} from '@/features/editor/services/collaboration.service';
import {
  YjsSocketIOProvider,
  type ConnectionStatus,
  type CollaboratorUser,
} from '@/features/editor/collaboration/yjs-socket-provider';
import * as Y from 'yjs';

export interface UseEditorCollaboratorsOptions {
  projectId: string;
  pageId: string;
  editorRef?: React.MutableRefObject<any>;
  monacoRef?: React.MutableRefObject<any>;
  currentUserId?: string;
  currentUser?: CollaboratorUser | null;
}

export function useEditorCollaborators({
  projectId,
  pageId,
  editorRef: _editorRef,
  monacoRef: _monacoRef,
  currentUserId,
  currentUser,
}: UseEditorCollaboratorsOptions) {
  const [provider, setProvider] = useState<YjsSocketIOProvider | null>(null);
  const [collaborators, setCollaborators] = useState<CollaborationPresence[]>([]);
  const [isDocumentLocked, setIsDocumentLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [isSynced, setIsSynced] = useState<boolean>(true);

  const providerRef = useRef<YjsSocketIOProvider | null>(null);
  providerRef.current = provider;

  useEffect(() => {
    if (!pageId || !projectId) {
      setProvider(null);
      setConnectionStatus('disconnected');
      return;
    }

    let isMounted = true;
    const yDoc = new Y.Doc();

    const localUser: CollaboratorUser | undefined = currentUser
      ? currentUser
      : currentUserId
        ? { id: currentUserId, name: 'You' }
        : undefined;

    const socketProvider = new YjsSocketIOProvider(projectId, pageId, yDoc, {
      user: localUser,
      onStatusChange: (status) => {
        if (isMounted) setConnectionStatus(status);
      },
      onSynced: () => {
        if (isMounted) setIsSynced(true);
      },
      onCollaboratorsChange: (remoteUsers) => {
        if (isMounted) {
          setCollaborators(remoteUsers);
        }
      },
    });

    setProvider(socketProvider);

    // Initial presence fetch fallback
    collaborationService
      .getPresence(pageId)
      .then((users) => {
        if (isMounted && users && users.length > 0) {
          setCollaborators((prev) => {
            const map = new Map<string, CollaborationPresence>();
            for (const u of prev) {
              const k = u.userId || u.id || u.name;
              map.set(k, u);
            }
            for (const u of users) {
              const k = u.userId || u.id || u.name;
              if (!map.has(k)) map.set(k, u);
            }
            return Array.from(map.values());
          });
        }
      })
      .catch(() => {});

    // Send periodic heartbeat every 20s
    const heartbeatTimer = setInterval(() => {
      collaborationService.sendHeartbeat(pageId).catch(() => {});
    }, 20000);

    // Subscribe to SSE collaboration stream for locks & auxiliary events
    const unsubscribeStream = collaborationService.createCollaborationStream(
      projectId,
      pageId,
      (event: CollaborationEvent) => {
        if (!isMounted) return;
        if (event.type === 'document-locked') {
          setIsDocumentLocked(true);
          setLockedBy(event.lockedBy || null);
        } else if (event.type === 'document-unlocked') {
          setIsDocumentLocked(false);
          setLockedBy(null);
        }
      },
      () => {},
    );

    return () => {
      isMounted = false;
      clearInterval(heartbeatTimer);
      unsubscribeStream();
      socketProvider.destroy();
      setProvider(null);
      collaborationService.leaveRoom(pageId).catch(() => {});
    };
  }, [projectId, pageId, currentUserId, currentUser?.id, currentUser?.name]);

  const bindMonacoCursorListeners = useCallback(() => {
    return {
      dispose: () => {},
    };
  }, []);

  const sendCursor = useCallback(
    (row: number, col: number, selection?: any) => {
      providerRef.current?.sendCursor(row, col, selection);
    },
    [],
  );

  return {
    activeCollaborators: collaborators,
    isDocumentLocked,
    lockedBy,
    bindMonacoCursorListeners,
    sendCursor,
    connectionStatus,
    isSynced,
    isRealtimeActive: true,
    triggerCheckpoint: () => providerRef.current?.triggerCheckpoint(),
    yText: provider ? provider.yText : null,
    awareness: provider ? provider.awareness : null,
    provider,
  };
}
