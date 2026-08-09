'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Role, Permission } from '@/features/workspaces';
import {
  fetchRoles,
  fetchRoleById,
  createRoleRequest,
  updateRoleRequest,
  duplicateRoleRequest,
  deleteRoleRequest,
} from '../services/role.service';

// ── useRoles ──────────────────────────────────────────────────────────────────

export function useRoles(workspaceId: string) {
  return useQuery({
    queryKey: ['roles', workspaceId],
    queryFn: async ({ signal }) => {
      const data = await fetchRoles(workspaceId, signal);
      return Array.isArray(data) ? data : (data.roles ?? []);
    },
    select: (data) => (Array.isArray(data) ? data : []),
    enabled: !!workspaceId,
  });
}

// ── useRole ───────────────────────────────────────────────────────────────────

export function useRole(workspaceId: string, roleId: string) {
  return useQuery({
    queryKey: ['role', roleId],
    queryFn: async ({ signal }) => {
      const data = await fetchRoleById(workspaceId, roleId, signal);
      return data.role;
    },
    enabled: !!workspaceId && !!roleId,
  });
}

// ── useCreateRole ─────────────────────────────────────────────────────────────

export function useCreateRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleData: {
      name: string;
      description: string;
      permissions: Permission[];
      color?: string;
    }) => createRoleRequest(workspaceId, roleData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', workspaceId] });
    },
  });
}

// ── useUpdateRole ─────────────────────────────────────────────────────────────

export function useUpdateRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      ...roleData
    }: {
      roleId: string;
      name?: string;
      description?: string;
      permissions?: Permission[];
      color?: string;
    }) => updateRoleRequest(workspaceId, roleId, roleData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['roles', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['role', variables.roleId] });
    },
  });
}

// ── useDuplicateRole ──────────────────────────────────────────────────────────

export function useDuplicateRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => duplicateRoleRequest(workspaceId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', workspaceId] });
    },
  });
}

// ── useDeleteRole ─────────────────────────────────────────────────────────────

export function useDeleteRole(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => deleteRoleRequest(workspaceId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles', workspaceId] });
    },
  });
}
