import type { Note } from "../types/note.type";
import { NOTE_COLOR_MAP } from "../types/noteColor.type";
import MyNoteContent from "./MyNoteContent";
import MyNoteToolbar from "./MyNoteToolbar";
import { useState, useEffect, useRef, memo } from "react";
import type { Editor } from "@tiptap/react";
import { GripVertical } from "lucide-react";

interface MyNoteProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  isOverlay?: boolean;
}

const MyNote = memo(function MyNote({
  note,
  onUpdate,
  onDelete,
  dragHandleProps,
  isDragging,
  isOverlay,
}: MyNoteProps) {
  const colorConfig = NOTE_COLOR_MAP[note.color];
  const [editor, setEditor] = useState<Editor | null>(null);
  const [localTitle, setLocalTitle] = useState(note.title || "");
  const titleFocusedRef = useRef(false);

  // Only sync title from server when not currently editing it
  useEffect(() => {
    if (titleFocusedRef.current) return;
    if (note.title !== undefined && note.title !== localTitle) {
      setLocalTitle(note.title);
    }
  }, [note.title]);

  // Debounce title update
  useEffect(() => {
    if (!titleFocusedRef.current) return;
    const timer = setTimeout(() => {
      if (localTitle !== note.title) {
        onUpdate(note._id, { title: localTitle });
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [localTitle, note._id, note.title, onUpdate]);

  // Derive a slightly darker shade for the top accent
  const topAccentStyle = {
    backgroundColor: colorConfig.bg,
    filter: "brightness(0.88)",
  };

  return (
    <div
      className={`group relative flex flex-col rounded overflow-hidden transition-[box-shadow,background-color,transform] duration-200 ${
        isDragging
          ? "shadow-md scale-[1.02] rotate-1"
          : "hover:shadow-md hover:-translate-y-0.5"
      }`}
      style={{
        backgroundColor: colorConfig.bg,
        color: colorConfig.text,
      }}
    >
      {/* Top accent bar + drag handle */}
      <div
        className="min-h-7 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing active:outline-0 select-none"
        style={topAccentStyle}
        {...dragHandleProps}
      >
        {/* Tags in header */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 flex-wrap overflow-hidden min-h-6">
            {note.tags && note.tags.length > 0 ? (
              note.tags.map((tag) => (
                <span
                  key={tag._id}
                  className="px-1.5 py-0.5 text-[9px] rounded font-semibold text-white shrink-0"
                  style={{ backgroundColor: tag.color || "#aaa" }}
                >
                  {tag.name}
                </span>
              ))
            ) : (
              <span className="text-[10px] opacity-40 italic">Project Note</span>
            )}
          </div>
        </div>
        <GripVertical className="h-3.5 w-3.5 opacity-30 shrink-0" />
      </div>

      {/* Title */}
      <div className="px-4 pt-3 pb-0">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          onFocus={() => {
            titleFocusedRef.current = true;
          }}
          onBlur={() => {
            titleFocusedRef.current = false;
            if (localTitle !== note.title) {
              onUpdate(note._id, { title: localTitle });
            }
          }}
          placeholder="Title…"
          className="w-full bg-transparent border-none outline-none font-bold text-base placeholder:opacity-40"
          style={{ color: "inherit" }}
        />
      </div>

      {/* Content */}
      <MyNoteContent note={note} onUpdate={onUpdate} onReady={setEditor} isOverlay={isOverlay} />

      {/* Toolbar — show on group-hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <MyNoteToolbar
          note={note}
          onUpdate={onUpdate}
          onDelete={onDelete}
          editor={editor}
        />
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.note === next.note &&
    prev.isDragging === next.isDragging &&
    prev.isOverlay === next.isOverlay &&
    prev.onUpdate === next.onUpdate &&
    prev.onDelete === next.onDelete
  );
});

export default MyNote;
