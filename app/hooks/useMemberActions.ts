import { useCallback } from "react";

/**
 * Hook for member management actions
 */
export function useMemberActions(
  workspaceId: string,
  updateMutation: any,
  removeMutation: any
) {
  const handleUpdateRole = useCallback(
    (userId: string, newRole: string) => {
      updateMutation.mutate({ workspaceId, userId, newRole });
    },
    [updateMutation, workspaceId]
  );

  const handleRemoveMember = useCallback(
    (userId: string) => {
      if (
        confirm("Are you sure you want to remove this member?")
      ) {
        removeMutation.mutate({ workspaceId, userId });
      }
    },
    [removeMutation, workspaceId]
  );

  return { handleUpdateRole, handleRemoveMember };
}
