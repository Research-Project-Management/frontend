import "../css/tiptap.css";
import type { Note } from "../types/note.type";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { useEffect, useRef, useState, useCallback, memo } from "react";

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
  isOverlay?: boolean;
}

export default memo(function StickyContent({
  note,
  onUpdate,
  onReady,
  isOverlay,
}: StickyContentProps) {
  const [activated, setActivated] = useState(false);

  const handleActivate = useCallback(() => {
    if (!activated) setActivated(true);
  }, [activated]);

  // Use raw HTML preview when it's just viewing/dragging to save ~100ms per note.
  // We wrap it in ProseMirror class so it looks 100% identical to the real TipTap!
  if (!activated || isOverlay) {
    const rawHtml = note.content && note.content !== "<p></p>" 
      ? note.content 
      : '<p class="is-editor-empty" data-placeholder="Click to type here"><br class="ProseMirror-trailingBreak"></p>';

    return (
      <div
        className="flex-1 px-4 py-3 overflow-hidden overflow-y-auto cursor-text flex flex-col"
        onClick={isOverlay ? undefined : handleActivate}
        onFocus={isOverlay ? undefined : handleActivate}
      >
        <div className="flex-1 w-full bg-transparent text-lg leading-relaxed outline-none min-h-[24px]
                        [&_.ProseMirror]:min-h-full [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:outline-none">
           <div 
             className="ProseMirror" 
             dangerouslySetInnerHTML={{ __html: rawHtml }} 
           />
        </div>
      </div>
    );
  }

  // Once activated by click, mount the actual heavy TipTap editor
  return <ActiveEditor note={note} onUpdate={onUpdate} onReady={onReady} />;
});

const ActiveEditor = memo(function ActiveEditor({
  note,
  onUpdate,
  onReady,
}: StickyContentProps) {
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stable refs to prevent unneeded re-renders on socket updates
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const noteIdRef = useRef(note._id);
  noteIdRef.current = note._id;

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
    autofocus: "end",
    onUpdate: ({ editor }) => {
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);

      updateTimerRef.current = setTimeout(() => {
        onUpdateRef.current(noteIdRef.current, { 
          content: editor.getHTML() 
        });
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

  // Sync server content to editor
  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return; 
    const next = note.content || "";
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [note.content, editor]);

  return (
    <div className="flex-1 px-4 py-3 overflow-hidden overflow-y-auto">
      <EditorContent
        editor={editor}
        className="h-full max-h-125 w-full bg-transparent text-lg leading-relaxed
                   [&_.ProseMirror]:h-full
                   [&_.ProseMirror]:bg-transparent
                   [&_.ProseMirror]:outline-none"
      />
    </div>
  );
});
