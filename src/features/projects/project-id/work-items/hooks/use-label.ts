'use client';

import { useQuery } from '@tanstack/react-query';
import { LabelService, AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR } from '../services/label.service';
import type { Label } from '../types/work-item.types';

export { AVAILABLE_LABEL_COLORS, DEFAULT_LABEL_COLOR };

export const labelKeys = {
  all: ['labels'] as const,
  project: (projectId?: string) => ['labels', 'project', projectId] as const,
  scoped: (projectId?: string, type?: string) => ['labels', projectId ?? 'default', type] as const,
};

export const useLabelsQuery = (projectId?: string, type?: string) =>
  useQuery({
    queryKey: labelKeys.scoped(projectId, type),
    queryFn: () => LabelService.list(projectId, type),
    staleTime: 30_000,
  });

