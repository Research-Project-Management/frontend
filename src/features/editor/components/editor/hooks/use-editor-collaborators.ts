'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { editor } from 'monaco-editor';
import {
  collaborationService,
  type CollaborationPresence,
  type CollaborationEvent,
} from '@/features/editor/services/collaboration.service';
import { pageKeys } from '@/features/editor/hooks/use-core';
import { commentKeys } from '@/features/editor/hooks/use-comment';
import { suggestionKeys } from '@/features/editor/hooks/use-suggestion';
import { RemoteCursorManager, type RemoteUserCursor } from '../monaco-remote-cursor';

export interface UseEditorCollaboratorsOptions {
  projectId: string;
  pageId: string;
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  monacoRef: React.MutableRefObject<any>;
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

  const cursorManagerRef = useRef<RemoteCursorManager>(new RemoteCursorManager());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pageIdRef = useRef(pageId);
  pageIdRef.current = pageId;

  // Initialize RemoteCursorManager with Monaco editor instance
  useEffect(() => {
    cursorManagerRef.current.setEditor(editorRef.current, monacoRef.current);
  }, [editorRef, monacoRef, editorRef.current, monacoRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

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
          if (u.cursor) {
            cursorManagerRef.current.updateUserCursor({
              id: uid,
              name: u.name,
              color: u.color || '#3b82f6',
              cursor: u.cursor,
            });
          }
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
            if (u.cursor) {
              cursorManagerRef.current.updateUserCursor({
                id: uid,
                name: u.name,
                color: u.color || '#3b82f6',
                cursor: u.cursor,
              });
            }
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

            if (u.cursor) {
              cursorManagerRef.current.updateUserCursor({
                id: uid,
                name: u.name,
                color: u.color || '#3b82f6',
                cursor: u.cursor,
              });
            }
          }
        } else if (type === 'user-left') {
          const uid = event.userId;
          if (uid) {
            setCollaborators((prev) => {
              const next = new Map(prev);
              next.delete(uid);
              return next;
            });
            cursorManagerRef.current.removeUserCursor(uid);
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
      const ed = editorRef.current;
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
      cursorManagerRef.current.clearAll();
      if (pageId) {
        collaborationService.leaveRoom(pageId);
      }
    };
  }, [pageId]);

  // Bind local cursor movement to broadcast
  const bindMonacoCursorListeners = useCallback(
    (ed: editor.IStandaloneCodeEditor) => {
      const posDisposable = ed.onDidChangeCursorPosition((e) => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          const sel = ed.getSelection();
          const targetPageId = pageIdRef.current;
          if (!targetPageId) return;

          collaborationService.sendHeartbeat(targetPageId, {
            line: e.position.lineNumber,
            column: e.position.column,
            selection: sel && !sel.isEmpty() ? {
              startLineNumber: sel.startLineNumber,
              startColumn: sel.startColumn,
              endLineNumber: sel.endLineNumber,
              endColumn: sel.endColumn,
            } : undefined,
          });
        }, 150);
      });

      return {
        dispose: () => {
          posDisposable.dispose();
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
        },
      };
    },
    [pageId],
  );

  const activeCollaborators = Array.from(collaborators.values());

  return {
    activeCollaborators,
    isDocumentLocked,
    lockedBy,
    bindMonacoCursorListeners,
  };
}
