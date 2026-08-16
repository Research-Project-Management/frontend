import { useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { pageDetailQueryOptions } from './use-page';
import { useQuery } from '@tanstack/react-query';
import { usePageContext } from "@/features/editor/store/page-context";
import { useEditorTabsStore } from "@/features/editor/store/editor-tabs.store";
import { useEditorSettingsStore } from "@/features/editor/store/editor-settings.store";

export function useLayout() {
  const router = useRouter();
  // pageId from URL = project root page (stable —  never changes when switching files)
  const { workspaceId, projectId, pageId } = useParams<{ workspaceId?: string; projectId?: string; pageId: string }>();
  
  // fileId from ?file=... = the child file currently being edited
  const searchParams = useSearchParams();
  const fileId = searchParams.get("file");

  // Redirect AI panel events to the AI tab in the sidebar.
  useEffect(() => {
    const openAiTab = () => {
      document.dispatchEvent(
        new CustomEvent("flux:open-panel", { detail: "AI" })
      );
    };
    document.addEventListener("flux:toggle-ai-panel", openAiTab);
    document.addEventListener("flux:open-ai-panel", openAiTab);
    return () => {
      document.removeEventListener("flux:toggle-ai-panel", openAiTab);
      document.removeEventListener("flux:open-ai-panel", openAiTab);
    };
  }, []);

  // Always fetch the root page (needed for project metadata & tab bar)
  const { data: parentPage, isLoading: parentLoading } = useQuery({
    ...pageDetailQueryOptions(pageId!),
    enabled: !!pageId,
  });

  // When a child file is selected, fetch it separately
  const { data: childPage, isLoading: childLoading } = useQuery({
    ...pageDetailQueryOptions(fileId ?? ""),
    enabled: !!fileId,
  });

  // The page shown in the Monaco editor: child file if selected, else project root
  const activePage = childPage ?? parentPage;
  const isLoading = parentLoading || (fileId ? childLoading : false);

  const { getEditorContent, setCurrentPage, setWorkspaceId, editorRef, selectedAsset, setSelectedAsset, compileRef, setActiveFilePage } = usePageContext();
  const { autoCompile } = useEditorSettingsStore();

  // True when the current ?file= param points to an image asset (not a page).
  const isAssetTab = !!fileId && !!selectedAsset && selectedAsset._id === fileId;

  // True when a real child file is being viewed now.
  const hasChildFile = !!activePage && activePage._id !== pageId;

  // The page to render: only when a child file is active. When no tab is open,
  // displayPage is null and EditorLayout shows the EmptyEditorState.
  const displayPage = hasChildFile ? activePage : null;

  const editorTitle = parentPage
    ? displayPage
      ? `${displayPage.title} - ${parentPage.title}`
      : parentPage.title
    : "";

  // Inline document title update (was use-document-title.ts)
  useEffect(() => {
    if (typeof document !== 'undefined' && editorTitle) {
      document.title = editorTitle;
    }
  }, [editorTitle]);

  const { openTab, closeAllForProject, getTabs } = useEditorTabsStore();
  const tabs = pageId ? getTabs(pageId) : [];

  // Restore selectedAsset if the active fileId is an asset tab (image)
  useEffect(() => {
    if (fileId && (!selectedAsset || selectedAsset._id !== fileId)) {
      const tab = tabs.find((t) => t.id === fileId);
      if (tab && tab.fileUrl) {
        setSelectedAsset({
          _id: tab.id,
          filename: tab.title,
          url: tab.fileUrl,
        });
      }
    }
  }, [fileId, selectedAsset, tabs, setSelectedAsset]);

  // Track whether we've already fired the initial auto-compile for this root page
  const autoCompileFiredRef = useRef<string | null>(null);
  // Track previous pageId so we can clean up its tabs when navigating away
  const prevPageIdRef = useRef<string | null>(null);

  // Validate and redirect if pageId is a child page, or to upgrade to scoped URL
  useEffect(() => {
    const validateAndRedirect = async () => {
      if (!pageId || !parentPage || parentLoading) return;

      const proj = parentPage.projectId;
      const projId = proj && typeof proj === "object" ? proj._id : null;
      const ws = proj && typeof proj === "object" ? proj.workspaceId : null;
      const wsUrl = ws && typeof ws === "object" ? ws.url : null;

      if (parentPage.parentPage) {
        console.log(`[Editor] ${pageId} is a child page, redirecting to root ${parentPage.parentPage}`);
        let redirectUrl = `/editor/${parentPage.parentPage}?file=${pageId}`;
        const currentWorkspaceId = workspaceId || wsUrl;
        const currentProjectId = projectId || projId;
        if (currentWorkspaceId && currentProjectId) {
          redirectUrl = `/${currentWorkspaceId}/projects/${currentProjectId}/pages/${parentPage.parentPage}?file=${pageId}`;
        } else if (currentWorkspaceId) {
          redirectUrl = `/${currentWorkspaceId}/pages/${parentPage.parentPage}?file=${pageId}`;
        }
        router.replace(redirectUrl);
        return;
      }

      if (!workspaceId && !projectId && wsUrl && projId) {
        const fileParam = fileId ? `?file=${fileId}` : "";
        router.replace(`/${wsUrl}/projects/${projId}/pages/${pageId}${fileParam}`);
        return;
      }
    };

    validateAndRedirect();
  }, [pageId, parentPage, parentPage?.parentPage, parentPage?.title, parentPage?.mainFile, parentPage?.projectId, parentLoading, workspaceId, projectId, fileId, router]);

  // Clear tabs when navigating to a different root page
  useEffect(() => {
    if (prevPageIdRef.current && prevPageIdRef.current !== pageId) {
      closeAllForProject(prevPageIdRef.current);
    }
    prevPageIdRef.current = pageId ?? null;
  }, [pageId, closeAllForProject]);

  // Register a stable content-getter so the Viewer can read the editor text at compile time.
  useEffect(() => {
    getEditorContent.current = () => editorRef.current?.getValue() ?? "";
    return () => {
      getEditorContent.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  // Auto-compile on first open when autoCompile is enabled.
  useEffect(() => {
    if (!autoCompile) return;
    if (!pageId || autoCompileFiredRef.current === pageId) return;
    if (!activePage || !activePage._id) return;
    autoCompileFiredRef.current = pageId;
    const timer = setTimeout(() => {
      compileRef.current?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [pageId, activePage?._id, autoCompile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the ROOT page into shared context so sidebar/toolbar can access project metadata.
  useEffect(() => {
    if (parentPage) {
      setCurrentPage(parentPage);
      const proj = parentPage.projectId;
      if (typeof proj === "object") {
        const ws = (proj as any).workspaceId;
        const wid = typeof ws === "object" ? ws?._id : typeof ws === "string" ? ws : null;
        if (wid) setWorkspaceId(wid);
      }
    }
    return () => { setCurrentPage(''); setWorkspaceId(''); };
  }, [parentPage?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register the active file as an open tab whenever it changes.
  useEffect(() => {
    if (!activePage || !pageId) return;
    if (activePage._id === pageId) return; // root page is not a tab
    openTab(pageId, { id: activePage._id, title: activePage.title });
    setActiveFilePage(activePage);
  }, [activePage?._id, activePage?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isLoading,
    activePage,
    isAssetTab,
    displayPage,
    pageId,
    fileId,
    selectedAsset,
    editorRef
  };
}
