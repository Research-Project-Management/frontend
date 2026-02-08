import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Page } from "../types/page";

const API_URL = import.meta.env.VITE_API_URL;

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
    queryKey: ["workspace-pages", workspaceId, status, search],
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
  return useQuery({
    queryKey: ["pages", projectId, status, search],
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
  return useQuery({
    queryKey: ["page", pageId],
    queryFn: () => fetchPage(pageId),
    enabled: !!pageId,
  });
};

// Create Page
const createPage = async ({ projectId, title, status }: { projectId: string; title: string; status?: string }) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}/pages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title, status }),
  });

  if (!response.ok) {
    throw new Error("Failed to create page");
  }

  const data = await response.json();
  return data.page as Page;
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
