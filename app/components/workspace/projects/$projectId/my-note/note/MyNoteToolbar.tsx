import type { Note } from "../types/note.type";
import { Palette, Bold, Italic, ListTodo, Trash2 } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import ColorModal from "../modals/ColorModal";
import DeleteModal from "../modals/deleteModal";
import TagPicker from "./TagPicker";
import { cn } from "~/lib/utils";

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
    const currentTagIds = (note.tags || []).map((t) => t._id);
    let newTagIds;
    if (currentTagIds.includes(tagId)) {
      newTagIds = currentTagIds.filter((id) => id !== tagId);
    } else {
      newTagIds = [...currentTagIds, tagId];
    }
    onUpdate(note._id, { tags: newTagIds as any });
  };

  return (
    <div className="flex items-center gap-1 p-1 bg-background/80 backdrop-blur-md border border-border/40 rounded-full shadow-lg shadow-black/5 ring-1 ring-black/5 animate-in fade-in zoom-in duration-300">
      <div ref={ref} className="relative flex items-center gap-0.5 px-1">
        <ToolbarBtn
          title="Color"
          onClick={() => setActiveModal((m) => (m === "color" ? null : "color"))}
        >
          <Palette size={15} />
        </ToolbarBtn>
        <div className="w-px h-4 bg-border/40 mx-0.5" />
        <ToolbarBtn
          title="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          disabled={!editor}
          active={editor?.isActive("bold")}
        >
          <Bold size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          disabled={!editor}
          active={editor?.isActive("italic")}
        >
          <Italic size={15} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Task list"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
          disabled={!editor}
          active={editor?.isActive("taskList")}
        >
          <ListTodo size={15} />
        </ToolbarBtn>
        <div className="w-px h-4 bg-border/40 mx-0.5" />
        <TagPicker
          selectedTagIds={(note.tags || []).map((t) => t._id)}
          onToggleTag={handleToggleTag}
        />
        {isColorOpen && (
          <ColorModal note={note} onUpdate={onUpdate} onClose={closeModal} isToolbar />
        )}
      </div>

      <div className="w-px h-4 bg-border/40" />

      <ToolbarBtn
        title="Delete"
        onClick={() => setActiveModal("delete")}
        danger
      >
        <Trash2 size={15} />
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
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 disabled:opacity-30",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60",
        danger && "hover:text-destructive hover:bg-destructive/10"
      )}
    >
      {children}
    </button>
  );
}
