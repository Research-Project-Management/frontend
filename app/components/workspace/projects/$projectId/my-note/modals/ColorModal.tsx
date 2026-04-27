import { cn } from "~/lib/utils";
import type { Note } from "../types/note.type";
import { type NoteColor, NOTE_COLOR_MAP } from "../types/noteColor.type";

interface ColorModalProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onClose: () => void;
  isToolbar?: boolean;
}

export default function ColorModal({
  note,
  onUpdate,
  onClose,
  isToolbar,
}: ColorModalProps) {
  return (
    <div className={cn(
      "absolute bg-background border border-border/40 rounded-xl shadow-xl p-3 w-[210px] flex flex-col gap-2 z-50 animate-in fade-in slide-in-from-bottom-2",
      isToolbar ? "bottom-12 left-0" : "bottom-8 left-0"
    )}>
      <div className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Background
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {(Object.keys(NOTE_COLOR_MAP) as NoteColor[]).map((noteColor) => (
          <button
            key={noteColor}
            type="button"
            className={cn(
              "w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110",
              note.color === noteColor ? "border-primary shadow-sm" : "border-transparent"
            )}
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
