'use client';

import { useQuery } from '@tanstack/react-query';
import { LabelService, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from '@/features/projects/project-id/work-items/api/work-item.api';

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR };

export const labelKeys = {
  all: ['labels'] as const,
  project: (projectId?: string) => ['labels', 'project', projectId] as const,
  scoped: (projectId?: string, type?: string) => {
    const normalizedType = !type || type === 'work-item' ? 'work_item' : type;
    return ['labels', projectId ?? 'default', normalizedType] as const;
  },
};

export const useLabelsQuery = (
  projectId?: string,
  type?: string,
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: labelKeys.scoped(projectId, type),
    queryFn: () => LabelService.list(projectId, !type || type === 'work-item' ? 'work_item' : type),
    staleTime: 60_000,
    enabled: options?.enabled !== undefined ? options.enabled : Boolean(projectId),
  });

