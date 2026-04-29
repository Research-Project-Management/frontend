import type { Note } from "../types/note.type";
import { Palette, Bold, Italic, ListTodo, Trash2 } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import ColorModal from "../modals/ColorModal";
import DeleteModal from "../modals/deleteModal";
import TagPicker from "./TagPicker";

interface MyNoteToolbarProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  editor: Editor | null;
}

type ActiveModal = "color" | "delete" | null;

export default function MyNoteToolbar({
  note,
  onUpdate,
  onDelete,
  editor,
}: MyNoteToolbarProps) {
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
    const currentTagIds = (note.tags || []).map((t) => (typeof t === 'string' ? t : t._id));
    let newTagIds;
    if (currentTagIds.includes(tagId)) {
      newTagIds = currentTagIds.filter((id) => id !== tagId);
    } else {
      newTagIds = [...currentTagIds, tagId];
    }
    onUpdate(note._id, { tags: newTagIds as any });
  };

  return (
    <div className="h-9 px-3 pb-2 flex items-center justify-between border-t border-black/5">
      <div ref={ref} className="relative flex items-center gap-0.5">
        <ToolbarBtn
          title="Color"
          onClick={() => setActiveModal((m) => (m === "color" ? null : "color"))}
        >
          <Palette size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor}
        >
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor}
        >
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Task list"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
          disabled={!editor}
        >
          <ListTodo size={14} />
        </ToolbarBtn>
        <TagPicker
          selectedTagIds={(note.tags || []).map((t) => (typeof t === 'string' ? t : t._id))}
          onToggleTag={handleToggleTag}
        />
        {isColorOpen && (
          <ColorModal note={note} onUpdate={onUpdate} onClose={closeModal} />
        )}
      </div>

      <ToolbarBtn
        title="Delete"
        onClick={() => setActiveModal("delete")}
        danger
      >
        <Trash2 size={14} />
      </ToolbarBtn>

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

function ToolbarBtn({
  children,
  title,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-30 ${
        danger
          ? "text-current opacity-50 hover:opacity-100 hover:text-red-500 hover:bg-red-50"
          : "text-current opacity-50 hover:opacity-100 hover:bg-black/10"
      }`}
    >
      {children}
    </button>
  );
}
