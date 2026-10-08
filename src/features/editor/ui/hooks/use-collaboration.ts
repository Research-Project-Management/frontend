'use client';

/**
 * use-collaboration.ts
 *
 * Clean decoupled collaboration hooks for Editor UI.
 * Connects Yjs Awareness & Real-Time Presence to the Topbar Avatar Stack & Cursor overlays.
 * Guarantees zero unhandled network errors and zero polling spam when offline / disconnected.
 */

import { useEffect, useMemo, useContext } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { editorCommandBus } from '../../coordinators/command-bus';
import {
  useDocumentCollaborationStore,
  type CollaboratorPresenceInfo,
} from '../../store/collaboration.store';
import { ProjectService } from '@/features/projects/shell/services/project.service';
import { getCollaboratorColor } from '../features/editor/CollaboratorCursors';

export type { CollaboratorPresenceInfo };

let _fallbackQueryClient: QueryClient | null = null;
function getFallbackQueryClient(): QueryClient {
  if (!_fallbackQueryClient) {
    _fallbackQueryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: 5 * 60_000 },
      },
    });
  }
  return _fallbackQueryClient;
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
  const contextClient = useContext(QueryClientContext);
  const effectiveQueryClient = contextClient || getFallbackQueryClient();

  // Optionally augment with project members query for metadata (names, avatars, emails)
  const { data: projectMembers, isLoading } = useQuery(
    {
      queryKey: ['project-members', projectId],
      queryFn: async () => {
        if (!projectId) return [];
        try {
          const res = await ProjectService.getMembers(projectId);
          return res?.members || (res as any)?.data?.members || [];
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

    const memberMap = new Map<string, any>();
    for (const m of projectMembers) {
      const id = m.userId || (m as any).id || m.user?.id;
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
        name: c.name || userObj.name || (member as any).name || 'Collaborator',
        email: c.email || userObj.email || (member as any).email,
        avatar: c.avatar || userObj.avatar || (member as any).avatar,
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

export function useCollaborationStream(_projectId?: string | null, _pageId?: string | null) {
  // Pure UI shell - no-op to eliminate legacy EventSource network errors
}
