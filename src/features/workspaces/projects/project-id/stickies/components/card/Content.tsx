'use client';

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { useEffect, useRef, memo } from "react";
import type { Sticky } from "@/features/workspaces/projects/project-id/stickies/types/sticky.types";
import type { Editor } from "@tiptap/react";
import "../ui/tiptap.css";

interface ContentProps {
  sticky: Sticky;
  onUpdate: (id: string, updates: Partial<Sticky>) => void;
  onReady?: (editor: Editor | null) => void;
  isOverlay?: boolean;
}

export default memo(function Content({
  sticky,
  onUpdate,
  onReady,
  isOverlay,
}: ContentProps) {
  const contentRef = useRef(sticky.content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder: "Write something...",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: sticky.content || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-li:my-0 max-w-none focus:outline-none min-h-[200px] max-h-[360px] overflow-y-auto overflow-x-hidden px-5 py-4",
        "aria-label": "Sticky content",
      },
    },
    onUpdate: ({ editor }) => {
      contentRef.current = editor.getHTML();
    },
    onBlur: () => {
      if (contentRef.current !== sticky.content) {
        onUpdate(sticky._id, { content: contentRef.current });
      }
    },
  });

  useEffect(() => {
    if (onReady && editor) {
      onReady(editor);
    }
  }, [editor, onReady]);

  // Handle external updates
  useEffect(() => {
    if (editor && sticky.content !== contentRef.current && sticky.content !== editor.getHTML()) {
      editor.commands.setContent(sticky.content);
      contentRef.current = sticky.content;
    }
  }, [sticky.content, editor]);

  return <EditorContent editor={editor} className={isOverlay ? "pointer-events-none" : ""} />;
});
