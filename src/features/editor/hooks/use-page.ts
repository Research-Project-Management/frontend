'use client';

/**
 * use-page.ts (editor feature)
 *
 * Unified access to page document queries, active editing session,
 * files, versions, and project history.
 */

import { useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient, queryOptions } from "@tanstack/react-query";
import {
  documentService,
  fileService,
  versionService,
  historyService,
} from "../services/document.service";
import { usePageStore } from "../store/page.store";
import { useTabsStore } from "../store/tabs.store";
import { useSettingsStore } from "../store/settings.store";
import { EditorEventBus } from "../utils/editor.util";
import { toast } from "sonner";

// ── 1. Query Keys ────────────────────────────────────────────────────────────

export const pageKeys = {
  all: ["pages"] as const,
  detail: (pageId: string) => ["pages", "detail", pageId] as const,
  files: (pageId: string) => ["pages", "detail", pageId, "files"] as const,
  versions: (pageId: string) => ["pages", "detail", pageId, "versions"] as const,
  history: (projectId: string) => ["pages", "history", projectId] as const,
};

export const editorPageKeys = pageKeys;
export const editorVersionKeys = pageKeys;
export const editorHistoryKeys = pageKeys;

// ── 2. Query Options ─────────────────────────────────────────────────────────

export const pageQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.detail(pageId),
    queryFn: () => documentService.getById(pageId),
  });

export const filesQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.files(pageId),
    queryFn: () => fileService.getByPageId(pageId),
  });

export const versionsQuery = (pageId: string) =>
  queryOptions({
    queryKey: pageKeys.versions(pageId),
    queryFn: () => versionService.getByPageId(pageId),
  });

export const historyQuery = (projectId: string) =>
  queryOptions({
    queryKey: pageKeys.history(projectId),
    queryFn: () => historyService.getByProjectId(projectId),
  });

// Backward-compatible query aliases
export const pageDetailQueryOptions = pageQuery;
export const pageFilesQueryOptions = filesQuery;
export const pageVersionsQueryOptions = versionsQuery;
export const projectHistoryQueryOptions = historyQuery;

// ── 3. Active Document Session Hook ──────────────────────────────────────────

