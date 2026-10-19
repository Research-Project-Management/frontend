'use client';

/**
 * use-collaboration.ts
 *
 * Clean decoupled collaboration hooks for Editor UI.
 * Connects Yjs Awareness & Real-Time Presence to the Topbar Avatar Stack & Cursor overlays.
 * Guarantees zero unhandled network errors and zero polling spam when offline / disconnected.
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { useQuery } from '@tanstack/react-query';
import {
  editorCommandBus,
  useDocumentCollaborationStore,
  type CollaboratorPresenceInfo,
} from '@/features/editor/core';
import { ProjectService } from '@/features/projects/shell/services/project.service';
import { getCollaboratorColor } from '@/features/editor/ui/editor/CollaboratorCursors';
import { getOrCreateYjsProvider, releaseYjsProvider, type YjsSocketIOProvider, type ConnectionStatus } from '@/features/editor/sdk/realtime/yjs-socket-provider';
import { getCachedUser } from '@/features/auth/services/auth.service';
import { useSafeQueryClient } from '@/features/editor/subsystems/review/ui/hooks/safeQueryClient';

export type { CollaboratorPresenceInfo };

interface MemberRecord {
  id?: string;
  userId?: string;
  name?: string;
  email?: string;
  avatar?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    avatar?: string;
  };
}

export function useCollaborationPresence(
  pageId?: string | null,
  projectId?: string | null
) {
  const storeCollaborators = useDocumentCollaborationStore((s) => s.collaborators);
  const setCollaborators = useDocumentCollaborationStore((s) => s.setCollaborators);
  const updateCollaborator = useDocumentCollaborationStore((s) => s.updateCollaborator);
  const removeCollaborator = useDocumentCollaborationStore((s) => s.removeCollaborator);

  // Subscribe to realtime presence events from command bus
  useEffect(() => {
    const unsubPresence = editorCommandBus.subscribe('collab:presence-update', (cmd) => {
      if (Array.isArray(cmd.collaborators)) {
        setCollaborators(cmd.collaborators);
      }
    });

    const unsubJoined = editorCommandBus.subscribe('collab:user-joined', (cmd) => {
      if (cmd.collaborator && cmd.collaborator.id) {
        updateCollaborator(cmd.collaborator);
      }
    });

    const unsubLeft = editorCommandBus.subscribe('collab:user-left', (cmd) => {
      if (cmd.userId) {
        removeCollaborator(cmd.userId);
      }
    });

    const unsubCursor = editorCommandBus.subscribe('collab:cursor', (cmd) => {
      if (cmd.userId) {
        updateCollaborator({
          id: cmd.userId,
          activeFileId: cmd.activeFileId,
          activeFile: cmd.activeFile,
          cursor: cmd.cursor,
          lastActiveAt: Date.now(),
        });
      }
    });

    return () => {
      unsubPresence();
      unsubJoined();
      unsubLeft();
      unsubCursor();
    };
  }, [setCollaborators, updateCollaborator, removeCollaborator]);

  // Safely resolve query client (context client or fallback if rendered outside provider)
  const effectiveQueryClient = useSafeQueryClient();

  // Optionally augment with project members query for metadata (names, avatars, emails)
  const { data: projectMembers, isLoading } = useQuery(
    {
      queryKey: ['project-members', projectId],
      queryFn: async () => {
        if (!projectId) return [];
        try {
          const res = (await ProjectService.getMembers(projectId)) as {
            members?: MemberRecord[];
            data?: { members?: MemberRecord[] };
          } | null;
          return res?.members || res?.data?.members || [];
        } catch {
          return [];
        }
      },
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      enabled: Boolean(projectId),
    },
    effectiveQueryClient
  );

  // Merged collaborator list with fallback metadata
  const collaborators = useMemo<CollaboratorPresenceInfo[]>(() => {
    if (!projectMembers || !Array.isArray(projectMembers) || projectMembers.length === 0) {
      return storeCollaborators;
    }

    const memberMap = new Map<string, MemberRecord>();
    for (const m of (projectMembers as MemberRecord[])) {
      const id = m.userId || m.id || m.user?.id;
      if (id) {
        memberMap.set(id, m);
      }
    }

    return storeCollaborators.map((c) => {
      const member = memberMap.get(c.id);
      if (!member) return c;
      const userObj = member.user || {};
      return {
        ...c,
        name: c.name || userObj.name || member.name || 'Collaborator',
        email: c.email || userObj.email || member.email,
        avatar: c.avatar || userObj.avatar || member.avatar,
        color: c.color || getCollaboratorColor(c.id),
      };
    });
  }, [storeCollaborators, projectMembers]);

  return {
    data: collaborators,
    isLoading,
    error: null,
  };
}

export interface UseEditorCollaborationProps {
  projectId?: string | null;
  fileId?: string | null;
  initialValue?: string;
  enabled?: boolean;
}

export interface UseEditorCollaborationReturn {
  yText: Y.Text | null;
  awareness: Awareness | null;
  provider: YjsSocketIOProvider | null;
  isSynced: boolean;
  status: ConnectionStatus;
}

/**
 * useEditorCollaboration
 *
 * Coordinates Yjs CRDT session and Socket.IO real-time channel per document tab.
 * Leverages provider pooling so switching tabs reuses warm awareness and avoids socket churn.
 */
