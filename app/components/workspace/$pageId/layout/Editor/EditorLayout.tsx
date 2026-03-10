import React, { createContext, useContext, useRef, useEffect } from "react";
import { useParams } from "react-router";
import { usePage } from "~/query/page";
import Loading from "~/components/ui/Loading";
import ToolBar from "./ToolBar";
import Editor from "./Editor";
import type { editor } from "monaco-editor";
import { usePageContext } from "../PageContext";
import type { Page } from "~/types/page";

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
  // Use the shared editorRef from PageContext so SearchTab and others can access it.
  const { getEditorContent, setCurrentPage, editorRef } = usePageContext();

  // Register a stable content-getter so the Viewer can read the editor text at compile time.
  useEffect(() => {
    getEditorContent.current = () => editorRef.current?.getValue() ?? "";
    return () => {
      getEditorContent.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the loaded page into shared context so sidebar/toolbar can access it.
  useEffect(() => {
    if (page) setCurrentPage(page);
    return () => setCurrentPage(null);
  }, [page?._id]); // eslint-disable-line react-hooks/exhaustive-deps

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
