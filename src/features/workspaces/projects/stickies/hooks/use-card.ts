'use client';

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSticky } from '@/features/workspaces/projects/stickies/hooks/use-sticky';
import { type Sticky, STICKY_COLOR_CYCLE } from '@/features/workspaces/projects/stickies/types/sticky.types';
import { isStickyEmpty } from '../utils/sticky.utils';
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

export const useCard = (options?: { search?: string; projectId?: string }) => {
  const { workspaceId } = useParams() as { workspaceId: string };
  const search = options?.search;
  const projectId = options?.projectId;

  const [activeId, setActiveId] = useState<string | null>(null);

  const api = useSticky(workspaceId, search, projectId);
  const stickies = (api.query.data || []) as Sticky[];

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return {
    state: {
      items: stickies,
      activeId,
      sensors,
      status: {
        isLoading: api.query.isLoading,
        isAdding: api.mutations.create.isPending,
        error: api.query.error,
      },
    },
    actions: {
      add: useCallback(() => {
        if (!workspaceId || api.mutations.create.isPending) return;
        if (stickies.some(isStickyEmpty)) return;

        const lastColor = stickies.length > 0 ? stickies[0].color : undefined;
        const idx = lastColor ? STICKY_COLOR_CYCLE.indexOf(lastColor) : -1;
        const nextColor = STICKY_COLOR_CYCLE[idx === -1 ? 0 : (idx + 1) % STICKY_COLOR_CYCLE.length];

        api.mutations.create.mutate({
          workspaceId,
          content: "<p></p>",
          color: nextColor,
          title: "",
          position: { x: 0, y: 0 },
        });
      }, [workspaceId, stickies, api.mutations.create]),

      update: useCallback(
        (id: string, updates: any) =>
          api.mutations.update.mutate({ stickyId: id, updates }),
        [api.mutations.update],
      ),
      delete: useCallback(
        (id: string) => api.mutations.remove.mutate(id),
        [api.mutations.remove],
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
            (sticky) => sticky._id === String(active.id),
          );
          const newIdx = stickies.findIndex(
            (sticky) => sticky._id === String(over.id),
          );

          if (oldIdx !== -1 && newIdx !== -1) {
            const newOrderIds = arrayMove(
              stickies.map((sticky) => sticky._id),
              oldIdx,
              newIdx,
            );
            api.mutations.reorder.mutate(newOrderIds);
          }
        },
        [stickies, api.mutations.reorder],
      ),
    },
  };
};
