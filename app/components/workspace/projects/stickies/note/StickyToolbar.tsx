import type { Note } from "../types/note.type";
import { Palette, Bold, Italic, ListTodo, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import ColorModal from "../modals/ColorModal";
import DeleteModal from "../modals/deleteModal";
import TagPicker from "./TagPicker";

interface StickyToolbarProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  editor: Editor | null;
}

type ActiveModal = "color" | "delete" | null;

export default function StickyToolbar({
  note,
  onUpdate,
  onDelete,
  editor,
}: StickyToolbarProps) {
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const ref = useRef<HTMLDivElement>(null);

  const isColorOpen = activeModal === "color";
  const isDeleteOpen = activeModal === "delete";

  useEffect(() => {
    if (!isColorOpen) return;

    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setActiveModal(null);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isColorOpen]);

  function closeModal() {
    setActiveModal(null);
  }

  const handleToggleTag = (tagId: string) => {
      // note.tags contains Tag objects (populated), but for update we usually just send IDs or rely on backend logic.
      // Based on Sticky model, updates usually replace array.
      // note.tags is Tag[] from populate.
      
      const currentTagIds = note.tags.map(t => t._id);
      let newTagIds;
      if (currentTagIds.includes(tagId)) {
          newTagIds = currentTagIds.filter(id => id !== tagId);
      } else {
          newTagIds = [...currentTagIds, tagId];
      }
      
      onUpdate(note._id, { tags: newTagIds as any }); // Cast needed because Partial<Note> expects Tag[] but API often accepts IDs. 
      // Actually, frontend Note type has Tag[]. We might need to handle this mismatch or ensure API response updates Note correctly.
      // The updateSticky in sticky.ts sends json body. Backend expects IDs for `tags` field (ref ObjectId).
      // So sending array of strings is correct for Backend.
      // However, optimistically updating FE state might be tricky if we don't have the full Tag object immediately.
      // React Query invalidation will fix it quickly.
  };

  return (
    <div className="h-9 px-5 pb-5 flex items-center justify-between">
      <div ref={ref} className="relative flex items-center gap-1">
        <button
          type="button"
          title="Background color"
          onClick={() =>
            setActiveModal((m) => (m === "color" ? null : "color"))
          }
          className="flex items-center pr-4 text-gray-500 hover:text-gray-700"
        >
          <Palette size={16} />
        </button>

        <button
          type="button"
          title="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor}
          aria-disabled={!editor}
          className="flex items-center pr-4 text-gray-500 hover:text-gray-700 disabled:opacity-50"
        >
          <Bold size={16} />
        </button>

        <button
          type="button"
          title="Italic"
          className="flex items-center pr-4 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor}
          aria-disabled={!editor}
        >
          <Italic size={16} />
        </button>

        <button
          type="button"
          title="Task list"
          className="flex items-center pr-4 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
          disabled={!editor}
          aria-disabled={!editor}
        >
          <ListTodo size={16} />
        </button>

        <div className="pr-4">
             <TagPicker 
                selectedTagIds={note.tags.map(t => t._id)}
                onToggleTag={handleToggleTag}
             />
        </div>

        {isColorOpen && (
          <ColorModal note={note} onUpdate={onUpdate} onClose={closeModal} />
        )}
      </div>

      <button
        type="button"
        title="Delete"
        onClick={() => setActiveModal("delete")}
        className="flex items-center text-gray-500 hover:text-red-500"
      >
        <Trash2 size={16} />
      </button>

      <DeleteModal
        open={isDeleteOpen}
        onCancel={closeModal}
        onConfirm={() => {
          onDelete(note._id);
          closeModal();
        }}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
      />
    </div>
  );
}
