import type { Note } from "../types/note.type";
import { type NoteColor, NOTE_COLOR_MAP } from "../types/noteColor.type";

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
    <div className="absolute bottom-8 left-0 bg-white border rounded shadow-md -ml-3 p-3 w-[242px] flex flex-col gap-2">
      <div className="mb-2 text-xs font-medium text-gray-500">
        Background colors
      </div>
      <div className="grid grid-cols-6 gap-2">
        {(Object.keys(NOTE_COLOR_MAP) as NoteColor[]).map((noteColor) => (
          <button
            key={noteColor}
            type="button"
            className="w-6 h-6 rounded"
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
