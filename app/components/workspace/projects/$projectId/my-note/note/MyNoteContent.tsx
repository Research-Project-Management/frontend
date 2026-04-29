import type { Note } from "../types/note.type";
import type { Editor } from "@tiptap/react";
import { memo } from "react";
import NoteEditor from "../../../stickies/note/NoteEditor";

interface MyNoteContentProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onReady?: (editor: Editor | null) => void;
  isOverlay?: boolean;
}

const MyNoteContent = memo(function MyNoteContent({
  note,
  onUpdate,
  onReady,
  isOverlay,
}: MyNoteContentProps) {
  return (
    <NoteEditor 
      note={note} 
      onUpdate={onUpdate} 
      onReady={onReady} 
      isOverlay={isOverlay}
      placeholder="Click to type here..."
    />
  );
});

export default MyNoteContent;

