import type { Note } from "~/types/sticky";
import type { Editor } from "@tiptap/react";
import { memo } from "react";
import NoteEditor from "./NoteEditor";

interface StickyContentProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onReady?: (editor: Editor | null) => void;
  isOverlay?: boolean;
}

export default memo(function StickyContent({
  note,
  onUpdate,
  onReady,
  isOverlay,
}: StickyContentProps) {
  return (
    <NoteEditor 
      note={note} 
      onUpdate={onUpdate} 
      onReady={onReady} 
      isOverlay={isOverlay} 
    />
  );
});

