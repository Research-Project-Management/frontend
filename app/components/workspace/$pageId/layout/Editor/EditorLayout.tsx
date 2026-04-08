import React, { createContext, useContext, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router";
import { usePage, useSyncProjectToCompiler } from "~/query/page";
import { Skeleton } from "~/components/ui/skeleton";
import Editor from "./Editor";
import TabBar from "./TabBar";
import type { editor } from "monaco-editor";
import { usePageContext } from "../PageContext";
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
  // pageId from URL = project root page (stable — never changes when switching files)
  const { pageId } = useParams<{ pageId: string }>();
  // fileId from ?file=... = the child file currently being edited
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get("file");

  // Always fetch the root page (needed for project metadata & tab bar)
  const { data: parentPage, isLoading: parentLoading } = usePage(pageId!);

  // When a child file is selected, fetch it separately
  const { data: childPage, isLoading: childLoading } = usePage(fileId ?? "");

  // The page shown in the Monaco editor: child file if selected, else project root
  const activePage = childPage ?? parentPage;
  const isLoading = parentLoading || (fileId ? childLoading : false);

  const { getEditorContent, setCurrentPage, editorRef } = usePageContext();
  const { openTab } = useEditorTabsStore();
  const syncProjectMutation = useSyncProjectToCompiler();
  // Track whether we've already synced this session for this root page
  const syncedPageRef = useRef<string | null>(null);

  // Join the project-root socket room ONLY — stable across tab switches.
  // Joining per-child-file would cause leave/rejoin on every file switch.
  useSocketRoom("page", pageId);

  // Register a stable content-getter so the Viewer can read the editor text at compile time.
  useEffect(() => {
    getEditorContent.current = () => editorRef.current?.getValue() ?? "";
    return () => {
      getEditorContent.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // On first load of a root page: sync all .tex files to the compiler so that
  // compile works even after a compiler restart (without requiring a manual save).
  useEffect(() => {
    if (!pageId || syncedPageRef.current === pageId) return;
    syncedPageRef.current = pageId;
    syncProjectMutation.mutate({ pageId });
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps


  // Sync the active page into shared context so sidebar/toolbar can access it.
  // currentPage = the file being edited (child or root); used for presence, title, etc.
  useEffect(() => {
    if (activePage) setCurrentPage(activePage);
    return () => setCurrentPage(null);
  }, [activePage?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register the active file as an open tab whenever it changes
  useEffect(() => {
    if (!activePage) return;

    const projectId =
      activePage.project && typeof activePage.project === "object"
        ? (activePage.project as any)._id
        : (activePage.project as string | null | undefined) ?? null;

    if (!projectId) return;

    openTab(projectId, { id: activePage._id, title: activePage.title });
  }, [activePage?._id, activePage?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive projectId for TabBar (prefer parent page to avoid stale from child)
  const projectId =
    parentPage?.project && typeof parentPage.project === "object"
      ? (parentPage.project as any)._id
      : typeof parentPage?.project === "string"
        ? parentPage.project
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

  if (!activePage) {
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
        {projectId && <TabBar projectId={projectId} activeFileId={fileId ?? activePage._id} />}
        <Editor page={activePage} />
      </div>
    </EditorContext.Provider>
  );
}
