import { apiGet, apiPost, apiDelete } from '@/shared/lib/api';

export interface AttachmentRevisionDto {
  id: string;
  attachmentId: string;
  revisionNumber: number;
  fileHash: string;
  sizeBytes: number;
  url: string;
  comment?: string;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  catalogItemId: string;
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  fileHash?: string;
  uploadedAt: string;
  revisions?: AttachmentRevisionDto[];
}

export interface AddRevisionDto {
  fileId: string;
  filename?: string;
  comment?: string;
}

export async function getAttachments(workspaceId: string, itemId: string): Promise<AttachmentDto[]> {
  const response = await apiGet<{ attachments: AttachmentDto[] }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/items/${encodeURIComponent(itemId)}/attachments`,
  );
  return response.attachments || [];
}

/**
 * Get a single attachment by ID.
 * Backed by GET /api/v1/workspaces/:workspaceId/library/attachments/:attachmentId
 */
export async function getAttachment(
  workspaceId: string,
  attachmentId: string,
): Promise<AttachmentDto> {
  const response = await apiGet<{ attachment: AttachmentDto }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return (response as any).attachment ?? response;
}

export async function getAttachmentRevisions(
  workspaceId: string,
  attachmentId: string,
): Promise<AttachmentRevisionDto[]> {
  const response = await apiGet<{ revisions: AttachmentRevisionDto[] }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/revisions`,
  );
  return response.revisions || [];
}

/**
 * Upload a new file revision for an existing attachment.
 * Backed by POST /api/v1/workspaces/:workspaceId/library/attachments/:attachmentId/revisions
 */
export async function addRevision(
  workspaceId: string,
  attachmentId: string,
  dto: AddRevisionDto,
): Promise<AttachmentRevisionDto> {
  const response = await apiPost<{ revision: AttachmentRevisionDto }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}/revisions`,
    dto,
  );
  return (response as any).revision ?? response;
}

export async function deleteAttachment(
  workspaceId: string,
  attachmentId: string,
): Promise<boolean> {
  const response = await apiDelete<{ success: boolean }>(
    `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/library/attachments/${encodeURIComponent(attachmentId)}`,
  );
  return response.success;
}

export const AttachmentsService = {
  getAttachments,
  getAttachment,
  getAttachmentRevisions,
  addRevision,
  deleteAttachment,
  // Ergonomic aliases
  list: getAttachments,
  get: getAttachment,
  revisions: getAttachmentRevisions,
  delete: deleteAttachment,
};
