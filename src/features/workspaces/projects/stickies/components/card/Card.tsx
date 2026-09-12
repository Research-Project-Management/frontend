'use client';

import { type Sticky } from '@/features/workspaces/projects/stickies/types/sticky.types';
import { STICKY_COLOR_MAP } from '@/features/workspaces/projects/stickies/types/sticky.types';
import Content from "./Content";
import Toolbar from "./Toolbar";
import React, { useState, memo } from "react";
import type { Editor } from "@tiptap/react";
import { GripVertical } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface CardProps {
  sticky: Sticky;
  onUpdate: (id: string, updates: Partial<Sticky>) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
}

const Card = memo(
  function Card({
    sticky,
    onUpdate,
    onDelete,
    dragHandleProps,
    isDragging,
    isOverlay,
  }: CardProps) {
    const colorConfig = STICKY_COLOR_MAP[sticky.color];
    const [editor, setEditor] = useState<Editor | null>(null);
    const [activeModal, setActiveModal] = useState<string | null>(null);

    const topAccentStyle = {
      backgroundColor: colorConfig.bg,
    };

    return (
      <div
        className={cn(
          "group relative flex flex-col rounded-lg border border-border overflow-hidden",
          isDragging
            ? " scale-[1.02] rotate-1 z-50 pointer-events-none"
            : "transition-[box-shadow,background-color,transform] duration-200"
        )}
        style={{ backgroundColor: colorConfig.bg, color: colorConfig.text }}
      >
        {/* Top accent bar + drag handle */}
        <div
          tabIndex={0}
          className="h-10 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing active:outline-0 select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          style={topAccentStyle}
          aria-label="Drag to move sticky"
          aria-roledescription="draggable card handle"
          {...dragHandleProps}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
            <div className="text-xs opacity-50 font-medium">
              {sticky.updatedAt ? new Date(sticky.updatedAt).toLocaleDateString() : ""}
            </div>
          </div>
          <GripVertical className="h-3.5 w-3.5 opacity-30 shrink-0" />
        </div>

        {/* Content */}
        <Content sticky={sticky} onUpdate={onUpdate} onReady={setEditor} isOverlay={isOverlay} />

        {/* Toolbar */}
        <div className="transition-opacity duration-150">
          <Toolbar
            sticky={sticky}
            onUpdate={onUpdate}
            onDelete={onDelete}
            editor={editor}
            activeModal={activeModal}
            onActiveModalChange={setActiveModal}
          />
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.sticky === next.sticky &&
    prev.isDragging === next.isDragging &&
    prev.isOverlay === next.isOverlay &&
    prev.onUpdate === next.onUpdate &&
    prev.onDelete === next.onDelete
);

export default Card;
