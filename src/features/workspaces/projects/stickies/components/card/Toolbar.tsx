'use client';

import type { Sticky } from "@/features/workspaces/projects/stickies/types/sticky.types";
import { Palette, Bold, Italic, ListTodo, Trash2 } from "lucide-react";
import React from "react";
import type { Editor } from "@tiptap/react";
import { ToolbarBtn } from "../ui/ToolbarBtn";
import ColorModal from "../modals/ColorModal";
import DeleteModal from "../modals/DeleteModal";

interface ToolbarProps {
  sticky: Sticky;
  onUpdate: (id: string, updates: Partial<Sticky>) => void;
  onDelete: (id: string) => void;
  editor: Editor | null;
  activeModal: string | null;
  onActiveModalChange: (modal: any) => void;
}

export default function Toolbar({
  sticky,
  onUpdate,
  onDelete,
  editor,
  activeModal,
  onActiveModalChange,
}: ToolbarProps) {
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

  return (
    <div className="h-10 px-4 flex items-center justify-between bg-black/5 dark:bg-white/10 border-t border-black/5 dark:border-white/10 rounded-b-lg">
      <div className="relative flex items-center gap-1.5">
        <ColorModal 
          sticky={sticky} 
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
      </div>

      <ToolbarBtn
        title="Delete"
        danger
        onClick={() => onActiveModalChange(isDeleteOpen ? null : "delete")}
        isActive={isDeleteOpen}
      >
        <Trash2 size={14} />
      </ToolbarBtn>

      <DeleteModal
        open={isDeleteOpen}
        onCancel={() => onActiveModalChange(null)}
        onConfirm={() => {
          onActiveModalChange(null);
          onDelete(sticky._id || sticky.id || '');
        }}
      />
    </div>
  );
}
