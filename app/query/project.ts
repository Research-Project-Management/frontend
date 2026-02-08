import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL;

export type Project = {
  _id: string;
  name: string;
  description: string;
  avatar?: string;
  isActive: boolean;
  modules: string[];
  workspace: string;
  members: {
    user: {
      _id: string;
      name: string;
      email: string;
      avatar?: string;
    };
    role: string;
    joinedAt: string;
  }[];
  createdBy: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type ProjectOverviewData = {
  project: Project;
  stats: {
    files: {
      count: number;
      totalSize: number;
      recent: any[]; // Using any for now to avoid circular dependency with storage types, or we can duplicate type
    };
    tasks: {
      total: number;
      completed: number;
      pending: number;
      inProgress: number;
    };
    members: number;
  };
};

// Fetch Project Overview
export const fetchProjectOverview = async (projectId: string) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}/overview`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch project overview");
  }

  return response.json();
};

// Fetch Project (lighter version, just project data)
export const fetchProject = async (projectId: string) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch project");
  }

  return response.json();
};

// Hook for basic project data
export const useProject = (projectId: string) => {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: () => fetchProject(projectId),
    enabled: !!projectId,
  });
};

// Hook
export const useProjectOverview = (projectId: string) => {
  return useQuery<ProjectOverviewData>({
    queryKey: ["project-overview", projectId],
    queryFn: () => fetchProjectOverview(projectId),
    enabled: !!projectId,
  });
};

// Add Member
export const addProjectMember = async ({ projectId, userId, role }: { projectId: string; userId: string; role?: string }) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}/add-member`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ userId, role }),
  });

  if (!response.ok) {
    throw new Error("Failed to add member");
  }

  return response.json();
};

export const useAddProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addProjectMember,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-overview", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-details", variables.projectId] });
    },
  });
};

// Update Role
export const updateProjectMemberRole = async ({ projectId, userId, newRole }: { projectId: string; userId: string; newRole: string }) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}/update-member-role`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ userId, newRole }),
  });

  if (!response.ok) {
    throw new Error("Failed to update role");
  }

  return response.json();
};

export const useUpdateProjectMemberRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProjectMemberRole,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-overview", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-details", variables.projectId] });
    },
  });
};

// Remove Member
export const removeProjectMember = async ({ projectId, userId }: { projectId: string; userId: string }) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}/remove-member`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw new Error("Failed to remove member");
  }

  return response.json();
};

export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeProjectMember,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-overview", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-details", variables.projectId] });
    },
  });
};

// Also need a hook to fetch basic project details (if overview is too heavy)
// or we can reuse useProjectOverview but usually we want a lighter fetch for just members list if needed.
// For now, let's assume we can get members from overview or detail.

export const fetchProjectDetails = async (projectId: string) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch project details");
  }

  return response.json();
};

export const useProjectDetails = (projectId: string) => {
  return useQuery({
    queryKey: ["project-details", projectId],
    queryFn: () => fetchProjectDetails(projectId),
    enabled: !!projectId,
  });
};

// Update Project
export const updateProject = async ({
  projectId,
  name,
  description,
  avatar,
  modules
}: {
  projectId: string;
  name?: string;
  description?: string;
  avatar?: string;
  modules?: string[];
}) => {
  const response = await fetch(`${API_URL}/api/project/${projectId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name, description, avatar, modules }),
  });

  if (!response.ok) {
    throw new Error("Failed to update project");
  }

  return response.json();
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProject,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["project-details", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-overview", variables.projectId] });
    },
  });
};
