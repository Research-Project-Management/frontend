import type { Note } from "~/types/sticky";
import { Palette, Bold, Italic, ListTodo, Trash2 } from "lucide-react";
import React from "react";
import type { Editor } from "@tiptap/react";
import { cn } from "~/lib/utils";
import ColorModal from "../section/ColorModal";
import DeleteModal from "../section/deleteModal";
import LabelPicker from "./LabelPicker";
import { ToolbarBtn } from "./ToolbarBtn";

interface StickyToolbarProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  editor: Editor | null;
  activeModal: string | null;
  onActiveModalChange: (modal: any) => void;
}

export default function StickyToolbar({
  note,
  onUpdate,
  onDelete,
  editor,
  activeModal,
  onActiveModalChange,
}: StickyToolbarProps) {
  const [, setRenderTick] = React.useState(0);

  React.useEffect(() => {
    if (!editor) return;

    const update = () => setRenderTick((t) => t + 1);
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);

    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  const isColorOpen = activeModal === "color";
  const isDeleteOpen = activeModal === "delete";

  const handleToggleLabel = (labelId: string) => {
    const currentLabelIds = (note.labels || []).map((l) => (typeof l === 'string' ? l : l._id));

    let newLabelIds;
    if (currentLabelIds.includes(labelId)) {
      newLabelIds = currentLabelIds.filter((id) => id !== labelId);
    } else {
      newLabelIds = [...currentLabelIds, labelId];
    }

    onUpdate(note._id, { labels: newLabelIds as any });
  };

  return (
    <div className="h-10 px-4 flex items-center justify-between border-t border-black/5 rounded-b">
      <div className="relative flex items-center gap-1.5">
        <ColorModal 
          note={note} 
          onUpdate={onUpdate} 
          isActive={isColorOpen}
          onActiveChange={(open) => onActiveModalChange(open ? "color" : null)}
        />
        <ToolbarBtn
          title="Bold"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          isActive={editor?.isActive("bold")}
          disabled={!editor}
        >
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Italic"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          isActive={editor?.isActive("italic")}
          disabled={!editor}
        >
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          title="Task list"
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
          isActive={editor?.isActive("taskList")}
          disabled={!editor}
        >
          <ListTodo size={14} />
        </ToolbarBtn>
        <LabelPicker
          selectedLabelIds={(note.labels || []).map((l) => (typeof l === 'string' ? l : l._id))}
          onToggleLabel={handleToggleLabel}
        />
      </div>

      <ToolbarBtn
        title="Delete"
        onClick={() => onActiveModalChange("delete")}
        danger
      >
        <Trash2 size={14} />
      </ToolbarBtn>

      <DeleteModal
        open={isDeleteOpen}
        onCancel={() => onActiveModalChange(null)}
        onConfirm={() => {
          onDelete(note._id);
          onActiveModalChange(null);
        }}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
      />
    </div>
  );
}
