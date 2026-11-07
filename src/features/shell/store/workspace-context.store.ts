'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WorkspaceSpaceType = 'personal' | 'project';

export interface ActiveSpace {
  type: WorkspaceSpaceType;
  projectId: string | null;
  projectName?: string;
  projectAvatar?: string | null;
}

interface WorkspaceContextState {
  activeSpace: ActiveSpace;
  setPersonalSpace: () => void;
  setProjectSpace: (project: {
    id: string;
    name?: string;
    avatar?: string | null;
  }) => void;
}

const DEFAULT_PERSONAL_SPACE: ActiveSpace = {
  type: 'personal',
  projectId: null,
};

export const useWorkspaceContextStore = create<WorkspaceContextState>()(
  persist(
    (set) => ({
      activeSpace: DEFAULT_PERSONAL_SPACE,

      setPersonalSpace: () => {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem('flux_active_project_id');
          } catch {}
        }
        set({
          activeSpace: DEFAULT_PERSONAL_SPACE,
        });
      },

      setProjectSpace: (project) => {
        if (
          !project.id ||
          project.id === 'personal' ||
          project.id === 'me' ||
          project.id === 'user'
        ) {
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('flux_active_project_id');
            } catch {}
          }
          set({
            activeSpace: DEFAULT_PERSONAL_SPACE,
          });
          return;
        }
        if (typeof window !== 'undefined' && project.id) {
          try {
            localStorage.setItem('flux_active_project_id', project.id);
          } catch {}
        }
        set({
          activeSpace: {
            type: 'project',
            projectId: project.id,
            projectName: project.name,
            projectAvatar: project.avatar ?? null,
          },
        });
      },
    }),
    {
      name: 'flux_workspace_space_v1',
    }
  )
);
