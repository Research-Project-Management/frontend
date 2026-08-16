'use client';

import { type Sticky } from '@/features/workspaces/projects/stickies/types/sticky.types';
import { STICKY_COLOR_MAP } from '@/features/workspaces/projects/stickies/types/sticky.types';
import Content from "./Content";
import Toolbar from "./Toolbar";
import React, { useState, useEffect, useRef, memo, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { GripVertical, FolderKanban } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useParams } from "next/navigation";
import { useWorkspaceProjects } from '@/features/workspaces/projects/shell/services/project.service';




interface CardProps {
  sticky: Sticky;
  onUpdate: (id: string, updates: Partial<Sticky>) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
}

const Card = memo(function Card({
  sticky,
  onUpdate,
  onDelete,
  dragHandleProps,
  isDragging,
  isOverlay,
}: CardProps) {
  const { workspaceId, projectId: currentProjectId } = useParams() as { workspaceId: string, projectId?: string };
  const { projects = [] } = useWorkspaceProjects(workspaceId || "");
  const colorConfig = STICKY_COLOR_MAP[sticky.color];
  const [editor, setEditor] = useState<Editor | null>(null);
  const [localTitle, setLocalTitle] = useState(sticky.title || "");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const titleFocusedRef = useRef(false);

  useEffect(() => {
    if (titleFocusedRef.current) return;
    if (sticky.title !== undefined && sticky.title !== localTitle) {
      setLocalTitle(sticky.title);
    }
  }, [sticky.title]);

  useEffect(() => {
    if (!titleFocusedRef.current) return;
    const timer = setTimeout(() => {
      if (localTitle !== sticky.title) {
        onUpdate(sticky._id, { title: localTitle });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localTitle, sticky._id, sticky.title, onUpdate]);

  const topAccentStyle = {
    backgroundColor: colorConfig.bg,
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-lg border border-black/10 dark:border-white/10 overflow-hidden",
        isDragging
          ? "shadow-2xl scale-[1.02] rotate-1 z-50 pointer-events-none"
          : "transition-[box-shadow,background-color,transform] duration-200"
      )}
      style={{ backgroundColor: colorConfig.bg, color: colorConfig.text }}
    >
      {/* Top accent bar + drag handle */}
      <div
        className="h-10 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing active:outline-0 select-none bg-black/5 dark:bg-white/10 border-b border-black/5 dark:border-white/10"
        style={topAccentStyle}
        aria-label="Drag to move sticky"
        role="separator"
        {...dragHandleProps}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <div className="text-[10px] opacity-50">
            {sticky.updatedAt ? new Date(sticky.updatedAt).toLocaleDateString() : ""}
          </div>
          <div className="flex items-center gap-1 flex-wrap overflow-hidden min-h-6">
          </div>
        </div>
        <GripVertical className="h-3.5 w-3.5 opacity-30 shrink-0" />
      </div>

      {/* Title */}
      <div className="px-4 pt-4 pb-0">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onFocus={() => { titleFocusedRef.current = true; }}
          onBlur={() => {
            titleFocusedRef.current = false;
            if (localTitle !== sticky.title) onUpdate(sticky._id, { title: localTitle });
          }}
          placeholder="Title…"
          aria-label="Sticky title"
          className="w-full bg-transparent border-0 outline-none resize-none text-sm font-semibold tracking-tight placeholder:text-current/40 placeholder:font-normal"
          style={{ color: "inherit" }}
        />
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
}, (prev, next) =>
  prev.sticky === next.sticky &&
  prev.isDragging === next.isDragging &&
  prev.isOverlay === next.isOverlay &&
  prev.onUpdate === next.onUpdate &&
  prev.onDelete === next.onDelete
);

export default Card;

