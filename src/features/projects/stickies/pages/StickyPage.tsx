'use client';

import { useCard } from '@/features/projects/stickies/hooks/use-card';
import React, { useState, useEffect } from "react";
import Card from '../components/card/Card';
import { type Sticky } from '@/features/projects/stickies/types/sticky.types';
import { Loader2 } from "lucide-react";
import { StickiesIcon } from "@/shared/components/icons";
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
import { PageLayout, PageHeader, PageContent } from '@/shared/components/layout';
import TopBar from '../components/layout/TopBar';
import EmptyState from '../components/layout/EmptyState';

const copy = {
  title: "Stickies",
  Icon: StickiesIcon,
  loading: "Loading stickies...",
  empty: "No stickies yet",
  cta: 'Click "Add Sticky" to get started',
  addLabel: "Add Sticky",
};

export default function StickyPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { state, actions } = useCard({
    search: searchQuery,
  });

  if (state.status.isLoading) {
    return (
      <PageLayout>
        <PageHeader title={copy.title} icon={StickiesIcon} />
        <PageContent maxWidth="full">
          <div className="flex-1 flex items-center justify-center gap-3 text-muted-foreground py-20">
            <Loader2 className="h-5 w-5 animate-spin shrink-0" />
            <span className="text-13 font-normal">{copy.loading}</span>
          </div>
        </PageContent>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <TopBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddSticky={actions.add}
        isAddingSticky={state.status.isAdding}
        addLabel={copy.addLabel}
      />

      <PageContent maxWidth="full" noPadding className="p-5">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[1200px]:grid-cols-5 xl:grid-cols-5 gap-4 items-start">
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
                          <div className="w-[240px] h-[340px] rotate-1 scale-105 cursor-grabbing">
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
      </PageContent>
    </PageLayout>
  );
}
