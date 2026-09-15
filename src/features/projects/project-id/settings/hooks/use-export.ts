'use client';

import { useMutation } from '@tanstack/react-query';
import { ExportService } from '../services/export.service';

export const useExportWorkItems = () => {
  return useMutation({
    mutationFn: ({ projectId, format }: { projectId: string; format?: 'csv' | 'json' }) =>
      ExportService.exportWorkItems(projectId, format),
  });
};
