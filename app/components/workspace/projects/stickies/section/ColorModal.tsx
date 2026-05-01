import React from "react";
import { type Note, type NoteColor, NOTE_COLOR_MAP } from "~/types/sticky";

interface ColorModalProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onClose: () => void;
}

export default function ColorModal({
  note,
  onUpdate,
  onClose,
}: ColorModalProps) {
  return (
    <div className="absolute bottom-8 left-0 bg-white border rounded shadow-md -ml-3 p-3 w-[242px] flex flex-col gap-2 z-50 animate-in fade-in zoom-in-95 duration-200">
      <div className="mb-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
        Background colors
      </div>
      <div className="grid grid-cols-6 gap-2">
        {(Object.keys(NOTE_COLOR_MAP) as NoteColor[]).map((noteColor) => (
          <button
            key={noteColor}
            type="button"
            className={`w-6 h-6 rounded-md transition-all hover:scale-110 active:scale-95 shadow-sm border ${
              note.color === noteColor ? "ring-2 ring-black ring-offset-1" : "border-black/5"
            }`}
            style={{
              backgroundColor: NOTE_COLOR_MAP[noteColor].bg,
            }}
            onClick={() => {
              onUpdate(note._id, { color: noteColor });
              onClose();
            }}
          />
        ))}
      </div>
    </div>
  );
}
