'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/storage-keys';

export type WorkspaceSpaceType = 'personal' | 'project';

export interface ActiveSpace {
  type: WorkspaceSpaceType;
  spaceId?: string | null;
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
  validateOrHealSpace: (validProjects: Array<{ id: string }>) => void;
}

const DEFAULT_PERSONAL_SPACE: ActiveSpace = {
  type: 'personal',
  spaceId: null,
  projectId: null,
};

export const useWorkspaceContextStore = create<WorkspaceContextState>()(
  persist(
    (set) => ({
      activeSpace: DEFAULT_PERSONAL_SPACE,

      setPersonalSpace: () => {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
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
              localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
            } catch {}
          }
          set({
            activeSpace: DEFAULT_PERSONAL_SPACE,
          });
          return;
        }
        if (typeof window !== 'undefined' && project.id) {
          try {
            localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, project.id);
          } catch {}
        }
        set({
          activeSpace: {
            type: 'project',
            spaceId: project.id,
            projectId: project.id,
            projectName: project.name,
            projectAvatar: project.avatar ?? null,
          },
        });
      },

      validateOrHealSpace: (validProjects) => {
        set((state) => {
          if (state.activeSpace.type !== 'project' || !state.activeSpace.projectId) {
            return state;
          }
          const exists = validProjects.some((p) => p.id === state.activeSpace.projectId);
          if (!exists) {
            if (typeof window !== 'undefined') {
              try {
                localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
              } catch {}
            }
            return {
              activeSpace: DEFAULT_PERSONAL_SPACE,
            };
          }
          return state;
        });
      },
    }),
    {
      name: 'flux_workspace_space_v1',
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<WorkspaceContextState>) || {};
        const rawSpace = persisted.activeSpace;
        const isValid =
          rawSpace &&
          typeof rawSpace === 'object' &&
          (rawSpace.type === 'personal' || rawSpace.type === 'project');

        const activeSpace: ActiveSpace = isValid
          ? {
              type: rawSpace.type,
              spaceId: typeof rawSpace.spaceId === 'string' ? rawSpace.spaceId : null,
              projectId: typeof rawSpace.projectId === 'string' ? rawSpace.projectId : null,
              projectName: typeof rawSpace.projectName === 'string' ? rawSpace.projectName : undefined,
              projectAvatar: typeof rawSpace.projectAvatar === 'string' ? rawSpace.projectAvatar : null,
            }
          : currentState.activeSpace;

        return {
          ...currentState,
          activeSpace,
        };
      },
    }
  )
);
