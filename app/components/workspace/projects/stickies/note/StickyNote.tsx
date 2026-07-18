import { type Note, NOTE_COLOR_MAP } from "~/types/sticky";
import StickyContent from "./StickyContent";
import StickyToolbar from "./StickyToolbar";
import { useState, useEffect, useRef, memo, useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { GripVertical, FolderKanban, FileText } from "lucide-react";
import { useParams } from "react-router";
import { cn } from "~/lib/utils";
import { useWorkspaceProjects } from "~/query/workspace";
import { useStickyChildren } from "~/query/sticky";

interface StickyNoteProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
}

const StickyNote = memo(function StickyNote({
  note,
  onUpdate,
  onDelete,
  dragHandleProps,
  isDragging,
  isOverlay,
}: StickyNoteProps) {
  const { workspaceId } = useParams();
  const { projects = [] } = useWorkspaceProjects(workspaceId || "");
  const colorConfig = NOTE_COLOR_MAP[note.color];
  const [editor, setEditor] = useState<Editor | null>(null);
  const [localTitle, setLocalTitle] = useState(note.title || "");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const titleFocusedRef = useRef(false);

  // Load children only for workspace stickies (not for project-scoped stickies or overlay)
  const isParentSticky = !note.projectId && note.scope !== "project" && note.category !== "note";
  const { data: children = [] } = useStickyChildren(
    isParentSticky && !isOverlay ? note._id : undefined
  );

  const projectName = useMemo(() => {
    if (!note.projectId) return null;
    return projects.find((p) => p._id === note.projectId)?.name;
  }, [note.projectId, projects]);

  useEffect(() => {
    if (titleFocusedRef.current) return;
    if (note.title !== undefined && note.title !== localTitle) {
      setLocalTitle(note.title);
    }
  }, [note.title]);

  useEffect(() => {
    if (!titleFocusedRef.current) return;
    const timer = setTimeout(() => {
      if (localTitle !== note.title) {
        onUpdate(note._id, { title: localTitle });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localTitle, note._id, note.title, onUpdate]);

  const topAccentStyle = {
    backgroundColor: colorConfig.bg,
    filter: "brightness(0.88)",
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded",
        isDragging
          ? "shadow-md scale-[1.02] rotate-1 z-50 pointer-events-none"
          : "transition-[box-shadow,background-color,transform] duration-200 hover:shadow-md hover:-translate-y-0.5"
      )}
      style={{ backgroundColor: colorConfig.bg, color: colorConfig.text }}
    >
      {/* Top accent bar + drag handle */}
      <div
        className="h-9 flex items-center justify-between px-4 cursor-grab active:cursor-grabbing active:outline-0 select-none rounded-t"
        style={topAccentStyle}
        {...dragHandleProps}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          {projectName && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/10 text-[9px] font-bold uppercase tracking-wider shrink-0">
              <FolderKanban className="h-2.5 w-2.5" />
              {projectName}
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap overflow-hidden min-h-6">
            {note.labels && note.labels.length > 0 ? (
              note.labels.map((label) => (
                <span
                  key={label._id}
                  className="px-1.5 py-0.5 text-[9px] rounded font-semibold text-white shrink-0"
                  style={{ backgroundColor: label.color || "#aaa" }}
                >
                  {label.name}
                </span>
              ))
            ) : null}
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
            if (localTitle !== note.title) onUpdate(note._id, { title: localTitle });
          }}
          placeholder="Title…"
          className="w-full bg-transparent border-none outline-none font-bold text-base placeholder:opacity-40"
          style={{ color: "inherit" }}
        />
      </div>

      {/* Content */}
      <StickyContent note={note} onUpdate={onUpdate} onReady={setEditor} isOverlay={isOverlay} />

      {/* Linked project notes (children) */}
      {children.length > 0 && (
        <div
          className="mx-4 mb-2 mt-1 rounded border border-black/10 overflow-hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.06)" }}
        >
          <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider opacity-50 border-b border-black/10">
            Notes ({children.length})
          </div>
          <div className="flex flex-col divide-y divide-black/5 max-h-32 overflow-y-auto">
            {children.map((link) => (
              <div key={link._id} className="flex items-center gap-2 px-2.5 py-1.5">
                <FileText className="h-3 w-3 opacity-40 shrink-0" />
                <span className="text-[11px] font-medium truncate flex-1 opacity-80">
                  {(link.sticky || link.note)?.title || "Untitled"}
                </span>
                {link.projectId && typeof link.projectId === "object" && (
                  <span className="text-[9px] opacity-40 shrink-0">{link.projectId.name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div
        className={cn(
          "transition-opacity duration-150",
          activeModal ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <StickyToolbar
          note={note}
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
  prev.note === next.note &&
  prev.isDragging === next.isDragging &&
  prev.isOverlay === next.isOverlay &&
  prev.onUpdate === next.onUpdate &&
  prev.onDelete === next.onDelete
);

export default StickyNote;
