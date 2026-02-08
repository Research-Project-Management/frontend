import React, { createContext, useContext, useRef } from "react";
import { useParams } from "react-router";
import { usePage } from "~/query/page";
import Loading from "~/components/ui/Loading";
import ToolBar from "./ToolBar";
import Editor from "./Editor";
import type { editor } from "monaco-editor";

interface EditorContextType {
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
}

const EditorContext = createContext<EditorContextType | null>(null);

export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within EditorLayout");
  }
  return context;
};

export default function EditorLayout() {
  const { pageId } = useParams<{ pageId: string }>();
  const { data: page, isLoading } = usePage(pageId!);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  if (isLoading) {
    return <Loading />;
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Page not found</p>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={{ editorRef }}>
      <div className="h-full w-full overflow-hidden flex flex-col">
        <ToolBar page={page} />
        <Editor page={page} />
      </div>
    </EditorContext.Provider>
  );
}
