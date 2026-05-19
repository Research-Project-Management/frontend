import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Page, PageVersion, PageEvent } from "../types/page";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";
import { toast } from "sonner";

// ── Workspace Pages ───────────────────────────────────────────────────────────

const fetchWorkspacePages = async (workspaceId: string, status?: string, search?: string) => {
  const params = new URLSearchParams();
  if (status && status !== "all") params.append("status", status);
  if (search) params.append("search", search);
  const data = await apiGet<{ pages: Page[] }>(`/api/workspace/${workspaceId}/pages?${params.toString()}`);
  return data.pages;
};

export const useWorkspacePages = (workspaceId: string, status?: string, search?: string, options?: { enabled?: boolean }) =>
  useQuery({
    queryKey: ["workspace-pages", workspaceId, status],
    queryFn: () => fetchWorkspacePages(workspaceId, status, search),
    enabled: !!workspaceId && (options?.enabled ?? true),
  });

// ── Project Pages ─────────────────────────────────────────────────────────────

const fetchProjectPages = async (projectId: string, status?: string, search?: string) => {
  const params = new URLSearchParams();
  if (status && status !== "all") params.append("status", status);
  if (search) params.append("search", search);
  const data = await apiGet<{ pages: Page[] }>(`/api/project/${projectId}/pages?${params.toString()}`);
  return data.pages;
};

export const useProjectPages = (projectId: string, status?: string, search?: string, options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !projectId) return;
    socket.emit("join:project", projectId);

    const onCreated = ({ page }: { page: Page }) => {
      queryClient.setQueryData<Page[]>(["pages", projectId, status], (old = []) =>
        old.some((p) => p._id === page._id) ? old : [...old, page],
      );
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
    };
    const onDeleted = ({ pageId }: { pageId: string }) => {
      queryClient.setQueryData<Page[]>(["pages", projectId, status], (old = []) =>
        old.filter((p) => p._id !== pageId),
      );
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
    };

    socket.on("page:created", onCreated);
    socket.on("page:deleted", onDeleted);

    return () => {
      socket.emit("leave:project", projectId);
      socket.off("page:created", onCreated);
      socket.off("page:deleted", onDeleted);
    };
  }, [socket, projectId, status, queryClient]);

  return useQuery({
    queryKey: ["pages", projectId, status],
    queryFn: () => fetchProjectPages(projectId, status, search),
    enabled: !!projectId && (options?.enabled ?? true),
  });
};

// ── Single Page ───────────────────────────────────────────────────────────────

const fetchPage = async (pageId: string) => {
  const data = await apiGet<{ page: Page }>(`/api/pages/${pageId}`);
  return data.page;
};

export const usePage = (pageId: string) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !pageId) return;
    socket.emit("join:page", pageId);

    const onUpdated = ({ pageId: uid, title, status }: { pageId: string; title?: string; status?: Page["status"] }) => {
      if (uid !== pageId) return;
      queryClient.setQueryData<Page>(["page", pageId], (old) => {
        if (!old) return old;
        return { ...old, ...(title !== undefined && { title }), ...(status !== undefined && { status }) };
      });
    };

    socket.on("page:updated", onUpdated);
    return () => {
      socket.emit("leave:page", pageId);
      socket.off("page:updated", onUpdated);
    };
  }, [socket, pageId, queryClient]);

  return useQuery({
    queryKey: ["page", pageId],
    queryFn: () => fetchPage(pageId),
    enabled: !!pageId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });
};

// ── Page CRUD ─────────────────────────────────────────────────────────────────

export const useCreatePage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, title, content, status }: {
      projectId: string; title: string; content?: string; status?: string;
    }) => {
      const data = await apiPost<{ page: Page; mainFile?: Page }>(
        `/api/project/${projectId}/pages`, { title, content, status },
      );
      return {
        page: data.page,
        mainFile: data.mainFile || null,
        rootPageId: data.page._id as string,
        mainFileId: (data.mainFile?._id ?? null) as string | null,
      };
    },
    onSuccess: (data) => {
      queryClient.clear();
      if (data.rootPageId && data.page) {
        queryClient.setQueryData(["page", data.rootPageId], data.page);
      }
      if (data.mainFileId && data.mainFile) {
        queryClient.setQueryData(["page", data.mainFileId], data.mainFile);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create page", { id: "page-error" });
    },
  });
};

