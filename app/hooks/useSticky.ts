import { useMemo } from "react";
import { useParams } from "react-router";
import { 
  useStickies, 
  useProjectStickies, 
  useCreateSticky, 
  useUpdateSticky, 
  useDeleteSticky,
  useReorderStickies,
  useReorderProjectStickies
} from "~/query/sticky";

export const useSticky = (options?: { projectId?: string; labels?: string[] }) => {
  const { workspaceId } = useParams();
  const projectId = options?.projectId;
  const labels = options?.labels;

  // 1. Fetching logic
  const { data: workspaceStickies = [], isLoading: isLoadingWorkspace } = useStickies(workspaceId!, labels, undefined, undefined, { enabled: !projectId });
  const { data: projectStickies = [], isLoading: isLoadingProject } = useProjectStickies(projectId!, workspaceId!, labels, { enabled: !!projectId });

  // Determine which stickies to use
  const stickies = projectId ? projectStickies : workspaceStickies;
  const isLoading = projectId ? isLoadingProject : isLoadingWorkspace;

  // 2. Mutations
  const createMutation = useCreateSticky();
  const updateMutation = useUpdateSticky();
  const deleteMutation = useDeleteSticky();
  const reorderMutation = useReorderStickies();
  const reorderProjectMutation = useReorderProjectStickies();

  const handleCreate = async (variables: {
    content: string;
    title?: string;
    color?: string;
    position?: { x: number; y: number };
    labels?: string[];
    parentStickyId?: string;
  }) => {
    return createMutation.mutateAsync({
      workspaceId: workspaceId!,
      projectId,
      ...variables
    });
  };

  const handleUpdate = async (stickyId: string, updates: any) => {
    return updateMutation.mutateAsync({ stickyId, updates });
  };

  const handleDelete = async (stickyId: string) => {
    return deleteMutation.mutateAsync(stickyId);
  };

  const handleReorder = async (stickyIds: string[]) => {
    if (projectId) {
      return reorderProjectMutation.mutateAsync({ projectId, stickyIds });
    }
    return reorderMutation.mutateAsync(stickyIds);
  };

  return {
    stickies,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    reorderMutation,
    reorderProjectMutation,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleReorder,
    isMutating: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
  };
};
