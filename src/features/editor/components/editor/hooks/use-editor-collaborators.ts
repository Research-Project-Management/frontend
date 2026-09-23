'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  collaborationService,
  type CollaborationPresence,
  type CollaborationEvent,
} from '@/features/editor/services/collaboration.service';
import { pageKeys } from '@/features/editor/hooks/use-core';
import { commentKeys } from '@/features/editor/hooks/use-comment';
import { suggestionKeys } from '@/features/editor/hooks/use-suggestion';
import * as Y from 'yjs';
import {
  YjsSocketIOProvider,
  type ConnectionStatus,
} from '@/features/editor/collaboration/yjs-socket-provider';

export interface UseEditorCollaboratorsOptions {
  projectId: string;
  pageId: string;
  editorRef?: React.MutableRefObject<any>;
  monacoRef?: React.MutableRefObject<any>;
  currentUserId?: string;
}

export function useEditorCollaborators({
  projectId,
  pageId,
  editorRef,
  monacoRef,
  currentUserId,
}: UseEditorCollaboratorsOptions) {
  const queryClient = useQueryClient();
  const [collaborators, setCollaborators] = useState<Map<string, CollaborationPresence>>(
    new Map(),
  );
  const [isDocumentLocked, setIsDocumentLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pageIdRef = useRef(pageId);
  pageIdRef.current = pageId;

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isSynced, setIsSynced] = useState(false);
  const [yText, setYText] = useState<Y.Text | null>(null);
  const [awareness, setAwareness] = useState<any | null>(null);
  const providerRef = useRef<YjsSocketIOProvider | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);

  // Initialize Yjs CRDT & Provider for concurrent conflict-free collaboration
  useEffect(() => {
    if (!pageId) return;

    const doc = new Y.Doc();
    yDocRef.current = doc;
    const text = doc.getText('monaco');
    setYText(text);

    const provider = new YjsSocketIOProvider(pageId, doc, {
      user: currentUserId
        ? { id: currentUserId, name: 'Researcher' }
        : undefined,
      onStatusChange: (status) => {
        setConnectionStatus(status);
      },
      onSynced: () => {
        setIsSynced(true);
      },
    });
    providerRef.current = provider;
    setAwareness(provider.awareness);

    const handleAwarenessChange = () => {
      const states = provider.awareness.getStates();
      const nextMap = new Map<string, CollaborationPresence>();
      states.forEach((state: any) => {
        const u = state.user;
        if (u && u.id && u.id !== currentUserId) {
          nextMap.set(u.id, {
            id: u.id,
            name: u.name,
            color: u.color,
            avatar: u.avatar,
            role: u.role,
            cursor: state.cursor,
            lastHeartbeat: Date.now(),
          });
        }
      });
      if (nextMap.size > 0) {
        setCollaborators((prev) => {
          const merged = new Map(prev);
          nextMap.forEach((v, k) => merged.set(k, v));
          return merged;
        });
      }
    };

    provider.awareness.on('change', handleAwarenessChange);

    return () => {
      provider.awareness.off('change', handleAwarenessChange);
      provider.destroy();
      providerRef.current = null;
      doc.destroy();
      yDocRef.current = null;
      setYText(null);
      setAwareness(null);
    };
  }, [pageId, currentUserId]);

  // Initial presence fetch
  useEffect(() => {
    if (!pageId) return;

    let isMounted = true;
    collaborationService.getPresence(pageId).then((users) => {
      if (!isMounted) return;
      const map = new Map<string, CollaborationPresence>();
      users.forEach((u) => {
        const uid = u.id || u.userId;
        if (uid && uid !== currentUserId) {
          map.set(uid, u);
        }
      });
      setCollaborators(map);
    });

    return () => {
      isMounted = false;
    };
  }, [pageId, currentUserId]);

  // Real-time SSE collaboration stream
  useEffect(() => {
    if (!projectId || !pageId) return;

    const cleanup = collaborationService.createCollaborationStream(
      projectId,
      pageId,
      (event: CollaborationEvent) => {
        const type = event.type;

        if (type === 'user-joined' && event.user) {
          const u = event.user;
          const uid = u.id || u.userId;
          if (uid && uid !== currentUserId) {
            setCollaborators((prev) => {
              const next = new Map(prev);
              next.set(uid, u);
              return next;
            });
          }
        } else if (type === 'cursor-updated' && event.user) {
          const u = event.user;
          const uid = u.id || u.userId;
          if (uid && uid !== currentUserId) {
            setCollaborators((prev) => {
              const next = new Map(prev);
              const existing = next.get(uid);
              next.set(uid, {
                ...existing,
                ...u,
                lastHeartbeat: Date.now(),
              });
              return next;
            });
          }
        } else if (type === 'user-left') {
          const uid = event.userId;
          if (uid) {
            setCollaborators((prev) => {
              const next = new Map(prev);
              next.delete(uid);
              return next;
            });
          }
        } else if (type.startsWith('suggestion')) {
          queryClient.invalidateQueries({ queryKey: suggestionKeys.byPage(pageId) });
          if (type === 'suggestion-accepted' || type === 'suggestions-accepted-all') {
            queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
          }
        } else if (type.startsWith('comment')) {
          queryClient.invalidateQueries({ queryKey: commentKeys.byPage(pageId) });
        } else if (type === 'page-updated') {
          queryClient.invalidateQueries({ queryKey: pageKeys.detail(pageId) });
        } else if (
          type === 'lock_updated' ||
          type === 'lock-updated' ||
          type === 'page-locked' ||
          type === 'page-unlocked'
        ) {
          const locked =
            type === 'page-locked'
              ? true
              : type === 'page-unlocked'
                ? false
                : Boolean(event.isLocked);
          setIsDocumentLocked(locked);
          setLockedBy(event.lockedBy || null);
        }
      },
    );

    return () => {
      cleanup();
    };
  }, [projectId, pageId, currentUserId, queryClient]);

  // Periodic heartbeat every 10s to keep presence alive
  useEffect(() => {
    if (!pageId) return;

    const interval = setInterval(() => {
      const ed = editorRef?.current;
      const pos = ed?.getPosition();
      const sel = ed?.getSelection();

      if (pageIdRef.current) {
        collaborationService.sendHeartbeat(pageIdRef.current, pos ? {
          line: pos.lineNumber,
          column: pos.column,
          selection: sel && !sel.isEmpty() ? {
            startLineNumber: sel.startLineNumber,
            startColumn: sel.startColumn,
            endLineNumber: sel.endLineNumber,
            endColumn: sel.endColumn,
          } : undefined,
        } : undefined);
      }
    }, 10_000);

    return () => {
      clearInterval(interval);
    };
  }, [pageId, editorRef]);

  // Cleanup on unmount or page change
  useEffect(() => {
    return () => {
      if (pageId) {
        collaborationService.leaveRoom(pageId);
      }
    };
  }, [pageId]);

  const bindMonacoCursorListeners = useCallback(() => {
    return {
      dispose: () => {},
    };
  }, []);

  const activeCollaborators = Array.from(collaborators.values());
  const isRealtimeActive = connectionStatus === 'connected' && isSynced;

  return {
    activeCollaborators,
    isDocumentLocked,
    lockedBy,
    bindMonacoCursorListeners,
    connectionStatus,
    isSynced,
    isRealtimeActive,
    triggerCheckpoint: () => providerRef.current?.triggerCheckpoint(),
    yText,
    awareness,
  };
}
