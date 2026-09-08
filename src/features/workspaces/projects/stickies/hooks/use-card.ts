'use client';

import { useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useSticky } from '@/features/workspaces/projects/stickies/hooks/use-sticky';
import { type Sticky, STICKY_COLOR_CYCLE } from '@/features/workspaces/projects/stickies/types/sticky.types';
import { isStickyEmpty } from '@/features/workspaces/projects/stickies/utils/sticky.utils';
import { toast } from "sonner";
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

export const useCard = (options?: { search?: string; projectId?: string }) => {
  const params = useParams() as { workspaceId?: string; id?: string };
  const workspaceId = params?.workspaceId || params?.id || '';
  const search = options?.search;
  const projectId = options?.projectId;

  const [activeId, setActiveId] = useState<string | null>(null);

  const api = useSticky(workspaceId, search, projectId);
  const stickies = useMemo(() => (api.query.data || []) as Sticky[], [api.query.data]);

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

  const getStickyId = (s: Sticky) => s.id || '';
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
        if (!workspaceId || isCreatePending) return;

        if (stickies.some(isStickyEmpty)) {
          toast.info("Please add content to your empty sticky before creating a new one", {
            id: "empty-sticky-info",
          });
          return;
        }

        const lastColor = stickies.length > 0 ? stickies[0].color : undefined;
        const idx = lastColor ? STICKY_COLOR_CYCLE.indexOf(lastColor) : -1;
        const nextColor = STICKY_COLOR_CYCLE[idx === -1 ? 0 : (idx + 1) % STICKY_COLOR_CYCLE.length];

        createStickyMutate({
          workspaceId,
          content: "<p></p>",
          color: nextColor,
          title: "",
          position: { x: 0, y: 0 },
        });
      }, [workspaceId, stickies, createStickyMutate, isCreatePending]),

      update: useCallback(
        (id: string, updates: any) =>
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

          const oldIdx = stickies.findIndex(
            (sticky: Sticky) => getStickyId(sticky) === String(active.id),
          );
          const newIdx = stickies.findIndex(
            (sticky: Sticky) => getStickyId(sticky) === String(over.id),
          );

          if (oldIdx !== -1 && newIdx !== -1) {
            const newOrderIds: string[] = arrayMove<string>(
              stickies.map(getStickyId).filter((id): id is string => Boolean(id)),
              oldIdx,
              newIdx,
            );
            reorderStickyMutate(newOrderIds);
          }
        },
        [stickies, reorderStickyMutate],
      ),
    },
  };
};
