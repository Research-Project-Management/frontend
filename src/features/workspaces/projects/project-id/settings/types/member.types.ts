import type { ProjectRole } from '@/features/workspaces/projects/shell/types/project.types';
export type { ProjectRole };


export interface MemberUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface ProjectMemberItem {
  id?: string;
  userId: string;
  user: MemberUser;
  role: ProjectRole | string;
  joinedAt: string;
}

export interface ProjectSettingsState {
  leadId?: string | null;
  defaultAssigneeId?: string | null;
  subscriberIds?: string[];
}

export interface MemberFilterState {
  search: string;
  role?: string | null;
  sortBy?: 'name' | 'email' | 'role' | 'date';
  sortOrder?: 'asc' | 'desc';
}
