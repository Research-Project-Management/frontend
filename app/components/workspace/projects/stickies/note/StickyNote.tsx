import type { Note } from "../types/note.type";
import { NOTE_COLOR_MAP } from "../types/noteColor.type";
import StickyContent from "./StickyContent";
import StickyToolbar from "./StickyToolbar";
import { useState, useEffect, memo } from "react";
import type { Editor } from "@tiptap/react";

interface StickyNoteProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const StickyNote = memo(function StickyNote({
  note,
  onUpdate,
  onDelete,
  dragHandleProps,
}: StickyNoteProps) {
  const colorConfig = NOTE_COLOR_MAP[note.color];
  const [editor, setEditor] = useState<Editor | null>(null);
  const [localTitle, setLocalTitle] = useState(note.title || "");

  // Sync local title with note prop if it changes from server/externally
  useEffect(() => {
    if (note.title !== undefined && note.title !== localTitle) {
      // Only sync if not recently edited to avoid cursor jumps
      // But for simplicity, we check if the target has matured.
      setLocalTitle(note.title);
    }
  }, [note.title]);

  // Debounce title update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localTitle !== note.title) {
        onUpdate(note._id, { title: localTitle });
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [localTitle, note._id, note.title, onUpdate]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalTitle(e.target.value);
  };

  return (
    <div
      className="relative flex flex-col min-h-[354px] rounded shadow-sm transition-shadow hover:shadow-md"
      style={{
        backgroundColor: colorConfig.bg,
        color: colorConfig.text,
        border: colorConfig.border
          ? `1px solid ${colorConfig.border}`
          : undefined,
        boxShadow: "0 1px 2px rgba(0,0,0,0.07)",
      }}
    >
      <div
        className="px-4 pt-4 pb-0 flex flex-col gap-2 cursor-move"
        {...dragHandleProps}
      >
        <input
          type="text"
          value={localTitle}
          onChange={handleTitleChange}
          placeholder="Title"
          className="w-full bg-transparent border-none outline-none font-bold text-lg placeholder:text-gray-400/70"
          style={{ color: "inherit" }}
        />
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <span
                key={tag._id}
                className="px-1.5 py-0.5 text-[10px] rounded-sm font-medium opacity-80"
                style={{ backgroundColor: tag.color || "#ccc", color: "#fff" }}
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <StickyContent note={note} onUpdate={onUpdate} onReady={setEditor} />
      <StickyToolbar
        note={note}
        onUpdate={onUpdate}
        onDelete={onDelete}
        editor={editor}
      />
    </div>
  );
});

export default StickyNote;
