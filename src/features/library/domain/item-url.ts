/**
 * Pure Domain Model: Item File URL & Storage Resolvers
 */

export function isProjectScope(scopeId?: string): scopeId is string {
  if (!scopeId) return false;
  const s = scopeId.trim().toLowerCase();
  return (
    s !== "user" &&
    s !== "me" &&
    s !== "personal" &&
    s !== "global" &&
    s !== "default"
  );
}

export type ItemFileSource = {
  fileUrl?: string | null;
  pdfUrl?: string | null;
  openAccessPdfUrl?: string | null;
  url?: string | null;
  filename?: string | null;
  doi?: string | null;
  arxivId?: string | null;
  fileId?: string | null;
  metadata?: unknown;
  primaryFile?: { url?: string | null; fileId?: string | null } | null;
  attachments?: Array<{
    id?: string;
    url?: string | null;
    fileUrl?: string | null;
    fileId?: string | null;
    filename?: string | null;
    mimeType?: string | null;
    attachmentType?: string | null;
  }> | null;
  [key: string]: unknown;
};

/**
 * Extracts the canonical PDF or reading file URL from an Item.
 * Strictly resolves canonical binary content URLs (/api/v1/library/files/:fileId/content)
 * and avoids falling back to DOI landing page URLs.
 */
export function getItemFileUrl(
  item?: ItemFileSource | null | undefined,
  scopeId?: string,
): string {
  if (!item) return "";

  const effectiveScope = isProjectScope(scopeId)
    ? scopeId
    : typeof item.projectId === "string" && isProjectScope(item.projectId)
      ? item.projectId
      : undefined;

  const normalizeUrl = (
    url?: string | null,
    fileId?: string | null,
  ): string => {
    if (fileId) {
      return isProjectScope(effectiveScope)
        ? `/api/v1/projects/${encodeURIComponent(effectiveScope)}/library/files/${encodeURIComponent(fileId)}/content`
        : `/api/v1/library/files/${encodeURIComponent(fileId)}/content`;
    }
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (
      trimmed.startsWith("/api/v1/storage/files/") &&
      !trimmed.includes("/r2/") &&
      !trimmed.endsWith("/content")
    ) {
      return `${trimmed}/content`;
    }
    return trimmed;
  };

  // 1. Primary file / attachment
  const attachments = Array.isArray(item.attachments) ? item.attachments : [];

  const primaryPdfAttachment =
    attachments.find((a) => a?.attachmentType === "primary_pdf") ||
    attachments.find((a) => a?.mimeType === "application/pdf") ||
    attachments.find(
      (a) =>
        Boolean(a?.fileId) &&
        typeof a?.filename === "string" &&
        a.filename.toLowerCase().endsWith(".pdf"),
    );

  if (primaryPdfAttachment) {
    const url = normalizeUrl(
      primaryPdfAttachment.url,
      primaryPdfAttachment.fileId,
    );
    if (url) return url;
  }

  // 2. Direct fileId on item or item.metadata
  const metaObj =
    typeof item.metadata === "object" && item.metadata !== null
      ? (item.metadata as Record<string, unknown>)
      : undefined;
  const resolvedDirectFileId =
    item.fileId ||
    (typeof metaObj?.fileId === "string" ? metaObj.fileId : undefined) ||
    (typeof metaObj?.file_id === "string" ? metaObj.file_id : undefined);
  if (resolvedDirectFileId) {
    return isProjectScope(effectiveScope)
      ? `/api/v1/projects/${encodeURIComponent(effectiveScope)}/library/files/${encodeURIComponent(resolvedDirectFileId)}/content`
      : `/api/v1/library/files/${encodeURIComponent(resolvedDirectFileId)}/content`;
  }

  // 3. PrimaryFile object
  if (item.primaryFile) {
    const url = normalizeUrl(item.primaryFile.url, item.primaryFile.fileId);
    if (url) return url;
  }

  // 4. Direct fileUrl on item
  if (item.fileUrl) {
    const url = normalizeUrl(item.fileUrl, item.fileId);
    if (url) return url;
  }

  // 5. arXiv fallback (use direct PDF download link without HTML redirect)
  const arxivMatch =
    item.arxivId ||
    item.doi?.match(/arxiv\.(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ||
    item.url?.match(
      /arxiv\.org\/(?:abs|pdf)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i,
    )?.[1] ||
    item.filename?.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)(?:\.pdf)?$/i)?.[1];

  if (arxivMatch) {
    const cleanId = arxivMatch.replace(/\.pdf$/i, "");
    return `https://arxiv.org/pdf/${cleanId}.pdf`;
  }

  return "";
}
