'use client';

/**
 * use-export.ts
 *
 * Frontend hooks mirroring Backend `modules/document/export/`:
 *  - useExportDocument (triggers download of PDF, Markdown, LaTeX source, or ZIP bundle)
 */

import { useMutation } from '@tanstack/react-query';
import {
  exportService,
  type ExportFormat,
  type ExportFileResult,
} from '../services/export.service';
import { toast } from 'sonner';

export function useExportDocument() {
  return useMutation<
    ExportFileResult,
    Error,
    { pageId: string; format: ExportFormat; includeAssets?: boolean; autoDownload?: boolean }
  >({
    mutationFn: async ({ pageId, format, includeAssets = true, autoDownload = true }) => {
      const res = await exportService.exportDocument(pageId, format, includeAssets);
      if (autoDownload) {
        exportService.downloadExportResult(res);
      }
      return res;
    },
    onSuccess: (data) => {
      toast.success(`Đã xuất tài liệu: ${data.filename}`);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Lỗi khi xuất tài liệu');
    },
  });
}
