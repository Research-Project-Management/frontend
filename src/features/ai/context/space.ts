'use client';

import { useMemo } from 'react';
import { useWorkspaceContextStore } from '@/features/shell/store/workspace-context.store';
import { normalizeSpaceId } from '../transport/flux';

export interface ActiveAiSpace {
  spaceId: string | null;
  projectName?: string;
  isProject: boolean;
}

export function useActiveAiSpace(explicitSpaceId?: string | null): ActiveAiSpace {
  const activeSpace = useWorkspaceContextStore((s) => s.activeSpace);

  return useMemo(() => {
    const cleanExplicit = normalizeSpaceId(explicitSpaceId);
    if (cleanExplicit) {
      const matchedName =
        activeSpace.spaceId === cleanExplicit ||
        activeSpace.projectId === cleanExplicit
          ? activeSpace.projectName
          : undefined;
      return {
        spaceId: cleanExplicit,
        projectName: matchedName,
        isProject: true,
      };
    }

    if (activeSpace.type === 'project') {
      const resolved =
        normalizeSpaceId(activeSpace.spaceId) ||
        normalizeSpaceId(activeSpace.projectId);
      if (resolved) {
        return {
          spaceId: resolved,
          projectName: activeSpace.projectName,
          isProject: true,
        };
      }
    }

    return {
      spaceId: null,
      projectName: undefined,
      isProject: false,
    };
  }, [explicitSpaceId, activeSpace]);
}