export function useEditorCollaboration({
  projectId,
  fileId,
  initialValue,
  enabled = true,
}: UseEditorCollaborationProps): UseEditorCollaborationReturn {
  const [providerState, setProviderState] = useState<{
    fileId: string;
    provider: YjsSocketIOProvider;
  } | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [, setDocGeneration] = useState(0);
  const prevFileIdRef = useRef(fileId);
  const initialValueRef = useRef(initialValue);
  if (prevFileIdRef.current !== fileId) {
    prevFileIdRef.current = fileId;
    initialValueRef.current = initialValue;
  } else if (!initialValueRef.current && initialValue) {
    initialValueRef.current = initialValue;
  }

  useEffect(() => {
    if (!enabled || !projectId || !fileId) {
      setProviderState(null);
      setIsSynced(false);
      setStatus('disconnected');
      return;
    }

    const cachedUser = getCachedUser();
    const user = cachedUser
      ? {
          id: cachedUser.id,
          name: cachedUser.name || 'Collaborator',
          avatar: cachedUser.avatar,
          color: getCollaboratorColor(cachedUser.id),
        }
      : undefined;

    const instance = getOrCreateYjsProvider(projectId, fileId, {
      user,
      initialContent: initialValueRef.current,
      commandBus: editorCommandBus,
      onStatusChange: (s) => setStatus(s),
      onSynced: () => setIsSynced(true),
    });

    setProviderState({ fileId, provider: instance });
    setIsSynced(instance.isSynced);
    setStatus(instance.status);
    // Pooled providers keep the first caller's onStatusChange; subscribe explicitly so this
    // hook instance always reflects the real socket status.
    const unsubscribeStatus = instance.subscribeStatus((s) => setStatus(s));
    // After a rebuild-from-server the provider swaps doc/yText/awareness; re-render so the
    // editor binding reconfigures onto the new instances.
    const unsubscribeReplaced = instance.onDocReplaced(() => setDocGeneration((g) => g + 1));

    return () => {
      unsubscribeStatus();
      unsubscribeReplaced();
      releaseYjsProvider(projectId, fileId);
    };
  }, [enabled, projectId, fileId]);

  const activeProvider =
    fileId && providerState?.fileId === fileId ? providerState.provider : null;

  return {
    yText: activeProvider ? activeProvider.yText : null,
    awareness: activeProvider ? activeProvider.awareness : null,
    provider: activeProvider,
    isSynced: activeProvider ? isSynced : false,
    status: activeProvider ? status : 'connecting',
  };
}

