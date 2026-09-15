'use client';

import { useCard } from '@/features/projects/stickies/hooks/use-card';
import React, { useState, useEffect } from "react";
import Card from '../components/card/Card';
import { type Sticky } from '@/features/projects/stickies/types/sticky.types';
import { Loader2 } from "lucide-react";
import { StickiesIcon } from "@/shared/components/ui";
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
import { Sortable } from '../components/card/Sortable';

import TopBar from '../components/layout/TopBar';
import EmptyState from '../components/layout/EmptyState';

const copy = {
  title: "Stickies",
  Icon: StickiesIcon,
  loading: "Loading stickies...",
  emptyFiltered: "No stickies match your filters",
  empty: "No stickies yet",
  cta: 'Click "Add Sticky" to get started',
  addLabel: "Add Sticky",
};

interface StickyPageProps {
  projectId?: string;
  workspaceId?: string;
}

export default function StickyPage({ projectId, workspaceId }: StickyPageProps = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { state, actions } = useCard({
    search: searchQuery,
    projectId,
    workspaceId,
  });

  if (state.status.isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border px-5 h-13 flex items-center">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{copy.title}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
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
              items={state.items.map((sticky: Sticky) => sticky.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
                {state.items.map((sticky: Sticky) => (
                  <Sortable
                    key={sticky.id}
                    sticky={sticky}
                    onUpdate={actions.update}
                    onDelete={actions.delete}
                  />
                ))}
              </div>
            </SortableContext>

            {isMounted &&
              createPortal(
                <DragOverlay
                  dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                      styles: {
                        active: {
                          opacity: '0.5',
                        },
                      },
                    }),
                  }}
                >
                  {state.activeId
                    ? (() => {
                        const sticky = state.items.find(
                          (n: any) => n.id === state.activeId,
                        );
                        return sticky ? (
                          <div className="rotate-1 scale-105 cursor-grabbing">
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
                document.body,
              )}
          </DndContext>
        )}
      </main>
    </div>
  );
}
