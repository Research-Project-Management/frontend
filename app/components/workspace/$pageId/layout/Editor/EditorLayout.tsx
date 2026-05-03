import React, { createContext, useContext, useRef, useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router";
import { usePage } from "~/query/page";
import type { Page } from "~/types/page";
import { Skeleton } from "~/components/ui/skeleton";
import Editor from "./Editor";
import TabBar from "./TabBar";
import type { editor } from "monaco-editor";
import { usePageContext, type AssetInfo } from "../PageContext";
import { useSocketRoom } from "~/hooks/useSocketRoom";
import { useEditorTabsStore } from "~/stores/editor-tabs";
import { useEditorSettingsStore } from "~/stores/editor-settings";
import { FileImage, AlertCircle, FileCode2 } from "lucide-react";
import AIChatPanel from "./AIChatPanel";

// ── Inline image viewer rendered inside the editor column ──────────────────

function ImagePanel({ asset }: { asset: AssetInfo }) {
  const ext = asset.filename.split(".").pop()?.toUpperCase() ?? "";
  const sizeLabel = asset.size
    ? asset.size < 1024
      ? `${asset.size} B`
      : asset.size < 1024 * 1024
        ? `${(asset.size / 1024).toFixed(1)} KB`
        : `${(asset.size / (1024 * 1024)).toFixed(1)} MB`
    : null;

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Info bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0">
        <FileImage className="size-3.5" />
        <span className="font-medium text-foreground truncate">{asset.filename}</span>
        {ext && (
          <span className="px-1.5 py-0.5 rounded bg-secondary font-mono">{ext}</span>
        )}
        {sizeLabel && <span>{sizeLabel}</span>}
      </div>
      {/* Image viewer */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto">
        {asset.url ? (
          <img
            src={asset.url}
            alt={asset.filename}
            crossOrigin="use-credentials"
            className="max-w-full max-h-full object-contain rounded shadow-sm"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertCircle className="size-6" />
            <span className="text-sm">Image URL not available.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state when no file is open ───────────────────────────────────────

function EmptyEditorState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
      <FileCode2 className="size-10 text-muted-foreground/20" />
      <p className="text-sm text-muted-foreground">No file open</p>
      <p className="text-xs text-muted-foreground/60">
        Open a file from the Explorer to start editing.
      </p>
    </div>
  );
}

// ── Editor layout ─────────────────────────────────────────────────────────────

interface EditorContextType {
  editorRef: React.MutableRefObject<editor.IStandaloneCodeEditor | null>;
  /** Toggle the AI chat panel open/closed */
  toggleAIPanel: () => void;
  aiPanelOpen: boolean;
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
  const navigate = useNavigate();
  // pageId from URL = project root page (stable — never changes when switching files)
  const { pageId } = useParams<{ pageId: string }>();
  // fileId from ?file=... = the child file currently being edited
  const [searchParams] = useSearchParams();
  const fileId = searchParams.get("file");

  // AI Chat Panel state
  const [aiPanelOpen, setAIPanelOpen] = useState(false);
  const toggleAIPanel = () => setAIPanelOpen((v) => !v);

  // Listen to the Ctrl+Alt+A shortcut dispatched by Monaco
  useEffect(() => {
    const handler = () => setAIPanelOpen((v) => !v);
    document.addEventListener("flux:toggle-ai-panel", handler);
    return () => document.removeEventListener("flux:toggle-ai-panel", handler);
  }, []);


  // Always fetch the root page (needed for project metadata & tab bar)
  const { data: parentPage, isLoading: parentLoading } = usePage(pageId!);

  // When a child file is selected, fetch it separately
  const { data: childPage, isLoading: childLoading } = usePage(fileId ?? "");

  // The page shown in the Monaco editor: child file if selected, else project root
  const activePage = childPage ?? parentPage;
  const isLoading = parentLoading || (fileId ? childLoading : false);

  const { getEditorContent, setCurrentPage, editorRef, selectedAsset, compileRef } = usePageContext();
  const { autoCompile } = useEditorSettingsStore();

  // True when the current ?file= param points to an image asset (not a page).
  const isAssetTab = !!fileId && !!selectedAsset && selectedAsset._id === fileId;

  // True when a real child file is being viewed now.
  const hasChildFile = !!activePage && activePage._id !== pageId;

  // The page to render: only when a child file is active. When no tab is open,
  // displayPage is null and EditorLayout shows the EmptyEditorState.
  const displayPage = hasChildFile ? activePage : null;

  const { openTab, closeAllForProject } = useEditorTabsStore();
  // Track whether we've already fired the initial auto-compile for this root page
  const autoCompileFiredRef = useRef<string | null>(null);
  // Track previous pageId so we can clean up its tabs when navigating away
  const prevPageIdRef = useRef<string | null>(null);

  // Validate and redirect if pageId is a child page
  useEffect(() => {
    const validateAndRedirect = async () => {
      if (!pageId || !parentPage || parentLoading) return;

      if (parentPage.parentPage) {
        console.log(`[Editor] ${pageId} is a child page, redirecting to root ${parentPage.parentPage}`);
        navigate(`/editor/${parentPage.parentPage}?file=${pageId}`, { replace: true });
        return;
      }

      // Log current page info for debugging
      console.log(`[Editor] Loading root page: ${pageId}`, {
        pageId,
        title: parentPage.title,
        hasMainFile: !!parentPage.mainFile,
        projectId: typeof parentPage.project === "object" ? (parentPage.project as any)._id : parentPage.project,
      });
    };

    validateAndRedirect();
  }, [pageId, parentPage, parentPage?.parentPage, parentPage?.title, parentPage?.mainFile, parentPage?.project, parentLoading, navigate]);

  // Clear tabs when navigating to a different root page
  useEffect(() => {
    if (prevPageIdRef.current && prevPageIdRef.current !== pageId) {
      closeAllForProject(prevPageIdRef.current);
    }
    prevPageIdRef.current = pageId ?? null;
  }, [pageId, closeAllForProject]);

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


  // Auto-compile on first open when autoCompile is enabled.
  // Fires once per root page visit, after sync completes (small delay).
  useEffect(() => {
    if (!autoCompile) return;
    if (!pageId || autoCompileFiredRef.current === pageId) return;
    if (!activePage || !activePage._id) return;
    autoCompileFiredRef.current = pageId;
    // Small delay to let the sync complete and the editor mount
    const timer = setTimeout(() => {
      compileRef.current?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [pageId, activePage?._id, autoCompile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the ROOT page into shared context so sidebar/toolbar can access project metadata.
  // We intentionally use parentPage (root), NOT activePage (child file), because:
  //  • parentPage is stable — it doesn't change when the user switches tabs
  //  • ToolBar reads currentPage.project.name → needs root page (project is populated there)
  //  • PresenceAvatars calls usePagePresence(currentPage._id) → must match the socket
  //    room joined above (useSocketRoom("page", pageId) = root page ID)
  useEffect(() => {
    if (parentPage) setCurrentPage(parentPage);
    return () => setCurrentPage(null);
  }, [parentPage?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register the active file as an open tab whenever it changes.
  // Key is the root pageId from the URL — each LaTeX page-project is isolated.
  // IMPORTANT: skip the root page itself (it's a container, not an editable file).
  useEffect(() => {
    if (!activePage || !pageId) return;
    if (activePage._id === pageId) return; // root page is not a tab
    openTab(pageId, { id: activePage._id, title: activePage.title });
  }, [activePage?._id, activePage?.title]); // eslint-disable-line react-hooks/exhaustive-deps


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
    <EditorContext.Provider value={{ editorRef, toggleAIPanel, aiPanelOpen }}>
      <div className="h-full w-full overflow-hidden flex flex-col">
        {/* Tab bar — keyed by rootPageId so each LaTeX page-project is isolated */}
        {pageId && <TabBar rootPageId={pageId} activeFileId={fileId ?? activePage?._id ?? ""} />}
        <div className="flex-1 overflow-hidden flex">
          {/* Editor / Asset panel */}
          <div className="flex-1 overflow-hidden">
            {isAssetTab ? (
              <ImagePanel asset={selectedAsset!} />
            ) : displayPage ? (
              <Editor page={displayPage} />
            ) : (
              <EmptyEditorState />
            )}
          </div>

          {/* AI Chat Panel — collapsible right sidebar */}
          {aiPanelOpen && (
            <>
              <div className="w-px bg-border shrink-0" />
              <div className="w-[360px] shrink-0 overflow-hidden">
                <AIChatPanel
                  editorRef={editorRef}
                  filename={displayPage?.title ?? "main.tex"}
                  onClose={() => setAIPanelOpen(false)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </EditorContext.Provider>
  );
}
