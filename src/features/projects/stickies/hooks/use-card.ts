'use client';

import { useState, useCallback, useMemo } from "react";
import { useSticky } from '@/features/projects/stickies/hooks/use-sticky';
import { type Sticky } from '@/features/projects/stickies/types/sticky.types';
import { isStickyEmpty, stripHtml } from '@/features/projects/stickies/utils/sticky.utils';
import {
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";

const getStickyId = (sticky: Sticky): string => String(sticky.id || '');

export interface UseCardOptions {
  search?: string;
  projectId?: string;
  workspaceId?: string;
}

export const useCard = (options?: UseCardOptions) => {
  const search = options?.search;
  const projectId = options?.projectId;
  const workspaceId = options?.workspaceId;

  const [activeId, setActiveId] = useState<string | null>(null);

  const api = useSticky(workspaceId, search, projectId);
  const rawStickies = useMemo(() => (api.query.data || []) as Sticky[], [api.query.data]);

  const stickies = useMemo(() => {
    if (!search || !search.trim()) return rawStickies;
    const q = search.toLowerCase().trim();
    return rawStickies.filter((s) => {
      const contentText = stripHtml(s.content || '').toLowerCase();
      const titleText = (s.title || '').toLowerCase();
      return contentText.includes(q) || titleText.includes(q);
    });
  }, [rawStickies, search]);

  const createStickyMutate = api.mutations.create.mutate;
  const isCreatePending = api.mutations.create.isPending;
  const updateStickyMutate = api.mutations.update.mutate;
  const removeStickyMutate = api.mutations.remove.mutate;
  const reorderStickyMutate = api.mutations.reorder.mutate;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const hasEmptySticky = stickies.some(isStickyEmpty);

  return {
    state: {
      items: stickies,
      activeId,
      sensors,
      status: {
        isLoading: api.query.isLoading,
        isAdding: isCreatePending,
        hasEmptySticky,
        error: api.query.error,
      },
    },
    actions: {
      add: useCallback(() => {
        if (isCreatePending) return;
        createStickyMutate({ projectId });
      }, [createStickyMutate, isCreatePending, projectId]),

      update: useCallback(
        (id: string, updates: Partial<Sticky>) =>
          updateStickyMutate({ stickyId: id, updates }),
        [updateStickyMutate],
      ),
      delete: useCallback(
        (id: string) => {
          if (!id) return;
          removeStickyMutate(id);
        },
        [removeStickyMutate],
      ),

      dragStart: useCallback((event: DragStartEvent) => {
        setActiveId(String(event.active.id));
      }, []),

      dragEnd: useCallback(
        (event: DragEndEvent) => {
          setActiveId(null);
          const { active, over } = event;
          if (!over || active.id === over.id) return;

          const oldIdx = rawStickies.findIndex(
            (sticky: Sticky) => getStickyId(sticky) === String(active.id),
          );
          const newIdx = rawStickies.findIndex(
            (sticky: Sticky) => getStickyId(sticky) === String(over.id),
          );

          if (oldIdx !== -1 && newIdx !== -1) {
            const newOrderIds: string[] = arrayMove<string>(
              rawStickies.map(getStickyId).filter((id): id is string => Boolean(id)),
              oldIdx,
              newIdx,
            );
            reorderStickyMutate(newOrderIds);
          }
        },
        [rawStickies, reorderStickyMutate],
      ),
    },
  };
};

