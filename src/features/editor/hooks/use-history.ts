import { useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { ProjectHistoryService } from "../services/history.services";
import { toast } from "sonner";

export const editorHistoryKeys = {
  history: (projectId: string) => ["pages", "history", projectId] as const,
};

export const projectHistoryQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: editorHistoryKeys.history(projectId),
    queryFn: () => ProjectHistoryService.getByProjectId(projectId),
  });

export const useProjectHistoryActions = () => {
  const queryClient = useQueryClient();

  const restoreToEvent = useMutation({
    mutationFn: ProjectHistoryService.restoreToEvent,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: editorHistoryKeys.history(variables.rootPageId) });
      toast.success("Project restored");
    },
    onError: (error: any) => toast.error(error.message || "Failed to restore project"),
  });

  return {
    restoreToEvent,
  };
};
