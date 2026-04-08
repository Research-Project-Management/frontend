import React, { createContext, useContext, useRef, useEffect } from "react";
import { useParams } from "react-router";
import { usePage } from "~/query/page";
import { Skeleton } from "~/components/ui/skeleton";
import Editor from "./Editor";
import TabBar from "./TabBar";
import type { editor } from "monaco-editor";
import { usePageContext } from "../PageContext";
import type { Page } from "~/types/page";
import { useSocketRoom } from "~/hooks/useSocketRoom";
import { useEditorTabsStore } from "~/stores/editor-tabs";

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
  const { getEditorContent, setCurrentPage, editorRef } = usePageContext();
  const { openTab, updateTabTitle } = useEditorTabsStore();

  // Join the Socket.IO page room so presence updates and content broadcasts are received.
  useSocketRoom("page", pageId);

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

  // ── Register this file as an open tab ──────────────────────────────────
  useEffect(() => {
    if (!page) return;

    const projectId =
      page.project && typeof page.project === "object"
        ? (page.project as any)._id
        : (page.project as string | null | undefined) ?? null;

    if (!projectId) return;

    openTab(projectId, { id: page._id, title: page.title });
  }, [page?._id, page?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive projectId for TabBar ────────────────────────────────────────
  const projectId =
    page?.project && typeof page.project === "object"
      ? (page.project as any)._id
      : typeof page?.project === "string"
        ? page.project
        : null;

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col animate-in fade-in duration-300">
        {/* Toolbar skeleton */}
        <div className="h-10 border-b border-border flex items-center gap-2 px-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-16" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-6 rounded" />
          <Skeleton className="h-6 w-6 rounded" />
        </div>
        {/* TabBar skeleton */}
        <div className="h-8 border-b border-border bg-muted/20 flex items-center gap-px px-1">
          {[90, 110, 75].map((w, i) => (
            <Skeleton key={i} className="h-5 rounded" style={{ width: w }} />
          ))}
        </div>
        {/* Code lines skeleton */}
        <div className="flex-1 bg-[var(--editor-bg,hsl(var(--background)))] p-4 space-y-2">
          {Array.from({ length: 24 }).map((_, i) => {
            const widths = ["60%", "45%", "75%", "30%", "55%", "80%", "40%", "65%", "20%", "70%", "50%", "35%"];
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-8 text-right">
                  <Skeleton className="h-3.5 w-5 ml-auto" />
                </span>
                <Skeleton
                  className="h-3.5 rounded-sm"
                  style={{ width: widths[i % widths.length] }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
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
        {/* Tab bar — shown when project has multiple open files */}
        {projectId && <TabBar projectId={projectId} />}
        <Editor page={page} />
      </div>
    </EditorContext.Provider>
  );
}