export const useDeletePage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId }: { pageId: string; projectId: string }) =>
      apiDelete(`/api/pages/${pageId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pages", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["page-files", variables.projectId] });
      }
      toast.success("Page removed", { id: "page-action" });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete page", { id: "page-error" });
    },
  });
};

export const useUpdatePageContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, content }: { pageId: string; content: string }) => {
      const data = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { content });
      return data.page;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["page", variables.pageId], data);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save content", { id: "page-save-error" });
    },
  });
};

export const useUpdatePageTitle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) => {
      const data = await apiPut<{ page: Page }>(`/api/pages/${pageId}`, { title, _oldTitle: oldTitle });
      return data.page;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["page", variables.pageId], data);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
      queryClient.invalidateQueries({ queryKey: ["page-files"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update title", { id: "page-error" });
    },
  });
};

// ── Page Files (child files inside a page-project) ──────────────────────────

type PageFile = { _id: string; title: string; updatedAt: string };

export const usePageFiles = (pageId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !pageId) return;
    socket.emit("join:page", pageId);

    const onFileCreated = ({ file }: { file: PageFile }) => {
      queryClient.setQueryData<PageFile[]>(
        ["page-files", pageId],
        (old = []) => (old.some((f) => f._id === file._id) ? old : [...old, file]),
      );
    };

    socket.on("file:created", onFileCreated);
    return () => {
      socket.emit("leave:page", pageId);
      socket.off("file:created", onFileCreated);
    };
  }, [socket, pageId, queryClient]);

  return useQuery({
    queryKey: ["page-files", pageId],
    queryFn: async () => {
      const data = await apiGet<{ files: PageFile[] }>(`/api/pages/${pageId}/files`);
      return data.files;
    },
    enabled: !!pageId,
  });
};

export const useCreatePageFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ parentPageId, title, content }: {
      parentPageId: string; title: string; content?: string;
    }) => {
      const data = await apiPost<{ file: PageFile }>(`/api/pages/${parentPageId}/files`, { title, content });
      return data.file;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-files", variables.parentPageId] });
      // Also refresh the storage panel (folder children) which uses project-files-editor
      queryClient.invalidateQueries({
        queryKey: ["project-files-editor", variables.parentPageId],
        exact: false,
      });
      toast.success("File created successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create file");
    },
  });
};

export const useSetPageMainFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, fileId }: { pageId: string; fileId: string }) => {
      const data = await apiPut<{ page: Page }>(`/api/pages/${pageId}/main-file`, { fileId });
      return data.page;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["page", variables.pageId], data);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
      toast.success("Main file updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update main file");
    },
  });
};

export const useUpdatePageThumbnail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, dataUrl }: { pageId: string; dataUrl: string }) =>
      apiPut(`/api/pages/${pageId}/thumbnail`, { dataUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
      toast.success("Thumbnail updated");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update thumbnail");
    },
  });
};

export const useSyncProjectToCompiler = () =>
  useMutation({
    mutationFn: ({ pageId }: { pageId: string }) =>
      apiPost(`/api/pages/${pageId}/sync-project`, {}),
    onSuccess: () => {
      toast.success("Project synced to compiler");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to sync project");
    },
  });

// ── Version control ───────────────────────────────────────────────────────────

export const usePageVersions = (pageId: string | null) =>
  useQuery({
    queryKey: ["page-versions", pageId],
    queryFn: async () => {
      const data = await apiGet<{ versions: PageVersion[] }>(`/api/pages/${pageId}/versions`);
      return data.versions;
    },
    enabled: !!pageId,
  });

export const useSavePageVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, label = "" }: {
      pageId: string; label?: string; rootPageId?: string;
    }) => {
      const data = await apiPost<{ version: PageVersion }>(`/api/pages/${pageId}/versions`, { label });
      return data.version;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-versions", variables.pageId] });
      if (variables.rootPageId) {
        queryClient.invalidateQueries({ queryKey: ["project-history", variables.rootPageId] });
      }
      toast.success("Version saved successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save version");
    },
  });
};

export const useRestorePageVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, versionId }: { pageId: string; versionId: string }) => {
      const data = await apiPost<{ page: Page }>(`/api/pages/${pageId}/versions/${versionId}/restore`);
      return data.page;
    },
    onSuccess: (restoredPage, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page", variables.pageId] });
      queryClient.setQueryData(["page", variables.pageId], restoredPage);
      toast.success("Version restored successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to restore version");
    },
  });
};

export const useDeletePageVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, versionId }: { pageId: string; versionId: string }) =>
      apiDelete(`/api/pages/${pageId}/versions/${versionId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-versions", variables.pageId] });
      toast.success("Version deleted successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete version");
    },
  });
};

// ── Project history ───────────────────────────────────────────────────────────

export const useProjectHistory = (rootPageId: string | null) =>
  useQuery({
    queryKey: ["project-history", rootPageId],
    queryFn: async () => {
      const data = await apiGet<{ events: PageEvent[] }>(`/api/pages/${rootPageId}/history`);
      return data.events;
    },
    enabled: !!rootPageId,
    refetchInterval: 30_000,
  });

export const useRestoreProjectToEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ rootPageId, eventId }: { rootPageId: string; eventId: string }) =>
      apiPost<{
        restored: Array<{ pageId: string; title: string; content: string }>;
        restoredAt: string;
      }>(`/api/pages/${rootPageId}/history/${eventId}/restore`),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-history", variables.rootPageId] });
      data.restored.forEach((r) => {
        queryClient.setQueryData(["page", r.pageId], (old: any) =>
          old ? { ...old, content: r.content } : old,
        );
      });
      toast.success("Project restored to historical event");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to restore project");
    },
  });
};