export function useActiveDocument() {
  const router = useRouter();
  const pathname = usePathname();
  const { workspaceId, projectId, pageId } = useParams<{
    workspaceId?: string;
    projectId?: string;
    pageId: string;
  }>();

  const searchParams = useSearchParams();
  const fileId = searchParams.get("file");

  // Redirect AI panel events to the AI tab in the sidebar
  useEffect(() => {
    const openAiTab = () => {
      EditorEventBus.emit("flux:open-panel", "AI");
    };
    const unsub1 = EditorEventBus.on("flux:toggle-ai-panel", openAiTab);
    const unsub2 = EditorEventBus.on("flux:open-ai-panel", openAiTab);
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  // Always fetch the root document
  const { data: parentPage, isLoading: parentLoading } = useQuery({
    ...pageQuery(pageId!),
    enabled: !!pageId,
  });

  // When a child file is selected, fetch it separately
  const { data: childPage, isLoading: childLoading } = useQuery({
    ...pageQuery(fileId ?? ""),
    enabled: !!fileId,
  });

  // The active page shown in editor
  const activePage = childPage ?? parentPage;
  const isLoading = parentLoading || (fileId ? childLoading : false);

  const {
    getEditorContent,
    setCurrentPage,
    setWorkspaceId,
    editorRef,
    selectedAsset,
    setSelectedAsset,
    compileRef,
    setActiveFilePage,
  } = usePageStore();
  const { autoCompile } = useSettingsStore();

  const isAssetTab = !!fileId && !!selectedAsset && selectedAsset.id === fileId;
  const displayPage = activePage ?? null;

  const editorTitle = parentPage
    ? displayPage
      ? `${displayPage.title} - ${parentPage.title}`
      : parentPage.title
    : "";

  useEffect(() => {
    if (typeof document !== "undefined" && editorTitle) {
      document.title = editorTitle;
    }
  }, [editorTitle]);

  const { openTab, closeAllForProject, getTabs } = useTabsStore();
  const tabs = pageId ? getTabs(pageId) : [];

  // Restore selectedAsset if active fileId is an asset tab
  useEffect(() => {
    if (fileId && (!selectedAsset || selectedAsset.id !== fileId)) {
      const tab = tabs.find((t: { id: string; fileUrl?: string; title: string }) => t.id === fileId);
      if (tab && tab.fileUrl) {
        setSelectedAsset({
          id: tab.id,
          filename: tab.title,
          url: tab.fileUrl,
        });
      }
    }
  }, [fileId, selectedAsset, tabs, setSelectedAsset]);

  const autoCompileFiredRef = useRef<string | null>(null);
  const prevPageIdRef = useRef<string | null>(null);

  // Validate and redirect if pageId is a child page or needs scoped URL
  useEffect(() => {
    const validateAndRedirect = async () => {
      if (!pageId || !parentPage || parentLoading) return;

      const proj = parentPage.projectId;
      const projId = proj && typeof proj === "object" ? proj.id : null;
      const ws = proj && typeof proj === "object" ? proj.workspaceId : null;
      const wsUrl = ws && typeof ws === "object" ? ws.url : null;

      if (parentPage.parentPage) {
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

      // If no child file is in the URL, select the mainFile if defined
      if (!fileId && parentPage.mainFile) {
        const mainFileId =
          typeof parentPage.mainFile === "object" && parentPage.mainFile
            ? parentPage.mainFile.id
            : typeof parentPage.mainFile === "string"
              ? parentPage.mainFile
              : null;
        if (mainFileId && mainFileId !== pageId) {
          const params = new URLSearchParams(searchParams.toString());
          params.set("file", mainFileId);
          router.replace(`${pathname}?${params.toString()}`);
        }
      }
    };

    validateAndRedirect();
  }, [
    pageId,
    parentPage,
    parentPage?.parentPage,
    parentPage?.title,
    parentPage?.mainFile,
    parentPage?.projectId,
    parentLoading,
    workspaceId,
    projectId,
    fileId,
    router,
    pathname,
    searchParams,
  ]);

  // Clear tabs when navigating to another root page
  useEffect(() => {
    if (prevPageIdRef.current && prevPageIdRef.current !== pageId) {
      closeAllForProject(prevPageIdRef.current);
    }
    prevPageIdRef.current = pageId ?? null;
  }, [pageId, closeAllForProject]);

  // Register stable content-getter for Viewer
  useEffect(() => {
    getEditorContent.current = () => editorRef.current?.getValue() ?? "";
    return () => {
      getEditorContent.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compile on initial document load
  useEffect(() => {
    if (!autoCompile) return;
    if (!pageId || autoCompileFiredRef.current === pageId) return;
    if (!activePage || !activePage.id) return;
    autoCompileFiredRef.current = pageId;
    const timer = setTimeout(() => {
      compileRef.current?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [pageId, activePage?.id, autoCompile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync root page into store
  useEffect(() => {
    if (parentPage) {
      setCurrentPage(parentPage);
      const proj = parentPage.projectId;
      if (typeof proj === "object") {
        const ws = (proj as any).workspaceId;
        const wid = typeof ws === "object" ? ws?.id : typeof ws === "string" ? ws : null;
        if (wid) setWorkspaceId(wid);
      }
    }
    return () => {
      setCurrentPage("");
      setWorkspaceId("");
    };
  }, [parentPage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register active file as open tab
  useEffect(() => {
    if (!activePage || !pageId) return;
    if (activePage.id === pageId) return;
    openTab(pageId, { id: activePage.id, title: activePage.title });
    setActiveFilePage(activePage);
  }, [activePage?.id, activePage?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isLoading,
    activePage,
    parentPage,
    isAssetTab,
    displayPage,
    pageId,
    fileId,
    selectedAsset,
    editorRef,
  };
}

export const useEditorSession = useActiveDocument;
export const useLayout = useActiveDocument;

// ── 4. Document Actions ──────────────────────────────────────────────────────

export const usePageActions = () => {
  const queryClient = useQueryClient();

  const updateContent = useMutation({
    mutationFn: ({ pageId, content }: { pageId: string; content: string }) =>
      documentService.updateContent(pageId, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
    },
    onError: (error: any) => toast.error(error.message || "Failed to update page content"),
  });

  const updateThumbnail = useMutation({
    mutationFn: ({ pageId, dataUrl }: { pageId: string; dataUrl: string }) =>
      documentService.updateThumbnail(pageId, dataUrl),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
    },
  });

  const deletePage = useMutation({
    mutationFn: documentService.deletePage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success("Page deleted");
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete page"),
  });

  const updateTitle = useMutation({
    mutationFn: ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) =>
      documentService.updateTitle(pageId, title, oldTitle),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success("Title updated");
    },
    onError: (error: any) => toast.error(error.message || "Failed to update title"),
  });

  return {
    updateContent,
    updateThumbnail,
    deletePage,
    updateTitle,
  };
};

// ── 5. File Actions ──────────────────────────────────────────────────────────

export const useFileActions = () => {
  const queryClient = useQueryClient();

  const createFile = useMutation({
    mutationFn: fileService.create,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.files(variables.parentPageId) });
      toast.success("File created");
    },
    onError: (error: any) => toast.error(error.message || "Failed to create file"),
  });

  const setMainFile = useMutation({
    mutationFn: fileService.setMain,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
      toast.success("Main file updated");
    },
    onError: (error: any) => toast.error(error.message || "Failed to set main file"),
  });

  return {
    createFile,
    setMainFile,
  };
};

export function usePageFileActions() {
  return useFileActions();
}

// ── 6. Version Actions ───────────────────────────────────────────────────────

export const useVersionActions = () => {
  const queryClient = useQueryClient();

  const saveVersion = useMutation({
    mutationFn: versionService.save,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.versions(variables.pageId) });
      toast.success("Version saved");
    },
    onError: (error: any) => toast.error(error.message || "Failed to save version"),
  });

  const restoreVersion = useMutation({
    mutationFn: versionService.restore,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.versions(variables.pageId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(variables.pageId) });
      toast.success("Version restored");
    },
    onError: (error: any) => toast.error(error.message || "Failed to restore version"),
  });

  const deleteVersion = useMutation({
    mutationFn: versionService.delete,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.versions(variables.pageId) });
      toast.success("Version deleted");
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete version"),
  });

  return {
    saveVersion,
    restoreVersion,
    deleteVersion,
  };
};

export const usePageVersionActions = useVersionActions;

// ── 7. History Actions ───────────────────────────────────────────────────────

export const useHistoryActions = () => {
  const queryClient = useQueryClient();

  const restoreToEvent = useMutation({
    mutationFn: historyService.restoreToEvent,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.history(variables.rootPageId) });
      toast.success("Project restored");
    },
    onError: (error: any) => toast.error(error.message || "Failed to restore project"),
  });

  return {
    restoreToEvent,
  };
};

export const useProjectHistoryActions = useHistoryActions;
