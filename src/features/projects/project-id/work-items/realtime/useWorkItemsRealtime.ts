'use client';

import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { NAMESPACES } from '@/shared/realtime/config';
import { socketPool } from '@/shared/realtime/socket-pool';
import type { UseRealtimeItemsOptions } from '@/features/projects/project-id/work-items/types/work-item.types';

export type { UseRealtimeItemsOptions };

export const WORK_ITEMS_SOCKET_EVENTS = {
  JOIN: 'work-items:join',
  LEAVE: 'work-items:leave',
  CREATED: 'work-item:created',
  UPDATED: 'work-item:updated',
  DELETED: 'work-item:deleted',
  STATE_CHANGED: 'work-item:state_changed',
  STATE_UPDATED: 'state:updated',
  ACCESS_REVOKED: 'work-items:access_revoked',
} as const;

interface WorkItemSocketPayload {
  projectId?: string;
  workItemId?: string;
  entityId?: string;
  entityType?: string;
  verb?: string;
}

export function useRealtimeItems({
  projectId,
  enabled = true,
  onWorkItemCreated,
  onWorkItemUpdated,
  onWorkItemDeleted,
  onStateReordered,
}: UseRealtimeItemsOptions) {
  const queryClient = useQueryClient();
  const callbacksRef = useRef({
    onWorkItemCreated,
    onWorkItemUpdated,
    onWorkItemDeleted,
    onStateReordered,
  });

  useEffect(() => {
    callbacksRef.current = {
      onWorkItemCreated,
      onWorkItemUpdated,
      onWorkItemDeleted,
      onStateReordered,
    };
  }, [onWorkItemCreated, onWorkItemUpdated, onWorkItemDeleted, onStateReordered]);

  useEffect(() => {
    if (!enabled || !projectId || typeof window === 'undefined') return;

    const socket: Socket = socketPool.acquire(NAMESPACES.WORK_ITEMS);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingInvalidateStates = false;
    const pendingTargetIds = new Set<string>();

    const shouldInvalidateProjectStates = (
      payload: WorkItemSocketPayload | undefined,
      forceStateInvalidation: boolean,
    ): boolean => {
      if (forceStateInvalidation) return true;
      if (!payload?.verb) return true;
      if (payload.entityType === 'project') return true;
      const verb = payload.verb.toLowerCase();
      return (
        verb.includes('state') ||
        verb.includes('column') ||
        verb.includes('delete') ||
        verb.includes('create') ||
        verb.includes('archive') ||
        verb.includes('restore') ||
        verb.includes('transition')
      );
    };

    const scheduleInvalidation = (
      payload: WorkItemSocketPayload | undefined,
      forceStateInvalidation: boolean,
    ) => {
      if (payload?.projectId && payload.projectId !== projectId) {
        return;
      }

      if (shouldInvalidateProjectStates(payload, forceStateInvalidation)) {
        pendingInvalidateStates = true;
      }

      const targetId = payload?.workItemId || payload?.entityId;
      if (targetId && targetId !== projectId) {
        pendingTargetIds.add(targetId);
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        if (typeof document !== 'undefined' && document.hidden) {
          pendingInvalidateStates = false;
          pendingTargetIds.clear();
          return;
        }

        const invalidateStates = pendingInvalidateStates;
        const targetIds = Array.from(pendingTargetIds);
        pendingInvalidateStates = false;
        pendingTargetIds.clear();

        queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });

        if (invalidateStates) {
          queryClient.invalidateQueries({ queryKey: ['project-states', projectId] });
          queryClient.invalidateQueries({ queryKey: ['project-state-counts', projectId] });
        }

        for (const id of targetIds) {
          queryClient.invalidateQueries({ queryKey: ['comments', id] });
          queryClient.invalidateQueries({ queryKey: ['work-item-comments', id] });
          queryClient.invalidateQueries({ queryKey: ['work-item-activity', id] });
        }
      }, 300);
    };

    const joinProjectRoom = () => {
      socket.emit(WORK_ITEMS_SOCKET_EVENTS.JOIN, { projectId });
    };

    const handleCreated = (payload?: WorkItemSocketPayload) => {
      scheduleInvalidation(payload, true);
    };

    const handleUpdated = (payload?: WorkItemSocketPayload) => {
      scheduleInvalidation(payload, false);
    };

    const handleDeleted = (payload?: WorkItemSocketPayload) => {
      if (payload?.projectId && payload.projectId !== projectId) {
        return;
      }
      scheduleInvalidation(payload, true);
      const deletedId = payload?.workItemId || payload?.entityId;
      if (deletedId && deletedId !== projectId) {
        callbacksRef.current.onWorkItemDeleted?.(deletedId);
      }
    };

    const handleStateChanged = (payload?: WorkItemSocketPayload) => {
      scheduleInvalidation(payload, true);
    };

    const handleStateUpdated = (payload?: WorkItemSocketPayload) => {
      if (payload?.projectId && payload.projectId !== projectId) {
        return;
      }
      scheduleInvalidation(payload, true);
      callbacksRef.current.onStateReordered?.();
    };

    const handleAccessRevoked = (payload?: { projectId?: string }) => {
      if (payload?.projectId && payload.projectId !== projectId) {
        return;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      pendingInvalidateStates = false;
      pendingTargetIds.clear();
      socket.disconnect();
      queryClient.invalidateQueries({ queryKey: ['work-items', projectId] });
    };

    socket.on('connect', joinProjectRoom);
    socket.on(WORK_ITEMS_SOCKET_EVENTS.CREATED, handleCreated);
    socket.on(WORK_ITEMS_SOCKET_EVENTS.UPDATED, handleUpdated);
    socket.on(WORK_ITEMS_SOCKET_EVENTS.DELETED, handleDeleted);
    socket.on(WORK_ITEMS_SOCKET_EVENTS.STATE_CHANGED, handleStateChanged);
    socket.on(WORK_ITEMS_SOCKET_EVENTS.STATE_UPDATED, handleStateUpdated);
    socket.on(WORK_ITEMS_SOCKET_EVENTS.ACCESS_REVOKED, handleAccessRevoked);

    if (socket.connected) {
      joinProjectRoom();
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      socket.off('connect', joinProjectRoom);
      socket.off(WORK_ITEMS_SOCKET_EVENTS.CREATED, handleCreated);
      socket.off(WORK_ITEMS_SOCKET_EVENTS.UPDATED, handleUpdated);
      socket.off(WORK_ITEMS_SOCKET_EVENTS.DELETED, handleDeleted);
      socket.off(WORK_ITEMS_SOCKET_EVENTS.STATE_CHANGED, handleStateChanged);
      socket.off(WORK_ITEMS_SOCKET_EVENTS.STATE_UPDATED, handleStateUpdated);
      socket.off(WORK_ITEMS_SOCKET_EVENTS.ACCESS_REVOKED, handleAccessRevoked);

      if (socket.connected) {
        socket.emit(WORK_ITEMS_SOCKET_EVENTS.LEAVE, { projectId });
      }
      socketPool.release(NAMESPACES.WORK_ITEMS);
    };
  }, [projectId, enabled, queryClient]);
}
