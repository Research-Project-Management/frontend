import { useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { PageVersionService } from "../services/version.services";
import { toast } from "sonner";

export const editorVersionKeys = {
  versions: (pageId: string) => ["pages", "detail", pageId, "versions"] as const,
  detail: (pageId: string) => ["pages", "detail", pageId] as const,
};

export const pageVersionsQueryOptions = (pageId: string) =>
  queryOptions({
    queryKey: editorVersionKeys.versions(pageId),
    queryFn: () => PageVersionService.getByPageId(pageId),
  });

export const usePageVersionActions = () => {
  const queryClient = useQueryClient();

  const saveVersion = useMutation({
    mutationFn: PageVersionService.save,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: editorVersionKeys.versions(variables.pageId) });
      toast.success("Version saved");
    },
    onError: (error: any) => toast.error(error.message || "Failed to save version"),
  });

  const restoreVersion = useMutation({
    mutationFn: PageVersionService.restore,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: editorVersionKeys.versions(variables.pageId) });
      queryClient.invalidateQueries({ queryKey: editorVersionKeys.detail(variables.pageId) });
      toast.success("Version restored");
    },
    onError: (error: any) => toast.error(error.message || "Failed to restore version"),
  });

  const deleteVersion = useMutation({
    mutationFn: PageVersionService.delete,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: editorVersionKeys.versions(variables.pageId) });
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
