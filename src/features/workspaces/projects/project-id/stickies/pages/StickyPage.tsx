'use client';

import { useCard } from '../hooks/use-card';
import React, { useState, useEffect } from "react";
import Card from '../components/card/Card';
import type { Sticky } from '../types/sticky.types';
import { useParams } from "next/navigation";
import { Loader2, Layers2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  defaultDropAnimationSideEffects,
} from "@dnd-kit/core";
import { createPortal } from "react-dom";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableSticky } from '../components/card/Sortable';

import TopBar from '../components/layout/Topbar';
import EmptyState from '../components/layout/EmptyState';

const copy = {
  title: "Stickies",
  Icon: Layers2,
  loading: "Loading stickies...",
  addLabel: "Add Sticky",
};

export default function StickyPage() {
  const { workspaceId, projectId } = useParams() as { workspaceId: string; projectId: string };
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const { state, actions } = useCard({ search: searchQuery });

  if (state.status.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border/60 px-5 h-13 flex items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{copy.title}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">{copy.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddSticky={actions.add}
        isAddingSticky={state.status.isAdding}
        addLabel={copy.addLabel}
      />

      <main className="flex-1 overflow-auto p-5">
        {state.items.length === 0 ? (
          <EmptyState searchQuery={searchQuery} />
        ) : (
          <DndContext
            sensors={state.sensors}
            collisionDetection={closestCorners}
            onDragStart={actions.dragStart}
            onDragEnd={actions.dragEnd}
          >
            <SortableContext
              items={state.items.map((sticky: Sticky) => sticky._id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                {state.items.map((sticky: Sticky) => (
                  <SortableSticky
                    key={sticky._id}
                    sticky={sticky}
                    onUpdate={actions.update}
                    onDelete={actions.delete}
                  />
                ))}
              </div>
            </SortableContext>

            {isMounted && createPortal(
              <DragOverlay dropAnimation={{
                sideEffects: defaultDropAnimationSideEffects({
                  styles: {
                    active: {
                      opacity: '0.5',
                    },
                  },
                }),
              }}>
                {state.activeId
                  ? (() => {
                    const sticky = state.items.find((s: Sticky) => s._id === state.activeId);
                    return sticky ? (
                      <div className="rotate-1 scale-105 shadow-2xl cursor-grabbing">
                        <Card
                          sticky={sticky}
                          onUpdate={actions.update}
                          onDelete={actions.delete}
                          isDragging={true}
                        />
                      </div>
                    ) : null;
                  })()
                  : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        )}
      </main>
    </div>
  );
}
