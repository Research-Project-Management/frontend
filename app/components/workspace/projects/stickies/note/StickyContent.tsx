import "../css/tiptap.css";
import type { Note } from "../types/note.type";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { useEffect, useRef, memo } from "react";

const TaskKeyboardBehavior = Extension.create({
  name: "taskKeyboardBehavior",
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;
        if (!editor.isActive("taskItem")) return false;

        // tạo task mới (Plane/Notion style)
        return editor.commands.splitListItem("taskItem");
      },

      Backspace: () => {
        const { editor } = this;
        if (!editor.isActive("taskItem")) return false;

        const { state } = editor;
        const { $from } = state.selection;

        // chỉ xử lý khi cursor ở đầu block
        if ($from.parentOffset !== 0) return false;

        // nếu task rỗng -> thoát về paragraph
        const isEmpty =
          $from.parent.content.size === 0 ||
          $from.parent.textContent.trim().length === 0;

        if (!isEmpty) return false;

        // convert về paragraph (fallback nếu clearNodes không có)
        return (
          editor.chain().focus().clearNodes().run() ||
          editor.chain().focus().setNode("paragraph").run()
        );
      },
    };
  },
});

interface StickyContentProps {
  note: Note;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onReady?: (editor: Editor | null) => void;
}

export default memo(function StickyContent({
  note,
  onUpdate,
  onReady,
}: StickyContentProps) {
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
      TaskKeyboardBehavior,
      Placeholder.configure({
        placeholder: "Click to type here",
        emptyNodeClass: "is-editor-empty",
      }),
    ],
    content: note.content || "",
    onUpdate: ({ editor }) => {
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);

      updateTimerRef.current = setTimeout(() => {
        onUpdate(note._id, { content: editor.getHTML() });
      }, 1000);
    },
    editorProps: {
      attributes: {
        class: "h-full outline-none",
      },
    },
  });

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return; // Don't overwrite while user is typing
    const next = note.content || "";
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, false);
    }
  }, [note.content, editor]);

  return (
    <div className="flex-1 px-4 py-3 overflow-hidden">
      <EditorContent
        editor={editor}
        className="h-full w-full bg-transparent text-lg leading-relaxed
                   [&_.ProseMirror]:h-full
                   [&_.ProseMirror]:bg-transparent
                   [&_.ProseMirror]:outline-none"
      />
    </div>
  );
});
