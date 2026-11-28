import type {
  FormattedCitation,
  CslStyle,
  CslStyleMetadata,
} from '@/features/library/types/core.types';
import {
  libraryClient,
  isProjectScope,
  getCitationUrl,
  getExportsUrl,
} from './http.client';
import { normalizeCitationStyleId } from '@/features/library/domain/citations';

export const CitationService = {
  formatCitation: (spaceId: string | undefined, itemId: string, style: CslStyle = 'apa-7th', index = 1) => {
    const resolvedStyle = normalizeCitationStyleId(style);
    const pQuery = isProjectScope(spaceId) ? `&spaceId=${encodeURIComponent(spaceId!)}` : '';
    return libraryClient.get<FormattedCitation>(
      `${getCitationUrl(spaceId, 'items')}/${encodeURIComponent(itemId)}/citation?style=${encodeURIComponent(resolvedStyle)}&index=${index}${pQuery}`,
    );
  },

  batchFormat: (spaceId: string | undefined, itemIds: string[], style: CslStyle = 'apa-7th') => {
    const resolvedStyle = normalizeCitationStyleId(style);
    const targetSpaceId = isProjectScope(spaceId) ? spaceId : undefined;
    return libraryClient.post<{
      style: CslStyle;
      total: number;
      combinedInText?: string;
      bibliographyText?: string;
      bibliographyHtml?: string;
      citations: Array<{ itemId?: string; citation: FormattedCitation }>;
    }>(getCitationUrl(spaceId, 'batch-items'), {
      itemIds,
      style: resolvedStyle,
      ...(targetSpaceId ? { spaceId: targetSpaceId } : {}),
    });
  },

  getStyles: (spaceId?: string) => {
    const pQuery = isProjectScope(spaceId) ? `?spaceId=${encodeURIComponent(spaceId!)}` : '';
    return libraryClient.get<import('@/features/library/types/core.types').StyleSummary[]>(
      `${getCitationUrl(spaceId, 'styles')}${pQuery}`,
    );
  },

  searchStyles: (query = '', limit = 30, spaceId?: string) =>
    libraryClient.get<{ styles: CslStyleMetadata[]; total: number }>(
      `${getCitationUrl(spaceId, 'styles/search')}?q=${encodeURIComponent(query)}&limit=${limit}`,
    ),
};

export const ExportsService = {
  exportLibrary: (
    spaceId?: string,
    options?: {
      format?: string;
      collectionId?: string;
      tagId?: string;
      itemIds?: string[];
      spaceId?: string;
      projectId?: string;
    },
  ) => {
    const { projectId: optProjectId, spaceId: optSpaceId, ...restOptions } = options || {};
    const targetSpaceId = optSpaceId || optProjectId || (isProjectScope(spaceId) ? spaceId : undefined);
    return libraryClient.post<{ content: string; filename: string; itemCount: number }>(
      getExportsUrl(spaceId),
      { ...restOptions, ...(targetSpaceId ? { spaceId: targetSpaceId } : {}) },
    );
  },

  downloadAnnotatedPdf: async (
    spaceId: string | undefined,
    itemId: string,
    fallbackFilename = `annotated_${itemId}.pdf`,
    attachmentId?: string,
  ): Promise<{ filename: string; mimeType: string }> => {
    const params = new URLSearchParams();
    if (isProjectScope(spaceId)) params.set('spaceId', spaceId!);
    if (attachmentId) params.set('attachmentId', attachmentId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const endpoint = `${getExportsUrl(spaceId)}/items/${encodeURIComponent(itemId)}/annotated-pdf${qs}`;
    let resolvedFilename = fallbackFilename;
    const res = await libraryClient.get<{ filename: string; mimeType: string; base64: string }>(endpoint);
    if (!res || !res.base64) {
      throw new Error('Failed to generate annotated PDF: No content received');
    }
    if (res.filename) {
      resolvedFilename = res.filename;
    }
    const byteCharacters = atob(res.base64);
    const sliceSize = 32_768;
    const byteArrays: Uint8Array<ArrayBuffer>[] = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const end = Math.min(offset + sliceSize, byteCharacters.length);
      const bytes = new Uint8Array(end - offset);
      for (let i = offset; i < end; i++) {
        bytes[i - offset] = byteCharacters.charCodeAt(i);
      }
      byteArrays.push(bytes);
    }
    const blob = new Blob(byteArrays, { type: res.mimeType || 'application/pdf' });
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resolvedFilename;
      document.body.appendChild(a);
      try {
        a.click();
      } finally {
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    }
    return { filename: resolvedFilename, mimeType: 'application/pdf' };
  },
};
