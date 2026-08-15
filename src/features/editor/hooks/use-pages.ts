/**
 * use-pages.ts (editor feature)
 *
 * Editor-scoped access to page document queries, files, versions, and history.
 */

import { useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { PageDocumentService, PageFileService } from "../services/page-document.services";
import { toast } from "sonner";

export { pageVersionsQueryOptions, usePageVersionActions } from "./use-version";
export { projectHistoryQueryOptions, useProjectHistoryActions } from "./use-history";

export const editorPageKeys = {
  detail: (pageId: string) => ["pages", "detail", pageId] as const,
  files: (pageId: string) => ["pages", "detail", pageId, "files"] as const,
};

export const pageDetailQueryOptions = (pageId: string) =>
  queryOptions({
    queryKey: editorPageKeys.detail(pageId),
    queryFn: () => PageDocumentService.getById(pageId),
  });

export const pageFilesQueryOptions = (pageId: string) =>
  queryOptions({
    queryKey: editorPageKeys.files(pageId),
    queryFn: () => PageFileService.getByPageId(pageId),
  });

export const usePageActions = () => {
  const queryClient = useQueryClient();

  const updateContent = useMutation({
    mutationFn: ({ pageId, content }: { pageId: string; content: string }) =>
      PageDocumentService.updateContent(pageId, content),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: editorPageKeys.detail(variables.pageId) });
    },
    onError: (error: any) => toast.error(error.message || "Failed to update page content"),
  });

  const updateThumbnail = useMutation({
    mutationFn: ({ pageId, dataUrl }: { pageId: string; dataUrl: string }) =>
      PageDocumentService.updateThumbnail(pageId, dataUrl),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: editorPageKeys.detail(variables.pageId) });
    },
  });

  const deletePage = useMutation({
    mutationFn: PageDocumentService.deletePage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pages"] });
      toast.success("Page deleted");
    },
    onError: (error: any) => toast.error(error.message || "Failed to delete page"),
  });

  const updateTitle = useMutation({
    mutationFn: ({ pageId, title, oldTitle }: { pageId: string; title: string; oldTitle?: string }) =>
      PageDocumentService.updateTitle(pageId, title, oldTitle),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: editorPageKeys.detail(data._id) });
      queryClient.invalidateQueries({ queryKey: ["pages"] });
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

export const usePageFileActions = () => {
  const queryClient = useQueryClient();

  const createFile = useMutation({
    mutationFn: PageFileService.create,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: editorPageKeys.files(variables.parentPageId) });
      toast.success("File created");
    },
    onError: (error: any) => toast.error(error.message || "Failed to create file"),
  });

  const setMainFile = useMutation({
    mutationFn: PageFileService.setMain,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: editorPageKeys.detail(variables.pageId) });
      toast.success("Main file updated");
    },
    onError: (error: any) => toast.error(error.message || "Failed to set main file"),
  });

  return {
    createFile,
    setMainFile,
  };
};
