/**
 * Pure Domain Model: Item File URL & Storage Resolvers
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

import type { Item } from '../types/library.types';

export function isProjectScope(scopeId?: string): scopeId is string {
  if (!scopeId) return false;
  const s = scopeId.trim().toLowerCase();
  return s !== 'user' && s !== 'me' && s !== 'global' && s !== 'default';
}

/**
 * Extracts the canonical PDF or reading file URL from an Item.
 * Strictly resolves canonical binary content URLs (/api/v1/library/files/:fileId/content)
 * and avoids falling back to DOI landing page URLs.
 */
export function getItemFileUrl(
  item?: Partial<Item> | Record<string, any> | null | undefined,
  scopeId?: string,
): string {
  if (!item) return '';

  const normalizeUrl = (url?: string | null, fileId?: string | null): string => {
    if (fileId) {
      return `/api/v1/library/files/${encodeURIComponent(fileId)}/content`;
    }
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (
      trimmed.startsWith('/api/files/') &&
      !trimmed.includes('/r2/') &&
      !trimmed.endsWith('/content')
    ) {
      return `${trimmed}/content`;
    }
    return trimmed;
  };

  // 1. Primary file / attachment
  const attachments = Array.isArray(item.attachments)
    ? item.attachments
    : [];

  const primaryPdfAttachment =
    attachments.find(
      (a) =>
        a?.attachmentType === 'primary_pdf',
    ) ||
    attachments.find(
      (a) => a?.mimeType === 'application/pdf',
    ) ||
    attachments.find(
      (a) =>
        Boolean(a?.fileId) &&
        typeof a?.filename === 'string' &&
        a.filename.toLowerCase().endsWith('.pdf'),
    );

  if (primaryPdfAttachment) {
    const url = normalizeUrl(
      primaryPdfAttachment.url,
      primaryPdfAttachment.fileId,
    );
    if (url) return url;
  }

  // 2. Direct fileId on item or item.metadata
  const metaObj = typeof item.metadata === 'object' && item.metadata !== null ? (item.metadata as Record<string, unknown>) : undefined;
  const resolvedDirectFileId =
    item.fileId ||
    (typeof metaObj?.fileId === 'string' ? metaObj.fileId : undefined) ||
    (typeof metaObj?.file_id === 'string' ? metaObj.file_id : undefined);
  if (resolvedDirectFileId) {
    return `/api/v1/library/files/${encodeURIComponent(resolvedDirectFileId)}/content`;
  }

  // 3. PrimaryFile object
  if (item.primaryFile) {
    const url = normalizeUrl(
      item.primaryFile.url,
      item.primaryFile.fileId,
    );
    if (url) return url;
  }

  // 4. Direct fileUrl on item
  if (item.fileUrl) {
    const url = normalizeUrl(item.fileUrl, item.fileId);
    if (url) return url;
  }

  // 5. Direct openAccessPdfUrl on item
  if (item.openAccessPdfUrl) {
    const oaUrl = normalizeUrl(item.openAccessPdfUrl);
    if (oaUrl) return oaUrl;
  }

  // 6. arXiv fallback
  const arxivMatch =
    item.arxivId ||
    item.doi?.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    item.url?.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    item.filename?.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?$/i)?.[1];

  if (arxivMatch) {
    return `https://arxiv.org/pdf/${arxivMatch.replace(/\.pdf$/i, '')}.pdf`;
  }

  return '';
}

/** @deprecated Use getItemFileUrl instead */
export function getPaperFileUrl(
  item?: Partial<Item> | Record<string, any> | null | undefined,
  scopeId?: string,
): string {
  return getItemFileUrl(item, scopeId);
}
