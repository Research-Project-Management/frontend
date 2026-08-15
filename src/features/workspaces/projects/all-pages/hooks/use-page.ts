import { useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { PageService } from "../services/page.services";
import { toast } from "sonner";

export const pageKeys = {
  all: ["pages"] as const,
  workspace: (workspaceId: string, status?: string, search?: string) =>
    [...pageKeys.all, "workspace", workspaceId, { status, search }] as const,
  project: (projectId: string, status?: string, search?: string) =>
    [...pageKeys.all, "project", projectId, { status, search }] as const,
  detail: (pageId: string) => [...pageKeys.all, "detail", pageId] as const,
};

export const workspacePagesQueryOptions = (workspaceId: string, status?: string, search?: string) =>
  queryOptions({
    queryKey: pageKeys.workspace(workspaceId, status, search),
    queryFn: () => PageService.getWorkspacePages(workspaceId, status, search),
  });

export const projectPagesQueryOptions = (projectId: string, status?: string, search?: string) =>
  queryOptions({
    queryKey: pageKeys.project(projectId, status, search),
    queryFn: () => PageService.getProjectPages(projectId, status, search),
  });

export const usePageActions = () => {
  const queryClient = useQueryClient();

  const createPage = useMutation({
    mutationFn: PageService.create,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.project(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success("Page created");
    },
    onError: (error: any) => toast.error(error.message || "Failed to create page"),
  });

  const deletePage = useMutation({
    mutationFn: PageService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success("Page deleted");
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete page"),
  });

  const updateTitle = useMutation({
    mutationFn: ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) =>
      PageService.updateTitle(pageId, title, oldTitle),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: pageKeys.detail(data._id) });
      queryClient.invalidateQueries({ queryKey: pageKeys.all });
      toast.success("Title updated");
    },
    onError: (error: any) => toast.error(error.message || "Failed to update title"),
  });

  return {
    createPage,
    deletePage,
    updateTitle,
  };
};