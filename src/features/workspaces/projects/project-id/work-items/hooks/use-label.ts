'use client';

import { useQuery } from '@tanstack/react-query';
import { LabelService, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from '../services/label.service';
import type { Label } from '../types/work-item.types';

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR };

export const labelKeys = {
  all: ['labels'] as const,
  project: (projectId?: string) => ['labels', 'project', projectId] as const,
  scoped: (scope: string, type?: string, projectId?: string) => ['labels', scope, type, projectId] as const,
};

export const useLabelsQuery = (workspaceId?: string, type?: string, projectId?: string) =>
  useQuery({
    queryKey: labelKeys.scoped(workspaceId || 'default', type, projectId),
    queryFn: () => LabelService.list(workspaceId, type, projectId),
    staleTime: 30_000,
  });

