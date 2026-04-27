import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Role, Permission } from "~/types/role";
import { apiGet, apiPost, apiPut, apiDelete } from "~/lib/api";

// ── Queries ───────────────────────────────────────────────────────────────────

export function useRoles(workspaceId: string) {
  return useQuery({
    queryKey: ["roles", workspaceId],
    queryFn: async () => {
      const data = await apiGet<{ roles: Role[] } | Role[]>(
        `/api/roles/${workspaceId}`,
      );
      return Array.isArray(data) ? data : (data.roles ?? []);
    },
    select: (data) => (Array.isArray(data) ? data : []),
    enabled: !!workspaceId,
  });
}

export function useRole(workspaceId: string, roleId: string) {
  return useQuery({
    queryKey: ["role", roleId],
    queryFn: async () => {
      const data = await apiGet<{ role: Role }>(`/api/roles/${workspaceId}/${roleId}`);
      return data.role;
    },
    enabled: !!workspaceId && !!roleId,
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useCreateRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleData: { name: string; description: string; permissions: Permission[]; color?: string }) =>
      apiPost(`/api/roles/${workspaceId}`, roleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
    },
  });
}

export function useUpdateRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, ...roleData }: { roleId: string; name?: string; description?: string; permissions?: Permission[]; color?: string }) =>
      apiPut(`/api/roles/${workspaceId}/${roleId}`, roleData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["role", variables.roleId] });
    },
  });
}

export function useDuplicateRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      apiPost(`/api/roles/${workspaceId}/${roleId}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
    },
  });
}

export function useDeleteRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      apiDelete(`/api/roles/${workspaceId}/${roleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
    },
  });
}
