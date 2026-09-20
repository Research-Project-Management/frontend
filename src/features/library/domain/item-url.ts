/**
 * Pure Domain Model: Item File URL & Storage Resolvers
 * 100% Pure TypeScript - 0% React, 0% DOM dependencies
 */

import type { Item, Paper } from '../types/library.types';

export function isProjectScope(scopeId?: string): scopeId is string {
  if (!scopeId) return false;
  const s = scopeId.trim().toLowerCase();
  return s !== 'user' && s !== 'me' && s !== 'personal' && s !== 'global' && s !== 'default';
}

/**
 * Extracts the canonical PDF or reading file URL from an Item/Paper.
 * Strictly resolves canonical binary content URLs (/api/v1/library/files/:fileId/content)
 * and avoids falling back to DOI landing page URLs.
 */
export function getPaperFileUrl(
  paper?: Partial<Paper> | Partial<Item> | Record<string, any> | null | undefined,
  scopeId?: string,
): string {
  if (!paper) return '';

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
  const attachments = Array.isArray(paper.attachments)
    ? paper.attachments
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

  // 2. Direct fileId on paper
  if (paper.fileId) {
    return `/api/v1/library/files/${encodeURIComponent(paper.fileId)}/content`;
  }

  // 3. PrimaryFile object
  if (paper.primaryFile) {
    const url = normalizeUrl(
      paper.primaryFile.url,
      paper.primaryFile.fileId,
    );
    if (url) return url;
  }

  // 4. Direct fileUrl on paper
  if (paper.fileUrl) {
    const url = normalizeUrl(paper.fileUrl, paper.fileId);
    if (url) return url;
  }

  // 5. Direct openAccessPdfUrl on paper
  if (paper.openAccessPdfUrl) {
    const oaUrl = normalizeUrl(paper.openAccessPdfUrl);
    if (oaUrl) return oaUrl;
  }

  // 6. arXiv fallback
  const arxivMatch =
    paper.arxivId ||
    paper.doi?.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    paper.url?.match(/arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    paper.filename?.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?$/i)?.[1];

  if (arxivMatch) {
    return `https://arxiv.org/pdf/${arxivMatch.replace(/\.pdf$/i, '')}.pdf`;
  }

  return '';
}
