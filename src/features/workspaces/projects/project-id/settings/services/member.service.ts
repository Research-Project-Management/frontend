import { apiGet, apiPost, apiPut, apiDelete } from '@/shared/lib/api';
import type { ProjectRole } from '../types/member.types';

// ── Raw fetchers — Project Member Management ────────────────────────────────

export interface ProjectMemberResponse {
  id?: string;
  userId: string;
  role: ProjectRole | string;
  joinedAt?: string;
  user: {
    id?: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export const ProjectMemberService = {
  getMembers: async (projectId: string) => {
    const res = await apiGet<{ members: ProjectMemberResponse[] }>(
      `/api/project/${projectId}/members`
    );
    return res.members || [];
  },

  addMember: async ({
    projectId,
    userId,
    role = 'contributor',
  }: {
    projectId: string;
    userId: string;
    role?: ProjectRole | string;
  }) => {
    return apiPost<{ message: string; member: ProjectMemberResponse }>(
      `/api/project/${projectId}/members`,
      { userId, role }
    );
  },

  updateMemberRole: async ({
    projectId,
    userId,
    role,
  }: {
    projectId: string;
    userId: string;
    role: ProjectRole | string;
  }) => {
    return apiPut<{ message: string; member: ProjectMemberResponse }>(
      `/api/project/${projectId}/members/${userId}`,
      { role }
    );
  },

  removeMember: async ({
    projectId,
    userId,
  }: {
    projectId: string;
    userId: string;
  }) => {
    return apiDelete<{ message: string }>(
      `/api/project/${projectId}/members/${userId}`
    );
  },
};

export const getProjectMembers = ProjectMemberService.getMembers;
export const addProjectMember = ProjectMemberService.addMember;
export const updateProjectMemberRole = ProjectMemberService.updateMemberRole;
export const removeProjectMember = ProjectMemberService.removeMember;
