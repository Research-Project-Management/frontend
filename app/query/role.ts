import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Role, Permission } from "~/types/role";
import { API_URL } from "~/lib/api";

// Fetch all roles for workspace
export function useRoles(workspaceId: string) {
  return useQuery({
    queryKey: ["roles", workspaceId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/roles/${workspaceId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch roles");
      const data = await res.json();
      return data.roles as Role[];
    },
    enabled: !!workspaceId,
  });
}

// Fetch single role
export function useRole(workspaceId: string, roleId: string) {
  return useQuery({
    queryKey: ["role", roleId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/roles/${workspaceId}/${roleId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch role");
      const data = await res.json();
      return data.role as Role;
    },
    enabled: !!workspaceId && !!roleId,
  });
}

// Create role
export function useCreateRole(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleData: {
      name: string;
      description: string;
      permissions: Permission[];
      color?: string;
    }) => {
      const res = await fetch(`${API_URL}/api/roles/${workspaceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(roleData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
    },
  });
}

// Update role
export function useUpdateRole(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleId,
      ...roleData
    }: {
      roleId: string;
      name?: string;
      description?: string;
      permissions?: Permission[];
      color?: string;
    }) => {
      const res = await fetch(`${API_URL}/api/roles/${workspaceId}/${roleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(roleData),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update role");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["role", variables.roleId] });
    },
  });
}

// Duplicate role
export function useDuplicateRole(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(
        `${API_URL}/api/roles/${workspaceId}/${roleId}/duplicate`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to duplicate role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
    },
  });
}

// Delete role
export function useDeleteRole(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roleId: string) => {
      const res = await fetch(`${API_URL}/api/roles/${workspaceId}/${roleId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete role");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
    },
  });
}
