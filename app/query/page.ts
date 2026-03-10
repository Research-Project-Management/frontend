import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Page, PageAsset, PageVersion, PageEvent } from "../types/page";
import { API_URL } from "~/lib/api";
import { useSocket } from "~/contexts/SocketProvider";

// Fetch Pages for a Workspace
const fetchWorkspacePages = async (workspaceId: string, status?: string, search?: string) => {
  const params = new URLSearchParams();
  if (status && status !== "all") params.append("status", status);
  if (search) params.append("search", search);

  const response = await fetch(`${API_URL}/api/workspace/${workspaceId}/pages?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch pages");
  }

  const data = await response.json();
  return data.pages as Page[];
};

export const useWorkspacePages = (workspaceId: string, status?: string, search?: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["workspace-pages", workspaceId, status],
    queryFn: () => fetchWorkspacePages(workspaceId, status, search),
    enabled: !!workspaceId && (options?.enabled ?? true),
  });
};

// Fetch Pages for a Project
const fetchProjectPages = async (projectId: string, status?: string, search?: string) => {
  const params = new URLSearchParams();
  if (status && status !== "all") params.append("status", status);
  if (search) params.append("search", search);

  const response = await fetch(`${API_URL}/api/project/${projectId}/pages?${params.toString()}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch pages");
  }

  const data = await response.json();
  return data.pages as Page[];
};

export const useProjectPages = (projectId: string, status?: string, search?: string, options?: { enabled?: boolean }) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !projectId) return;
    socket.emit("join:project", projectId);

    const onCreated = ({ page }: { page: Page }) => {
      queryClient.setQueryData<Page[]>(["pages", projectId, status], (old = []) =>
        old.some((p) => p._id === page._id) ? old : [...old, page]
      );
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
    };
    const onDeleted = ({ pageId }: { pageId: string }) => {
      queryClient.setQueryData<Page[]>(["pages", projectId, status], (old = []) =>
        old.filter((p) => p._id !== pageId)
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

// Fetch Single Page
const fetchPage = async (pageId: string) => {
  const response = await fetch(`${API_URL}/api/pages/${pageId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch page");
  }

  const data = await response.json();
  return data.page as Page;
};

export const usePage = (pageId: string) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !pageId) return;
    socket.emit("join:page", pageId);

    const onUpdated = ({ pageId: uid, title, status }: { pageId: string; title?: string; status?: string }) => {
      if (uid !== pageId) return;
      queryClient.setQueryData<Page>(["page", pageId], (old) => {
        if (!old) return old;
        return {
          ...old,
          ...(title !== undefined && { title }),
          ...(status !== undefined && { status }),
        };
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
  });
};

// Create Page
const createPage = async ({ projectId, title, content, status }: { projectId: string; title: string; content?: string; status?: string }) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title, content, status }),
  });

  if (!response.ok) {
    throw new Error("Failed to create page");
  }

  const data = await response.json();
  // Backend returns { page, mainFile } — attach mainFile id for callers to navigate
  return { page: data.page as Page, mainFileId: (data.mainFile?._id ?? null) as string | null };
};

export const useCreatePage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPage,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pages", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
    },
  });
};

// Delete Page
const deletePage = async ({ pageId, projectId }: { pageId: string; projectId: string }) => {
  const response = await fetch(`${API_URL}/api/pages/${pageId}`, {
    method: "DELETE",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to delete page");
  }

  return true;
};

export const useDeletePage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePage,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pages", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
    },
  });
};

// Update Page Content
const updatePageContent = async ({ pageId, content }: { pageId: string; content: string }) => {
  const response = await fetch(`${API_URL}/api/pages/${pageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error("Failed to update page");
  }

  const data = await response.json();
  return data.page as Page;
};

export const useUpdatePageContent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePageContent,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["page", variables.pageId], data);
    },
  });
};

// Update Page Title
const updatePageTitle = async ({ pageId, title }: { pageId: string; title: string }) => {
  const response = await fetch(`${API_URL}/api/pages/${pageId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error("Failed to update page title");
  }

  const data = await response.json();
  return data.page as Page;
};

export const useUpdatePageTitle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePageTitle,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["page", variables.pageId], data);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
    },
  });
};

// ── Page Files (child files inside a page-project) ──────────────────────────

type PageFile = { _id: string; title: string; updatedAt: string };

const fetchPageFiles = async (pageId: string): Promise<PageFile[]> => {
  const response = await fetch(`${API_URL}/api/pages/${pageId}/files`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch page files");
  const data = await response.json();
  return data.files as PageFile[];
};

export const usePageFiles = (pageId: string | null | undefined) => {
  const queryClient = useQueryClient();
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !pageId) return;
    socket.emit("join:page", pageId);

    const onFileCreated = ({ file }: { file: { _id: string; title: string; updatedAt: string } }) => {
      queryClient.setQueryData<{ _id: string; title: string; updatedAt: string }[]>(
        ["page-files", pageId],
        (old = []) => (old.some((f) => f._id === file._id) ? old : [...old, file])
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
    queryFn: () => fetchPageFiles(pageId!),
    enabled: !!pageId,
  });
};

const createPageFile = async ({
  parentPageId,
  title,
  content,
}: {
  parentPageId: string;
  title: string;
  content?: string;
}): Promise<PageFile> => {
  const response = await fetch(`${API_URL}/api/pages/${parentPageId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title, content }),
  });
  if (!response.ok) throw new Error("Failed to create file");
  const data = await response.json();
  return data.file as PageFile;
};

