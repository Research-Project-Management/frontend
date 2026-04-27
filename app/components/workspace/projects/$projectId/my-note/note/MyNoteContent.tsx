import "../css/tiptap.css";
import type { Note } from "../types/note.type";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Extension } from "@tiptap/core";
import { useEffect, useRef, useState, useCallback, memo } from "react";
import { cn } from "~/lib/utils";

const TaskKeyboardBehavior = Extension.create({
  name: "taskKeyboardBehavior",
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;
        if (!editor.isActive("taskItem")) return false;
        return editor.commands.splitListItem("taskItem");
      },
      Backspace: () => {
        const { editor } = this;
        if (!editor.isActive("taskItem")) return false;
        const { state } = editor;
        const { $from } = state.selection;
        if ($from.parentOffset !== 0) return false;
        const isEmpty =
          $from.parent.content.size === 0 ||
          $from.parent.textContent.trim().length === 0;
        if (!isEmpty) return false;
        return (
          editor.chain().focus().clearNodes().run() ||
          editor.chain().focus().setNode("paragraph").run()
        );
      },
    };
  },
});

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
  const [activated, setActivated] = useState(false);

  const handleActivate = useCallback(() => {
    if (!activated) setActivated(true);
  }, [activated]);

  if (activated || isOverlay) {
    return (
      <div className="flex-1 px-4 py-3 overflow-hidden overflow-y-auto cursor-text flex flex-col">
        <ActiveEditor 
          note={note} 
          onUpdate={onUpdate} 
          onReady={onReady} 
          isOverlay={isOverlay}
          onActivate={handleActivate}
        />
      </div>
    );
  }

  const rawHtml = note.content && note.content !== "<p></p>" 
    ? note.content 
    : '<p class="is-editor-empty" data-placeholder="Click to type here"><br class="ProseMirror-trailingBreak"></p>';

  return (
    <div
      className="flex-1 px-4 py-3 overflow-hidden overflow-y-auto cursor-text flex flex-col"
      onClick={handleActivate}
      onFocus={handleActivate}
    >
      <div className="flex-1 w-full bg-transparent text-base leading-relaxed outline-none min-h-[24px]
                      [&_.ProseMirror]:min-h-full [&_.ProseMirror]:bg-transparent [&_.ProseMirror]:outline-none">
         <div 
           className="ProseMirror" 
           dangerouslySetInnerHTML={{ __html: rawHtml }} 
         />
      </div>
    </div>
  );
});

const ActiveEditor = memo(function ActiveEditor({
  note,
  onUpdate,
  onReady,
  isOverlay,
  onActivate
}: MyNoteContentProps & { onActivate: () => void }) {
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
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
        placeholder: "Write something brilliant...",
        emptyNodeClass: "is-editor-empty",
      }),
    ],
    content: note.content || "",
    autofocus: "end",
    editable: !isOverlay,
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
        class: "outline-none h-full text-base leading-relaxed transition-all duration-200",
      },
    },
  });

  useEffect(() => {
    onReady?.(editor);
    return () => onReady?.(null);
  }, [editor, onReady]);

  useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return; 
    const next = note.content || "";
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [note.content, editor]);

  return (
    <div className="h-full" onClick={onActivate}>
      <EditorContent
        editor={editor}
        className="h-full w-full bg-transparent max-h-125"
      />
    </div>
  );
});

export default MyNoteContent;