export const useCreatePageFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPageFile,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-files", variables.parentPageId] });
    },
  });
};

const setPageMainFile = async ({
  pageId,
  fileId,
}: {
  pageId: string;
  fileId: string;
}): Promise<Page> => {
  const response = await fetch(`${API_URL}/api/pages/${pageId}/main-file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fileId }),
  });
  if (!response.ok) throw new Error("Failed to set main file");
  const data = await response.json();
  return data.page as Page;
};

export const useSetPageMainFile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setPageMainFile,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(["page", variables.pageId], data);
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
    },
  });
};

const updatePageThumbnail = async ({
  pageId,
  dataUrl,
}: {
  pageId: string;
  dataUrl: string;
}): Promise<void> => {
  const response = await fetch(`${API_URL}/api/pages/${pageId}/thumbnail`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ dataUrl }),
  });
  if (!response.ok) throw new Error("Failed to save thumbnail");
};

export const useUpdatePageThumbnail = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatePageThumbnail,
    onSuccess: (_, variables) => {
      // Invalidate so PageItem re-fetches the updated thumbnail
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-pages"] });
    },
  });
};

// ── Page Assets (images & binary files uploaded to a page-project) ────────

const fetchPageAssets = async (pageId: string): Promise<PageAsset[]> => {
  const res = await fetch(`${API_URL}/api/pages/${pageId}/assets`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch assets");
  return (await res.json()).assets;
};

export const usePageAssets = (pageId: string | null) =>
  useQuery({
    queryKey: ["page-assets", pageId],
    queryFn: () => fetchPageAssets(pageId!),
    enabled: !!pageId,
  });

export const useUploadPageAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, file }: { pageId: string; file: File }) => {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip the "data:<mime>;base64," prefix
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${API_URL}/api/pages/${pageId}/assets`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          data: base64,
        }),
      });
      if (!res.ok) throw new Error("Upload failed");
      return (await res.json()).asset as PageAsset;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-assets", variables.pageId] });
    },
  });
};

export const useDeletePageAsset = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pageId,
      assetId,
    }: {
      pageId: string;
      assetId: string;
    }) => {
      const res = await fetch(`${API_URL}/api/pages/${pageId}/assets/${assetId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-assets", variables.pageId] });
    },
  });
};

export const useFetchAssetData = () =>
  useMutation({
    mutationFn: async ({
      pageId,
      assetId,
    }: {
      pageId: string;
      assetId: string;
    }) => {
      const res = await fetch(
        `${API_URL}/api/pages/${pageId}/assets/${assetId}/data`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch asset data");
      return (await res.json()) as { name: string; mimeType: string; data: string };
    },
  });

// ── Version control ───────────────────────────────────────────────────────────

export const usePageVersions = (pageId: string | null) =>
  useQuery({
    queryKey: ["page-versions", pageId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/pages/${pageId}/versions`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch versions");
      return (await res.json()).versions as PageVersion[];
    },
    enabled: !!pageId,
  });

export const useSavePageVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pageId,
      label = "",
      rootPageId,
    }: {
      pageId: string;
      label?: string;
      /** Passed for cache invalidation only — not sent to the server. */
      rootPageId?: string;
    }) => {
      const res = await fetch(`${API_URL}/api/pages/${pageId}/versions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error("Failed to save version");
      return (await res.json()).version as PageVersion;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-versions", variables.pageId] });
      if (variables.rootPageId) {
        queryClient.invalidateQueries({ queryKey: ["project-history", variables.rootPageId] });
      }
    },
  });
};

export const useRestorePageVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, versionId }: { pageId: string; versionId: string }) => {
      const res = await fetch(
        `${API_URL}/api/pages/${pageId}/versions/${versionId}/restore`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to restore version");
      return (await res.json()).page as Page;
    },
    onSuccess: (restoredPage, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page", variables.pageId] });
      queryClient.setQueryData(["page", variables.pageId], restoredPage);
    },
  });
};

export const useDeletePageVersion = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageId, versionId }: { pageId: string; versionId: string }) => {
      const res = await fetch(
        `${API_URL}/api/pages/${pageId}/versions/${versionId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to delete version");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["page-versions", variables.pageId] });
    },
  });
};

// ── Project history ───────────────────────────────────────────────────────────

/** Unified project timeline: manual saves + file/asset lifecycle events. */
export const useProjectHistory = (rootPageId: string | null) =>
  useQuery({
    queryKey: ["project-history", rootPageId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/pages/${rootPageId}/history`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch project history");
      return (await res.json()).events as PageEvent[];
    },
    enabled: !!rootPageId,
    refetchInterval: 30_000,
  });

/**
 * Restore all project files to their content at the time of the given event.
 * Returns the list of restored files (with their new content) for the caller
 * to sync the Monaco editor if needed.
 */
export const useRestoreProjectToEvent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      rootPageId,
      eventId,
    }: {
      rootPageId: string;
      eventId: string;
    }) => {
      const res = await fetch(
        `${API_URL}/api/pages/${rootPageId}/history/${eventId}/restore`,
        { method: "POST", credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to restore project");
      return (await res.json()) as {
        restored: Array<{ pageId: string; title: string; content: string }>;
        restoredAt: string;
      };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["project-history", variables.rootPageId],
      });
      data.restored.forEach((r) => {
        queryClient.setQueryData(["page", r.pageId], (old: any) =>
          old ? { ...old, content: r.content } : old,
        );
      });
    },
  });
};
